from django.shortcuts import redirect, render
from django.urls import path

from . import api


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
    path("api/auth/register/", api.register_api, name="api_register"),
    path("api/auth/login/", api.login_api, name="api_login"),
    path("api/auth/logout/", api.logout_api, name="api_logout"),
    path("api/auth/me/", api.me_api, name="api_me"),
]
