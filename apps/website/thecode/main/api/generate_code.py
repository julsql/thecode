# -*- coding: utf8 -*-

# Application python qui génère des mots de passes avec une clef
# Application TheCode sur python

from math import log
import hashlib


def get_base(min_state, maj_state, sym_state, chi_state):
    """Modifie la base en fonction des caractères sélectionnés"""

    base = ""
    if min_state:
        base += "portezcviuxwhskyajgblndqfm"
    if maj_state:
        base += "THEQUICKBROWNFXJMPSVLAZYDG"
    if sym_state:
        base += "@#&!)-%;<:*$+=/?>("
    if chi_state:
        base += "567438921"
    return base


def get_bits(min_state, maj_state, sym_state, chi_state, longueur):
    base = get_base(min_state, maj_state, sym_state, chi_state)
    nb_char = len(base)
    if nb_char == 0:
        bits = 0
    else:
        bits = int(round(log(nb_char ** longueur) / log(2)))
    return bits


# Fonctions
def get_safety(bits):
    """Donne la sécurité suivant le nombre de bits"""

    if bits == 0:
        secure = " Aucune "
        couleur = "red"
    elif bits < 64:
        secure = " Très Faible "
        couleur = "red"
    elif bits < 80:
        secure = " Faible "
        couleur = "red"
    elif bits < 100:
        secure = " Moyenne "
        couleur = "orange"
    elif bits < 126:
        secure = " Forte "
        couleur = "green"
    else:
        secure = " Très Forte "
        couleur = "green"

    return "Sécurité :" + secure + str(bits) + " bits", couleur, bits


def dec2base(x, base):
    """Convertit x en base 10 en x en base"""

    b = len(base)
    result = base[x % b]
    x = (x // b) - 1
    while x > 0:
        inter = x % b
        result = base[inter] + result
        x = (x // b) - 1
    return result

def code(site, clef, min_state, maj_state, sym_state, chi_state, longueur):
    """Renvoie le mot de passe issu du hachage du site salé avec la clef"""

    base = get_base(min_state, maj_state, sym_state, chi_state)

    if base == "":
        raise IndexError

    result_int = int(hashlib.sha256((site + clef).encode()).hexdigest(), 16)
    code2 = dec2base(result_int, base)[:longueur]
    bits = get_bits(min_state, maj_state, sym_state, chi_state, longueur)
    safety, couleur, bits = get_safety(bits)

    return {"code": code2, "safety": safety, "couleur": couleur, "bits": bits}

def calculate_safety(bits):
    """Calcule la sécurité à partir des paramètres"""
    bits = int(bits)

    # Regroupement des règles dans une liste
    rules = [
        (42, 47, 10, False, False, True, False),
        (47, 48, 10, True, False, False, False),
        (48, 51, 10, False, False, True, True),
        (51, 55, 10, True, False, False, True),
        (55, 57, 10, True, False, True, False),
        (57, 61, 10, True, True, False, False),
        (61, 63, 10, True, True, True, False),
        (63, 66, 10, True, True, True, True),
        (66, 67, 14, True, False, False, False),
        (67, 72, 14, False, False, True, True),
        (72, 76, 14, True, False, False, True),
        (76, 80, 14, True, False, True, False),
        (80, 86, 14, True, True, False, False),
        (86, 88, 14, True, True, True, False),
        (88, 94, 14, True, True, True, True),
        (94, 95, 20, True, False, False, False),
        (95, 103, 20, False, False, True, True),
        (103, 109, 20, True, False, False, True),
        (109, 114, 20, True, False, True, False),
        (114, 115, 20, True, True, False, False),
        (115, 123, 20, True, False, True, True),
        (123, 126, 20, True, True, True, False),
        (126, float('inf'), 20, True, True, True, True),
    ]

    # Recherche de la règle correspondante
    for min_bits, max_bits, longueur, min_state, maj_state, sym_state, chi_state in rules:
        if min_bits <= bits < max_bits:
            return longueur, min_state, maj_state, sym_state, chi_state

    # Si aucune règle ne correspond (au cas où), renvoyer une valeur par défaut
    raise ValueError("Les bits fournis ne correspondent à aucune règle.")
