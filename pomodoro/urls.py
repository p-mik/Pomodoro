from django.urls import path
from . import views

urlpatterns = [
    path('', views.landing, name='landing'),
    path('prehled/', views.home, name='home'),
    path('prihlaseni/', views.prihlaseni, name='prihlaseni'),
    path('registrace/', views.registrace, name='registrace'),
    path('odhlasit/', views.odhlaseni, name='odhlaseni'),
]
