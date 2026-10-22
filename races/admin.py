from django.contrib import admin

from .models import Race, RaceParticipant


class RaceParticipantInline(admin.TabularInline):
    model = RaceParticipant
    extra = 0
    readonly_fields = ("joined_at",)


@admin.register(Race)
class RaceAdmin(admin.ModelAdmin):
    list_display = ("code", "status", "lang", "host", "max_players", "created_at")
    list_filter = ("status", "lang")
    inlines = [RaceParticipantInline]
