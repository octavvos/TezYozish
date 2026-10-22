from django.contrib import admin

from .models import LessonProgress, TextSample, TypingSession


@admin.register(TextSample)
class TextSampleAdmin(admin.ModelAdmin):
    list_display = ("title", "lang", "category")
    list_filter = ("lang", "category")
    search_fields = ("title", "body")


@admin.register(TypingSession)
class TypingSessionAdmin(admin.ModelAdmin):
    list_display = ("user", "mode", "lang", "wpm", "accuracy", "created_at")
    list_filter = ("mode", "lang")
    search_fields = ("user__username",)


@admin.register(LessonProgress)
class LessonProgressAdmin(admin.ModelAdmin):
    list_display = ("user", "lang", "level", "completed", "best_caught")
    list_filter = ("lang", "completed")
