from django.shortcuts import render, redirect
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.urls import reverse_lazy
from django.views.generic import ListView, CreateView, UpdateView, DeleteView
from django.contrib import messages
from .forms import PrihlaseniForm, RegistraceForm, TagForm
from .models import Tag


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


class TagListView(LoginRequiredMixin, CreateView):
    model = Tag
    form_class = TagForm
    template_name = 'pomodoro/tagy.html'
    success_url = reverse_lazy('tagy')

    def get_queryset(self):
        return Tag.objects.filter(user=self.request.user).order_by('nazev')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['tagy'] = self.get_queryset()
        return ctx

    def form_valid(self, form):
        form.instance.user = self.request.user
        messages.success(self.request, f'Tag „{form.instance.nazev}" byl přidán.')
        return super().form_valid(form)

    def form_invalid(self, form):
        messages.error(self.request, 'Formulář obsahuje chyby.')
        return super().form_invalid(form)


class TagUpdateView(LoginRequiredMixin, UpdateView):
    model = Tag
    form_class = TagForm
    template_name = 'pomodoro/tag_edit.html'
    success_url = reverse_lazy('tagy')

    def get_queryset(self):
        return Tag.objects.filter(user=self.request.user)

    def form_valid(self, form):
        messages.success(self.request, f'Tag „{form.instance.nazev}" byl upraven.')
        return super().form_valid(form)


class TagDeleteView(LoginRequiredMixin, DeleteView):
    model = Tag
    template_name = 'pomodoro/tag_confirm_delete.html'
    success_url = reverse_lazy('tagy')

    def get_queryset(self):
        return Tag.objects.filter(user=self.request.user)

    def form_valid(self, form):
        messages.success(self.request, 'Tag byl smazán.')
        return super().form_valid(form)
