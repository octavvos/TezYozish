from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("practice.urls")),
    path("", include("accounts.urls")),
    path("", include("races.urls")),
]
