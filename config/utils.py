import json
from functools import wraps

from django.http import JsonResponse


def json_error(code, status=400):
    """Frontend `t()` funksiyasi shu kodni tarjima qiladi."""
    return JsonResponse({"error": code}, status=status)


def parse_json(request):
    try:
        data = json.loads(request.body or b"{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None
    return data if isinstance(data, dict) else None


def api_login_required(view):
    @wraps(view)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return json_error("login_required", status=401)
        return view(request, *args, **kwargs)

    return wrapper
