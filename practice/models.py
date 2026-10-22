from django.conf import settings
from django.db import models

LANG_CHOICES = [
    ("uz", "O'zbekcha"),
    ("ru", "Русский"),
    ("en", "English"),
]

CATEGORY_CHOICES = [
    ("story", "story"),
    ("computer", "computer"),
    ("literature", "literature"),
]


def calculate_metrics(correct_chars, errors, seconds):
    """
    WPM: 1 so'z = 5 belgi. Aniqlik: to'g'ri belgilar / (to'g'ri + xato) bosish.
    """
    if seconds <= 0:
        return 0.0, 0.0
    minutes = seconds / 60
    wpm = (correct_chars / 5) / minutes
    total_presses = correct_chars + errors
    accuracy = (correct_chars / total_presses * 100) if total_presses else 0.0
    return round(wpm, 1), round(accuracy, 1)


class TextSample(models.Model):
    lang = models.CharField(max_length=2, choices=LANG_CHOICES, db_index=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, db_index=True)
    title = models.CharField(max_length=120)
    body = models.TextField()

    class Meta:
        ordering = ["lang", "category", "title"]

    def __str__(self):
        return f"[{self.lang}/{self.category}] {self.title}"


class TypingSession(models.Model):
    MODE_CHOICES = [
        ("solo", "solo"),
        ("race", "race"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sessions"
    )
    text = models.ForeignKey(TextSample, on_delete=models.SET_NULL, null=True, blank=True)
    mode = models.CharField(max_length=10, choices=MODE_CHOICES, default="solo")
    lang = models.CharField(max_length=2, choices=LANG_CHOICES)
    correct_chars = models.PositiveIntegerField(default=0)
    errors = models.PositiveIntegerField(default=0)
    total_chars = models.PositiveIntegerField(default=0)
    seconds = models.FloatField(default=0)
    wpm = models.FloatField(default=0)
    accuracy = models.FloatField(default=0)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} {self.mode} {self.wpm} wpm"


class LessonProgress(models.Model):
    """Tez yozish darslari (o'yin darajalari) bo'yicha foydalanuvchi natijasi."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="lesson_progress"
    )
    lang = models.CharField(max_length=2, choices=LANG_CHOICES)
    level = models.PositiveSmallIntegerField()
    completed = models.BooleanField(default=False)
    best_caught = models.PositiveIntegerField(default=0)
    attempts = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("user", "lang", "level")]
        ordering = ["lang", "level"]

    def __str__(self):
        return f"{self.user} {self.lang} L{self.level}"
