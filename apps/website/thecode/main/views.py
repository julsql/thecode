from django.shortcuts import render
from main.forms import CodeForm


# Create your views here.

def check_state(check):
    return bool(check)


def home(request):
    # ceci doit être une requête GET, donc créer un formulaire vide
    form = CodeForm()

    return render(request, 'main/home.html', {'form': form})


def app(request):
    return render(request, 'main/app.html', {'truc': None})

def privacy(request):
    return render(request, 'main/privacy.html')
