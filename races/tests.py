import json
from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from practice.models import TextSample, TypingSession

from .models import RACE_TIME_LIMIT_SECONDS, Race, RaceParticipant


def post_json(client, url, data=None):
    return client.post(url, data=json.dumps(data or {}), content_type="application/json")


class RaceFlowTests(TestCase):
    def setUp(self):
        self.host = User.objects.create_user("host", password="abc")
        self.guest = User.objects.create_user("guest", password="abc")
        self.text = TextSample.objects.create(lang="en", category="story", title="T", body="hello world")

    def create_race(self):
        self.client.force_login(self.host)
        response = post_json(self.client, "/api/races/", {"lang": "en", "category": "any", "max_players": 4})
        self.assertEqual(response.status_code, 201)
        return response.json()["code"]

    def test_full_race_saves_results_for_each_player(self):
        code = self.create_race()

        self.client.force_login(self.guest)
        self.assertEqual(post_json(self.client, f"/api/races/{code}/join/").status_code, 200)

        self.client.force_login(self.host)
        self.assertEqual(post_json(self.client, f"/api/races/{code}/start/").status_code, 200)

        # Sanoq davomida progress qabul qilinmaydi
        response = post_json(self.client, f"/api/races/{code}/progress/", {"correct": 3, "errors": 0})
        self.assertEqual(response.status_code, 409)

        # Vaqtni o'tkazib, poyga boshlanganini simulyatsiya qilamiz
        race = Race.objects.get(code=code)
        race.started_at = timezone.now() - timedelta(seconds=5)
        race.save(update_fields=["started_at"])

        response = post_json(self.client, f"/api/races/{code}/progress/", {"correct": 11, "errors": 1})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "running")

        self.client.force_login(self.guest)
        response = post_json(self.client, f"/api/races/{code}/progress/", {"correct": 11, "errors": 2})
        self.assertEqual(response.json()["status"], "finished")

        self.assertEqual(TypingSession.objects.filter(mode="race").count(), 2)
        host_row = RaceParticipant.objects.get(race=race, user=self.host)
        self.assertTrue(host_row.saved)
        self.assertEqual(host_row.position, 1)
        guest_row = RaceParticipant.objects.get(race=race, user=self.guest)
        self.assertEqual(guest_row.position, 2)

    def test_only_host_can_start_and_two_players_are_needed(self):
        code = self.create_race()
        self.client.force_login(self.host)
        response = post_json(self.client, f"/api/races/{code}/start/")
        self.assertEqual(response.json()["error"], "not_enough_players")

        self.client.force_login(self.guest)
        post_json(self.client, f"/api/races/{code}/join/")
        response = post_json(self.client, f"/api/races/{code}/start/")
        self.assertEqual(response.status_code, 403)

    def test_expired_race_saves_unfinished_players(self):
        code = self.create_race()
        self.client.force_login(self.guest)
        post_json(self.client, f"/api/races/{code}/join/")
        self.client.force_login(self.host)
        post_json(self.client, f"/api/races/{code}/start/")

        race = Race.objects.get(code=code)
        race.started_at = timezone.now() - timedelta(seconds=RACE_TIME_LIMIT_SECONDS + 10)
        race.save(update_fields=["started_at"])

        response = self.client.get(f"/api/races/{code}/")
        self.assertEqual(response.json()["status"], "finished")
        self.assertEqual(TypingSession.objects.filter(mode="race", user=self.host).count(), 1)

    def test_list_shows_only_waiting_races(self):
        code = self.create_race()
        self.client.force_login(self.guest)
        listing = self.client.get("/api/races/").json()["races"]
        self.assertEqual([r["code"] for r in listing], [code])

        post_json(self.client, f"/api/races/{code}/join/")
        self.client.force_login(self.host)
        post_json(self.client, f"/api/races/{code}/start/")
        listing = self.client.get("/api/races/").json()["races"]
        self.assertEqual(listing, [])

    def test_anonymous_user_cannot_create_race(self):
        response = post_json(self.client, "/api/races/", {"lang": "en", "category": "any", "max_players": 4})
        self.assertEqual(response.status_code, 401)
