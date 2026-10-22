import io
import json
import shutil
import tempfile

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image

from .models import Profile

MEDIA_DIR = tempfile.mkdtemp(prefix="tez-media-")


def make_png_bytes(size=(4, 4)):
    buffer = io.BytesIO()
    Image.new("RGB", size, (99, 102, 241)).save(buffer, format="PNG")
    return buffer.getvalue()


def post_json(client, url, data):
    return client.post(url, data=json.dumps(data), content_type="application/json")


@override_settings(MEDIA_ROOT=MEDIA_DIR)
class ProfileTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA_DIR, ignore_errors=True)

    def setUp(self):
        self.user = User.objects.create_user("ali", password="abc", first_name="Ali")
        self.other = User.objects.create_user("vali", password="abc")
        self.client.force_login(self.user)

    def test_anonymous_cannot_read_profile(self):
        self.client.logout()
        self.assertEqual(self.client.get("/api/profile/").status_code, 401)

    def test_user_can_change_name_and_username(self):
        response = post_json(self.client, "/api/profile/", {"first_name": "Akmal", "last_name": "Karimov", "username": "akmal_k"})
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual((self.user.first_name, self.user.last_name, self.user.username), ("Akmal", "Karimov", "akmal_k"))

    def test_username_must_be_unique_and_valid(self):
        response = post_json(self.client, "/api/profile/", {"first_name": "", "last_name": "", "username": "VALI"})
        self.assertEqual(response.json()["error"], "username_taken")
        response = post_json(self.client, "/api/profile/", {"first_name": "", "last_name": "", "username": "a b"})
        self.assertEqual(response.json()["error"], "username_invalid")

    def test_keeping_own_username_is_allowed(self):
        response = post_json(self.client, "/api/profile/", {"first_name": "X", "last_name": "", "username": "ali"})
        self.assertEqual(response.status_code, 200)

    def test_password_change_keeps_user_logged_in(self):
        response = post_json(self.client, "/api/profile/password/", {"current_password": "abc", "new_password": "xyz"})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(self.client.get("/api/auth/me/").json()["authenticated"])
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("xyz"))

    def test_wrong_current_password_is_rejected(self):
        response = post_json(self.client, "/api/profile/password/", {"current_password": "bad", "new_password": "xyz"})
        self.assertEqual(response.json()["error"], "current_password_wrong")

    def test_avatar_upload_is_saved_and_shown_in_me(self):
        upload = SimpleUploadedFile("me.png", make_png_bytes(), content_type="image/png")
        response = self.client.post("/api/profile/avatar/", {"avatar": upload})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["avatar"].startswith("/media/avatars/"))
        self.assertTrue(Profile.objects.get(user=self.user).avatar)

    def test_avatar_can_be_removed(self):
        upload = SimpleUploadedFile("me.png", make_png_bytes(), content_type="image/png")
        self.client.post("/api/profile/avatar/", {"avatar": upload})
        response = self.client.delete("/api/profile/avatar/")
        self.assertIsNone(response.json()["avatar"])

    def test_non_image_file_is_rejected(self):
        upload = SimpleUploadedFile("evil.png", b"not an image at all", content_type="image/png")
        response = self.client.post("/api/profile/avatar/", {"avatar": upload})
        self.assertEqual(response.json()["error"], "avatar_invalid")

    def test_gif_is_rejected(self):
        buffer = io.BytesIO()
        Image.new("RGB", (4, 4)).save(buffer, format="GIF")
        upload = SimpleUploadedFile("a.gif", buffer.getvalue(), content_type="image/gif")
        response = self.client.post("/api/profile/avatar/", {"avatar": upload})
        self.assertEqual(response.json()["error"], "avatar_type")
