from django import forms


class CodeForm(forms.Form):
    clef = forms.CharField(
        required=True,
        label='Clef :',
        widget=forms.TextInput(attrs={'placeholder': 'clef', 'autofocus': True, 'type': "password"})
    )
    site = forms.CharField(
        required=True,
        label='Site :',
        widget=forms.TextInput(attrs={'placeholder': 'nom du site'})
    )
    longueur = forms.IntegerField(
        widget=forms.NumberInput(attrs={'type': 'range', 'min': '10', 'step': '5', 'max': '20', 'list': 'tickmarks'}), initial=20, label_suffix=" :")

    minuscules = forms.BooleanField(label="Minuscules", required=False, label_suffix="", widget=forms.CheckboxInput(attrs={'checked': True}))
    majuscules = forms.BooleanField(label="Majuscules", required=False, label_suffix="", widget=forms.CheckboxInput(attrs={'checked': True}))
    symboles = forms.BooleanField(label="Symboles", required=False, label_suffix="", widget=forms.CheckboxInput(attrs={'checked': True}))
    chiffres = forms.BooleanField(label="Chiffres", required=False, label_suffix="", widget=forms.CheckboxInput(attrs={'checked': True}))
