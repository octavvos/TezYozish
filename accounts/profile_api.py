from django.conf import settings
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.models import User
from django.core.files.uploadedfile import UploadedFile
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from PIL import Image, UnidentifiedImageError

from config.utils import api_login_required, json_error, parse_json

from .api import MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, USERNAME_RE, user_payload
from .models import Profile

ALLOWED_IMAGE_FORMATS = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}


@require_http_methods(["GET", "POST"])
@api_login_required
def profile_api(request):
    if request.method == "GET":
        return JsonResponse(user_payload(request.user))

    data = parse_json(request)
    if data is None:
        return json_error("bad_request")

    user = request.user
    first_name = str(data.get("first_name", user.first_name)).strip()
    last_name = str(data.get("last_name", user.last_name)).strip()
    username = str(data.get("username", user.username)).strip()

    if len(first_name) > 150 or len(last_name) > 150:
        return json_error("name_too_long")
    if not USERNAME_RE.match(username):
        return json_error("username_invalid")
    if User.objects.filter(username__iexact=username).exclude(pk=user.pk).exists():
        return json_error("username_taken", status=409)

    user.first_name = first_name
    user.last_name = last_name
    user.username = username
    user.save(update_fields=["first_name", "last_name", "username"])
    return JsonResponse(user_payload(user))


@require_http_methods(["POST", "DELETE"])
@api_login_required
def avatar_api(request):
    profile, _ = Profile.objects.get_or_create(user=request.user)

    if request.method == "DELETE":
        if profile.avatar:
            profile.avatar.delete(save=False)
        profile.avatar = ""
        profile.save(update_fields=["avatar"])
        return JsonResponse(user_payload(request.user))

    upload = request.FILES.get("avatar")
    if upload is None:
        return json_error("bad_request")
    error = validate_avatar(upload)
    if error:
        return json_error(error)

    if profile.avatar:
        profile.avatar.delete(save=False)
    profile.avatar.save(f"{request.user.pk}.{upload_extension(upload)}", upload, save=False)
    profile.save(update_fields=["avatar"])
    return JsonResponse(user_payload(request.user))


def validate_avatar(upload: UploadedFile):
    if upload.size > settings.AVATAR_MAX_BYTES:
        return "avatar_too_large"
    try:
        image = Image.open(upload)
        image.verify()
        fmt = image.format
    except (UnidentifiedImageError, OSError):
        return "avatar_invalid"
    finally:
        upload.seek(0)
    if fmt not in ALLOWED_IMAGE_FORMATS:
        return "avatar_type"
    return None


def upload_extension(upload: UploadedFile):
    try:
        image = Image.open(upload)
        fmt = image.format
    finally:
        upload.seek(0)
    return ALLOWED_IMAGE_FORMATS[fmt]


@require_http_methods(["POST"])
@api_login_required
def password_api(request):
    data = parse_json(request)
    if data is None:
        return json_error("bad_request")

    current = str(data.get("current_password", ""))
    new = str(data.get("new_password", ""))
    if not request.user.check_password(current):
        return json_error("current_password_wrong", status=400)
    if len(new) < MIN_PASSWORD_LENGTH:
        return json_error("password_short")
    if len(new) > MAX_PASSWORD_LENGTH:
        return json_error("password_long")

    request.user.set_password(new)
    request.user.save(update_fields=["password"])
    update_session_auth_hash(request, request.user)
    return JsonResponse(user_payload(request.user))
