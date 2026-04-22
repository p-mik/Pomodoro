from django.apps import AppConfig


class PomodoroConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'pomodoro'

    def ready(self):
        import pomodoro.signals
