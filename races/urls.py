from django.shortcuts import render
from django.urls import path

from . import api

app_name = "races"


def lobby_page(request):
    return render(request, "races/lobby.html")


def room_page(request, code):
    return render(request, "races/room.html", {"race_code": code.upper()})


urlpatterns = [
    path("races/", lobby_page, name="lobby"),
    path("races/<str:code>/", room_page, name="room"),
    path("api/races/", api.races_api, name="api_races"),
    path("api/races/<str:code>/", api.race_detail_api, name="api_race_detail"),
    path("api/races/<str:code>/join/", api.race_join_api, name="api_race_join"),
    path("api/races/<str:code>/leave/", api.race_leave_api, name="api_race_leave"),
    path("api/races/<str:code>/start/", api.race_start_api, name="api_race_start"),
    path("api/races/<str:code>/progress/", api.race_progress_api, name="api_race_progress"),
]
