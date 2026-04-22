from django.db import models
from django.contrib.auth.models import User


class Tag(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tags')
    nazev = models.CharField(max_length=50)
    barva = models.CharField(max_length=7, default='#6c757d')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'nazev'], name='unique_tag_per_user')
        ]

    def __str__(self):
        return f"{self.nazev} ({self.user.username})"


class UserSettings(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='settings')
    work_duration_sec = models.IntegerField(default=1500)
    short_break_sec = models.IntegerField(default=300)
    long_break_sec = models.IntegerField(default=900)
    long_break_every = models.IntegerField(default=4)
    sound_enabled = models.BooleanField(default=True)

    def __str__(self):
        return f"Nastavení — {self.user.username}"


class Pomodoro(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='pomodoros')
    started_at = models.DateTimeField(db_index=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    planned_duration_sec = models.IntegerField()
    actual_duration_sec = models.IntegerField(null=True, blank=True)
    tag = models.ForeignKey(Tag, on_delete=models.SET_NULL, null=True, blank=True)
    completed_normally = models.BooleanField(default=False)
    expiry_job_id = models.BigIntegerField(null=True, blank=True, db_index=True)
    push_sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'ended_at']),
        ]

    def __str__(self):
        return f"Pomodoro #{self.id} — {self.user.username} ({self.started_at:%Y-%m-%d %H:%M})"


class PushSubscription(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='push_subscriptions')
    endpoint = models.TextField(unique=True)
    p256dh = models.CharField(max_length=200)
    auth = models.CharField(max_length=50)
    device_label = models.CharField(max_length=100, blank=True)
    device_id = models.CharField(max_length=36, blank=True)
    last_heartbeat = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Push — {self.user.username} / {self.device_label[:30]}"
