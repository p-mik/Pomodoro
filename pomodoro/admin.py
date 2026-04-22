from django.contrib import admin
from .models import Pomodoro, Tag, UserSettings, PushSubscription


@admin.register(Pomodoro)
class PomodoroAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'started_at', 'ended_at', 'planned_duration_sec', 'tag', 'completed_normally']
    list_filter = ['completed_normally', 'user']
    search_fields = ['user__username']
    date_hierarchy = 'started_at'


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ['nazev', 'barva', 'user']
    list_filter = ['user']
    search_fields = ['nazev', 'user__username']


@admin.register(UserSettings)
class UserSettingsAdmin(admin.ModelAdmin):
    list_display = ['user', 'work_duration_sec', 'short_break_sec', 'long_break_sec', 'long_break_every']


@admin.register(PushSubscription)
class PushSubscriptionAdmin(admin.ModelAdmin):
    list_display = ['user', 'device_label', 'last_heartbeat', 'created_at']
    list_filter = ['user']
