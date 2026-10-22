from django.shortcuts import redirect, render
from django.urls import path

from . import api, profile_api


def profile_page(request):
    if not request.user.is_authenticated:
        return redirect("/login/?next=/profile/")
    return render(request, "accounts/profile.html")


def login_page(request):
    if request.user.is_authenticated:
        return redirect("practice:index")
    return render(request, "accounts/login.html")


def register_page(request):
    if request.user.is_authenticated:
        return redirect("practice:index")
    return render(request, "accounts/register.html")


app_name = "accounts"

urlpatterns = [
    path("login/", login_page, name="login"),
    path("register/", register_page, name="register"),
    path("profile/", profile_page, name="profile"),
    path("api/profile/", profile_api.profile_api, name="api_profile"),
    path("api/profile/avatar/", profile_api.avatar_api, name="api_avatar"),
    path("api/profile/password/", profile_api.password_api, name="api_password"),
    path("api/auth/register/", api.register_api, name="api_register"),
    path("api/auth/login/", api.login_api, name="api_login"),
    path("api/auth/logout/", api.logout_api, name="api_logout"),
    path("api/auth/me/", api.me_api, name="api_me"),
]
