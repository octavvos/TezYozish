import secrets
import string
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from practice.models import LANG_CHOICES, TextSample, TypingSession, calculate_metrics

RACE_COUNTDOWN_SECONDS = 3
RACE_TIME_LIMIT_SECONDS = 180
MIN_PLAYERS_TO_START = 2
MAX_PLAYERS = 6
CODE_ALPHABET = string.ascii_uppercase + string.digits


def generate_race_code():
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))


class Race(models.Model):
    STATUS_CHOICES = [
        ("waiting", "waiting"),
        ("running", "running"),
        ("finished", "finished"),
    ]

    code = models.CharField(max_length=6, unique=True, default=generate_race_code)
    host = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="hosted_races",
    )
    lang = models.CharField(max_length=2, choices=LANG_CHOICES)
    text = models.ForeignKey(TextSample, on_delete=models.PROTECT, related_name="races")
    max_players = models.PositiveSmallIntegerField(default=4)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="waiting", db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Race {self.code} ({self.status})"

    @property
    def is_full(self):
        return self.participants.count() >= self.max_players

    def settle(self, now=None):
        """
        Poyga vaqti tugagan yoki hamma finish qilgan bo'lsa, poygani yakunlaydi
        va tugatmagan ishtirokchilarning natijasini saqlaydi.
        """
        if self.status != "running" or self.started_at is None:
            return
        now = now or timezone.now()
        time_limit = self.started_at + timedelta(seconds=RACE_TIME_LIMIT_SECONDS)
        participants = list(self.participants.select_related("user"))
        all_finished = all(p.finished_at for p in participants)
        if not all_finished and now < time_limit:
            return

        end_at = now if all_finished else time_limit
        for participant in participants:
            if not participant.saved:
                participant.save_session(
                    seconds=(end_at - self.started_at).total_seconds(),
                    correct=participant.correct,
                )

        self.status = "finished"
        self.finished_at = end_at
        self.save(update_fields=["status", "finished_at"])


class RaceParticipant(models.Model):
    race = models.ForeignKey(Race, on_delete=models.CASCADE, related_name="participants")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="race_participations"
    )
    correct = models.PositiveIntegerField(default=0)
    errors = models.PositiveIntegerField(default=0)
    finished_at = models.DateTimeField(null=True, blank=True)
    position = models.PositiveSmallIntegerField(null=True, blank=True)
    wpm = models.FloatField(default=0)
    accuracy = models.FloatField(default=0)
    saved = models.BooleanField(default=False)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("race", "user")]
        ordering = ["joined_at"]

    def __str__(self):
        return f"{self.user} in {self.race.code}"

    def record_progress(self, correct, errors, now):
        race = self.race
        total = len(race.text.body)
        self.correct = max(self.correct, min(correct, total))
        self.errors = max(self.errors, errors)

        if self.correct >= total and self.finished_at is None:
            self.finished_at = now
            self.position = race.participants.filter(finished_at__isnull=False).count() + 1
            seconds = (now - race.started_at).total_seconds()
            self.save_session(seconds=seconds, correct=total)
        else:
            self.save()

    def save_session(self, seconds, correct):
        race = self.race
        wpm, accuracy = calculate_metrics(correct, self.errors, seconds)
        TypingSession.objects.create(
            user=self.user,
            text=race.text,
            mode="race",
            lang=race.lang,
            correct_chars=correct,
            errors=self.errors,
            total_chars=len(race.text.body),
            seconds=seconds,
            wpm=wpm,
            accuracy=accuracy,
        )
        self.wpm = wpm
        self.accuracy = accuracy
        self.saved = True
        self.save()
