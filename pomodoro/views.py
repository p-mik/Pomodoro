from django.shortcuts import render, redirect
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from .forms import PrihlaseniForm, RegistraceForm


def landing(request):
    if request.user.is_authenticated:
        return redirect('home')
    return render(request, 'landing.html')


def prihlaseni(request):
    if request.user.is_authenticated:
        return redirect('home')
    if request.method == 'POST':
        form = PrihlaseniForm(request, data=request.POST)
        if form.is_valid():
            user = form.get_user()
            login(request, user)
            if form.cleaned_data.get('remember_me'):
                request.session.set_expiry(60 * 60 * 24 * 30)
            next_url = request.GET.get('next', 'home')
            return redirect(next_url)
    else:
        form = PrihlaseniForm(request)
    return render(request, 'pomodoro/prihlaseni.html', {'form': form})


def registrace(request):
    if request.user.is_authenticated:
        return redirect('home')
    if request.method == 'POST':
        form = RegistraceForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('home')
    else:
        form = RegistraceForm()
    return render(request, 'pomodoro/registrace.html', {'form': form})


def odhlaseni(request):
    if request.method == 'POST':
        logout(request)
    return redirect('landing')


@login_required
def home(request):
    return render(request, 'home.html')


@login_required
def statistiky(request):
    return render(request, 'statistiky.html')
