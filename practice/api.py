from django.db.models import Avg, Count, Max
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_http_methods

from config.utils import api_login_required, json_error, parse_json

from .models import CATEGORY_CHOICES, LANG_CHOICES, LessonProgress, TextSample, TypingSession, calculate_metrics

VALID_LANGS = {code for code, _ in LANG_CHOICES}
VALID_CATEGORIES = {code for code, _ in CATEGORY_CHOICES}
LESSON_LEVEL_COUNT = 9


def text_payload(text):
    return {
        "id": text.id,
        "lang": text.lang,
        "category": text.category,
        "title": text.title,
        "body": text.body,
    }


def session_payload(session):
    return {
        "id": session.id,
        "mode": session.mode,
        "lang": session.lang,
        "title": session.text.title if session.text else "",
        "correct_chars": session.correct_chars,
        "errors": session.errors,
        "total_chars": session.total_chars,
        "seconds": round(session.seconds, 1),
        "wpm": session.wpm,
        "accuracy": session.accuracy,
        "created_at": session.created_at.isoformat(),
    }


@require_GET
def random_text_api(request):
    lang = request.GET.get("lang", "uz")
    category = request.GET.get("category", "any")
    if lang not in VALID_LANGS:
        return json_error("bad_request")

    texts = TextSample.objects.filter(lang=lang)
    if category != "any":
        if category not in VALID_CATEGORIES:
            return json_error("bad_request")
        texts = texts.filter(category=category)

    text = texts.order_by("?").first()
    if text is None:
        return json_error("no_text", status=404)
    return JsonResponse(text_payload(text))


@require_http_methods(["GET", "POST"])
@api_login_required
def sessions_api(request):
    if request.method == "GET":
        return history_response(request)

    data = parse_json(request)
    if data is None:
        return json_error("bad_request")

    try:
        text = TextSample.objects.get(pk=int(data.get("text_id", 0)))
        correct = int(data.get("correct_chars", -1))
        errors = int(data.get("errors", -1))
        seconds = float(data.get("seconds", 0))
    except (TypeError, ValueError, TextSample.DoesNotExist):
        return json_error("bad_request")

    total = len(text.body)
    if not (0 <= correct <= total) or errors < 0 or not (0 < seconds <= 3600):
        return json_error("bad_request")

    wpm, accuracy = calculate_metrics(correct, errors, seconds)
    session = TypingSession.objects.create(
        user=request.user,
        text=text,
        mode="solo",
        lang=text.lang,
        correct_chars=correct,
        errors=errors,
        total_chars=total,
        seconds=seconds,
        wpm=wpm,
        accuracy=accuracy,
    )
    return JsonResponse(session_payload(session), status=201)


def history_response(request):
    sessions = TypingSession.objects.filter(user=request.user).select_related("text")
    stats = sessions.aggregate(
        count=Count("id"),
        best_wpm=Max("wpm"),
        avg_wpm=Avg("wpm"),
        avg_accuracy=Avg("accuracy"),
    )
    return JsonResponse(
        {
            "summary": {
                "count": stats["count"],
                "best_wpm": round(stats["best_wpm"] or 0, 1),
                "avg_wpm": round(stats["avg_wpm"] or 0, 1),
                "avg_accuracy": round(stats["avg_accuracy"] or 0, 1),
            },
            "sessions": [session_payload(s) for s in sessions[:100]],
        }
    )


@require_http_methods(["GET", "POST"])
@api_login_required
def lesson_progress_api(request):
    if request.method == "GET":
        lang = request.GET.get("lang", "uz")
        if lang not in VALID_LANGS:
            return json_error("bad_request")
        rows = LessonProgress.objects.filter(user=request.user, lang=lang)
        return JsonResponse(
            {
                "levels": [
                    {"level": r.level, "completed": r.completed, "best_caught": r.best_caught}
                    for r in rows
                ]
            }
        )

    data = parse_json(request)
    if data is None:
        return json_error("bad_request")

    try:
        lang = str(data.get("lang", ""))
        level = int(data.get("level", -1))
        caught = int(data.get("caught", -1))
        total = int(data.get("total", -1))
        passed = bool(data.get("passed", False))
    except (TypeError, ValueError):
        return json_error("bad_request")

    if lang not in VALID_LANGS or not (0 <= level < LESSON_LEVEL_COUNT):
        return json_error("bad_request")
    if not (0 <= caught <= total) or total <= 0:
        return json_error("bad_request")

    progress, _ = LessonProgress.objects.get_or_create(user=request.user, lang=lang, level=level)
    progress.attempts += 1
    progress.best_caught = max(progress.best_caught, caught)
    progress.completed = progress.completed or passed
    progress.save()
    return JsonResponse(
        {"level": progress.level, "completed": progress.completed, "best_caught": progress.best_caught}
    )
