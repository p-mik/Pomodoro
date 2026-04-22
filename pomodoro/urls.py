from django.urls import path
from . import views, api

urlpatterns = [
    # Views
    path('', views.landing, name='landing'),
    path('prehled/', views.home, name='home'),
    path('prihlaseni/', views.prihlaseni, name='prihlaseni'),
    path('registrace/', views.registrace, name='registrace'),
    path('odhlasit/', views.odhlaseni, name='odhlaseni'),

    # API — Pomodoro
    path('api/pomodoro/start/', api.pomodoro_start, name='api_pomodoro_start'),
    path('api/pomodoro/active/', api.pomodoro_active, name='api_pomodoro_active'),
    path('api/pomodoro/', api.pomodoro_list, name='api_pomodoro_list'),
    path('api/pomodoro/<int:pk>/stop/', api.pomodoro_stop, name='api_pomodoro_stop'),

    # API — Settings
    path('api/settings/', api.settings_get, name='api_settings_get'),
    path('api/settings/update/', api.settings_update, name='api_settings_update'),

    # API — Tagy
    path('api/tags/', api.tag_list, name='api_tag_list'),

    # API — Push
    path('api/push/subscribe/', api.push_subscribe, name='api_push_subscribe'),
    path('api/push/heartbeat/', api.push_heartbeat, name='api_push_heartbeat'),

    # API — Statistiky
    path('api/stats/daily/', api.stats_daily, name='api_stats_daily'),
    path('api/stats/tags/', api.stats_tags, name='api_stats_tags'),
    path('api/stats/kpi/', api.stats_kpi, name='api_stats_kpi'),
    path('api/stats/export.csv', api.export_csv, name='api_export_csv'),

    # Statistiky stránka
    path('statistiky/', views.statistiky, name='statistiky'),
]
