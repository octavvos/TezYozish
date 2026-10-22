import json

from django.contrib.auth.models import User
from django.test import TestCase

from .models import LessonProgress, TextSample, TypingSession, calculate_metrics


def post_json(client, url, data):
    return client.post(url, data=json.dumps(data), content_type="application/json")


class RegistrationTests(TestCase):
    def test_register_with_short_password_is_rejected(self):
        response = post_json(self.client, "/api/auth/register/", {"username": "ali", "password": "ab"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "password_short")

    def test_register_with_three_char_password_and_optional_names(self):
        response = post_json(self.client, "/api/auth/register/", {"username": "ali", "password": "abc"})
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(username="ali")
        self.assertEqual(user.first_name, "")
        self.assertTrue(user.check_password("abc"))

    def test_duplicate_username_is_case_insensitive(self):
        User.objects.create_user("Ali", password="abc")
        response = post_json(self.client, "/api/auth/register/", {"username": "ali", "password": "abc"})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"], "username_taken")

    def test_invalid_username_is_rejected(self):
        response = post_json(self.client, "/api/auth/register/", {"username": "a b", "password": "abc"})
        self.assertEqual(response.json()["error"], "username_invalid")

    def test_login_and_me(self):
        User.objects.create_user("ali", password="abc")
        response = post_json(self.client, "/api/auth/login/", {"username": "ali", "password": "abc"})
        self.assertEqual(response.status_code, 200)
        me = self.client.get("/api/auth/me/").json()
        self.assertTrue(me["authenticated"])
        self.assertEqual(me["username"], "ali")


class MetricsTests(TestCase):
    def test_metrics_formula(self):
        wpm, accuracy = calculate_metrics(correct_chars=50, errors=5, seconds=10)
        self.assertEqual(wpm, 60.0)
        self.assertEqual(accuracy, 90.9)


class SoloSessionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("ali", password="abc")
        self.text = TextSample.objects.create(lang="en", category="story", title="T", body="a" * 50)

    def test_anonymous_session_is_rejected(self):
        response = post_json(
            self.client,
            "/api/sessions/",
            {"text_id": self.text.id, "correct_chars": 50, "errors": 0, "seconds": 10},
        )
        self.assertEqual(response.status_code, 401)

    def test_session_is_saved_with_metrics(self):
        self.client.force_login(self.user)
        response = post_json(
            self.client,
            "/api/sessions/",
            {"text_id": self.text.id, "correct_chars": 50, "errors": 5, "seconds": 10},
        )
        self.assertEqual(response.status_code, 201)
        session = TypingSession.objects.get(user=self.user)
        self.assertEqual(session.mode, "solo")
        self.assertEqual(session.wpm, 60.0)

        history = self.client.get("/api/sessions/").json()
        self.assertEqual(history["summary"]["count"], 1)
        self.assertEqual(history["summary"]["best_wpm"], 60.0)

    def test_impossible_correct_count_is_rejected(self):
        self.client.force_login(self.user)
        response = post_json(
            self.client,
            "/api/sessions/",
            {"text_id": self.text.id, "correct_chars": 500, "errors": 0, "seconds": 10},
        )
        self.assertEqual(response.status_code, 400)


class LessonProgressTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("ali", password="abc")
        self.client.force_login(self.user)

    def test_passed_level_is_saved_and_kept(self):
        post_json(self.client, "/api/lessons/progress/", {"lang": "en", "level": 0, "caught": 25, "total": 30, "wrong": 2, "passed": True})
        post_json(self.client, "/api/lessons/progress/", {"lang": "en", "level": 0, "caught": 10, "total": 30, "wrong": 9, "passed": False})

        row = LessonProgress.objects.get(user=self.user, lang="en", level=0)
        self.assertTrue(row.completed)
        self.assertEqual(row.best_caught, 25)
        self.assertEqual(row.attempts, 2)
