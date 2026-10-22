from django.shortcuts import render
from django.urls import path

from . import api

app_name = "practice"


def index(request):
    return render(request, "practice/index.html")


def practice_page(request):
    return render(request, "practice/practice.html")


def lessons_page(request):
    return render(request, "practice/lessons.html")


def history_page(request):
    return render(request, "practice/history.html")


urlpatterns = [
    path("", index, name="index"),
    path("practice/", practice_page, name="practice"),
    path("lessons/", lessons_page, name="lessons"),
    path("history/", history_page, name="history"),
    path("api/texts/random/", api.random_text_api, name="api_random_text"),
    path("api/sessions/", api.sessions_api, name="api_sessions"),
    path("api/lessons/progress/", api.lesson_progress_api, name="api_lesson_progress"),
]
