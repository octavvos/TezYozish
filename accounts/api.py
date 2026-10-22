import re

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from config.utils import json_error, parse_json

from .models import avatar_url_for

USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,30}$")
MIN_PASSWORD_LENGTH = 3
MAX_PASSWORD_LENGTH = 128


def user_payload(user):
    return {
        "authenticated": True,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "avatar": avatar_url_for(user),
    }


@require_http_methods(["POST"])
def register_api(request):
    data = parse_json(request)
    if data is None:
        return json_error("bad_request")

    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))
    first_name = str(data.get("first_name", "")).strip()
    last_name = str(data.get("last_name", "")).strip()

    if not USERNAME_RE.match(username):
        return json_error("username_invalid")
    if len(password) < MIN_PASSWORD_LENGTH:
        return json_error("password_short")
    if len(password) > MAX_PASSWORD_LENGTH:
        return json_error("password_long")
    if len(first_name) > 150 or len(last_name) > 150:
        return json_error("name_too_long")
    if User.objects.filter(username__iexact=username).exists():
        return json_error("username_taken", status=409)

    try:
        with transaction.atomic():
            user = User.objects.create_user(
                username=username,
                password=password,
                first_name=first_name,
                last_name=last_name,
            )
    except IntegrityError:
        return json_error("username_taken", status=409)

    login(request, user)
    return JsonResponse(user_payload(user), status=201)


@require_http_methods(["POST"])
def login_api(request):
    data = parse_json(request)
    if data is None:
        return json_error("bad_request")

    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))
    user = authenticate(request, username=username, password=password)
    if user is None:
        return json_error("invalid_credentials", status=401)

    login(request, user)
    return JsonResponse(user_payload(user))


@require_http_methods(["POST"])
def logout_api(request):
    logout(request)
    return JsonResponse({"authenticated": False})


@require_http_methods(["GET"])
def me_api(request):
    if not request.user.is_authenticated:
        return JsonResponse({"authenticated": False})
    return JsonResponse(user_payload(request.user))
