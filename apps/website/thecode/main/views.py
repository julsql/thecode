from django.shortcuts import render
from main.forms import CodeForm


# Create your views here.

def checkState(check):
    return bool(check)


def home(request):
    """
    if request.method == 'POST':
        # créer une instance de notre formulaire et le remplir avec les données POST
        form = CodeForm(request.POST)

        if form.is_valid():
            clef = request.POST.get('clef')
            site = request.POST.get('site')
            longueur = int(request.POST.get('longueur'))
            minuscules = checkState(request.POST.get('minuscules'))
            majuscules = checkState(request.POST.get('majuscules'))
            symboles = checkState(request.POST.get('symboles'))
            chiffres = checkState(request.POST.get('chiffres'))
            mdp, securite, bits, couleur = thecode.main(site, clef, longueur, minuscules, majuscules, symboles, chiffres)

            return render(request, 'main/home.html',
                          {'form': form, 'mdp': mdp, 'securite': securite, 'bits' : bits,
                           'couleur': couleur})  # ajoutez cette instruction de retour
        else:

            return render(request, 'main/home.html',
                          {'form': form})  # ajoutez cette instruction de retour

        # si le formulaire n'est pas valide, nous laissons l'exécution continuer jusqu'au return
        # ci-dessous et afficher à nouveau le formulaire (avec des erreurs).

    else:
    """
    # ceci doit être une requête GET, donc créer un formulaire vide
    form = CodeForm()

    return render(request, 'main/home.html', {'form': form})


def app(request):
    return render(request, 'main/app.html', {'truc': None})
