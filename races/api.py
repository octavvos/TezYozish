from datetime import timedelta

from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_http_methods

from config.utils import api_login_required, json_error, parse_json
from practice.models import LANG_CHOICES, TextSample

from .models import (
    MAX_PLAYERS,
    MIN_PLAYERS_TO_START,
    RACE_COUNTDOWN_SECONDS,
    RACE_TIME_LIMIT_SECONDS,
    Race,
    RaceParticipant,
)

VALID_LANGS = {code for code, _ in LANG_CHOICES}


def race_card(race):
    return {
        "code": race.code,
        "lang": race.lang,
        "category": race.text.category,
        "host": race.host.username if race.host else None,
        "players": race.participants.count(),
        "max_players": race.max_players,
        "created_at": race.created_at.isoformat(),
    }


def race_state(race, user, now):
    participants = race.participants.select_related("user")
    total = len(race.text.body)
    return {
        "code": race.code,
        "status": race.status,
        "lang": race.lang,
        "category": race.text.category,
        "title": race.text.title,
        "text": race.text.body,
        "total_chars": total,
        "max_players": race.max_players,
        "host": race.host.username if race.host else None,
        "is_host": race.host_id == user.id,
        "is_member": participants.filter(user=user).exists(),
        "server_time": now.isoformat(),
        "started_at": race.started_at.isoformat() if race.started_at else None,
        "countdown_seconds": RACE_COUNTDOWN_SECONDS,
        "time_limit": RACE_TIME_LIMIT_SECONDS,
        "min_players": MIN_PLAYERS_TO_START,
        "participants": [
            {
                "username": p.user.username,
                "correct": p.correct,
                "errors": p.errors,
                "total": total,
                "finished": p.finished_at is not None,
                "position": p.position,
                "wpm": p.wpm,
                "accuracy": p.accuracy,
                "is_me": p.user_id == user.id,
            }
            for p in participants
        ],
    }


def get_race(code):
    return Race.objects.select_related("text", "host").filter(code=code.upper()).first()


def leave_other_waiting_races(user):
    """Foydalanuvchi bir vaqtda faqat bitta kutish xonasida tura oladi."""
    waiting = RaceParticipant.objects.filter(user=user, race__status="waiting")
    for participant in waiting.select_related("race"):
        remove_participant(participant)


def remove_participant(participant):
    race = participant.race
    participant.delete()
    remaining = race.participants.order_by("joined_at")
    if not remaining.exists():
        race.delete()
        return
    if race.host_id == participant.user_id:
        race.host = remaining.first().user
        race.save(update_fields=["host"])


@require_http_methods(["GET", "POST"])
@api_login_required
def races_api(request):
    if request.method == "GET":
        races = (
            Race.objects.filter(status="waiting")
            .select_related("text", "host")
            .order_by("-created_at")[:50]
        )
        return JsonResponse({"races": [race_card(r) for r in races if not r.is_full]})

    data = parse_json(request)
    if data is None:
        return json_error("bad_request")

    lang = str(data.get("lang", "uz"))
    category = str(data.get("category", "any"))
    try:
        max_players = int(data.get("max_players", 4))
    except (TypeError, ValueError):
        return json_error("bad_request")

    if lang not in VALID_LANGS or not (2 <= max_players <= MAX_PLAYERS):
        return json_error("bad_request")

    texts = TextSample.objects.filter(lang=lang)
    if category != "any":
        texts = texts.filter(category=category)
    text = texts.order_by("?").first()
    if text is None:
        return json_error("no_text", status=404)

    with transaction.atomic():
        leave_other_waiting_races(request.user)
        race = Race.objects.create(
            host=request.user,
            lang=lang,
            text=text,
            max_players=max_players,
        )
        RaceParticipant.objects.create(race=race, user=request.user)

    return JsonResponse(race_state(race, request.user, timezone.now()), status=201)


@require_GET
@api_login_required
def race_detail_api(request, code):
    race = get_race(code)
    if race is None:
        return json_error("race_not_found", status=404)
    now = timezone.now()
    race.settle(now)
    return JsonResponse(race_state(race, request.user, now))


@require_http_methods(["POST"])
@api_login_required
def race_join_api(request, code):
    race = get_race(code)
    if race is None:
        return json_error("race_not_found", status=404)
    if race.status != "waiting":
        return json_error("race_started", status=409)

    with transaction.atomic():
        if not race.participants.filter(user=request.user).exists():
            if race.is_full:
                return json_error("race_full", status=409)
            leave_other_waiting_races(request.user)
            RaceParticipant.objects.create(race=race, user=request.user)

    return JsonResponse(race_state(race, request.user, timezone.now()))


@require_http_methods(["POST"])
@api_login_required
def race_leave_api(request, code):
    race = get_race(code)
    if race is None:
        return json_error("race_not_found", status=404)
    if race.status != "waiting":
        return json_error("race_started", status=409)

    participant = race.participants.filter(user=request.user).first()
    if participant:
        remove_participant(participant)
    return JsonResponse({"ok": True})


@require_http_methods(["POST"])
@api_login_required
def race_start_api(request, code):
    race = get_race(code)
    if race is None:
        return json_error("race_not_found", status=404)
    if race.host_id != request.user.id:
        return json_error("not_host", status=403)
    if race.status != "waiting":
        return json_error("race_started", status=409)
    if race.participants.count() < MIN_PLAYERS_TO_START:
        return json_error("not_enough_players", status=409)

    now = timezone.now()
    race.status = "running"
    race.started_at = now + timedelta(seconds=RACE_COUNTDOWN_SECONDS)
    race.save(update_fields=["status", "started_at"])
    return JsonResponse(race_state(race, request.user, now))


@require_http_methods(["POST"])
@api_login_required
def race_progress_api(request, code):
    race = get_race(code)
    if race is None:
        return json_error("race_not_found", status=404)

    data = parse_json(request)
    if data is None:
        return json_error("bad_request")
    try:
        correct = int(data.get("correct", 0))
        errors = int(data.get("errors", 0))
    except (TypeError, ValueError):
        return json_error("bad_request")
    if correct < 0 or errors < 0:
        return json_error("bad_request")

    participant = race.participants.filter(user=request.user).first()
    if participant is None:
        return json_error("not_member", status=403)

    now = timezone.now()
    race.settle(now)
    if race.status != "running":
        return JsonResponse(race_state(race, request.user, now))
    if now < race.started_at:
        return json_error("not_started", status=409)

    participant.record_progress(correct, errors, now)
    race.settle(now)
    return JsonResponse(race_state(race, request.user, now))
