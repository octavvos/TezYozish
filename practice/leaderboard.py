from datetime import timedelta

from django.db.models import Avg, Count, Max
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET

from config.utils import json_error

from .models import LANG_CHOICES, TypingSession

MIN_SESSIONS = 3
ROW_LIMIT = 50
PERIOD_DAYS = {"week": 7, "month": 30, "all": None}
VALID_LANGS = {code for code, _ in LANG_CHOICES}
VALID_MODES = {"all", "solo", "race"}


@require_GET
def leaderboard_api(request):
    lang = request.GET.get("lang", "all")
    mode = request.GET.get("mode", "all")
    period = request.GET.get("period", "week")
    if (lang != "all" and lang not in VALID_LANGS) or mode not in VALID_MODES or period not in PERIOD_DAYS:
        return json_error("bad_request")

    sessions = TypingSession.objects.all()
    if lang != "all":
        sessions = sessions.filter(lang=lang)
    if mode != "all":
        sessions = sessions.filter(mode=mode)
    days = PERIOD_DAYS[period]
    if days:
        sessions = sessions.filter(created_at__gte=timezone.now() - timedelta(days=days))

    rows = (
        sessions.order_by()
        .values("user_id", "user__username")
        .annotate(best_wpm=Max("wpm"), avg_accuracy=Avg("accuracy"), total=Count("id"))
        .filter(total__gte=MIN_SESSIONS)
        .order_by("-best_wpm", "-total")[:ROW_LIMIT]
    )

    my_id = request.user.id if request.user.is_authenticated else None
    return JsonResponse(
        {
            "min_sessions": MIN_SESSIONS,
            "rows": [
                {
                    "rank": rank,
                    "username": row["user__username"],
                    "best_wpm": round(row["best_wpm"], 1),
                    "avg_accuracy": round(row["avg_accuracy"] or 0, 1),
                    "sessions": row["total"],
                    "is_me": row["user_id"] == my_id,
                }
                for rank, row in enumerate(rows, start=1)
            ],
        }
    )
