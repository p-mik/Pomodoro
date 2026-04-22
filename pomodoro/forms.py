from django import forms
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from django.contrib.auth.models import User


class PrihlaseniForm(AuthenticationForm):
    username = forms.CharField(
        label='Uživatelské jméno nebo e-mail',
        widget=forms.TextInput(attrs={'autofocus': True, 'class': 'form-control', 'placeholder': 'jméno nebo vas@email.cz'}),
    )
    password = forms.CharField(
        label='Heslo',
        widget=forms.PasswordInput(attrs={'class': 'form-control', 'placeholder': '••••••••'}),
    )
    remember_me = forms.BooleanField(required=False, label='Zapamatovat si mě (30 dní)')


class RegistraceForm(UserCreationForm):
    email = forms.EmailField(
        required=True,
        label='E-mail',
        widget=forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'vas@email.cz'}),
    )

    class Meta:
        model = User
        fields = ('username', 'email', 'password1', 'password2')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['username'].widget.attrs.update({'class': 'form-control', 'placeholder': 'uzivatelske_jmeno'})
        self.fields['password1'].widget.attrs.update({'class': 'form-control', 'placeholder': '••••••••'})
        self.fields['password2'].widget.attrs.update({'class': 'form-control', 'placeholder': '••••••••'})
        self.fields['username'].label = 'Uživatelské jméno'
        self.fields['password1'].label = 'Heslo'
        self.fields['password2'].label = 'Heslo znovu'

    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = self.cleaned_data['email']
        if commit:
            user.save()
        return user
