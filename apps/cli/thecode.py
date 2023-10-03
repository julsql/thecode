# -*- coding: utf8 -*-

# Application python qui génère des mots de passes avec une clef
# Application TheCode sur python

from math import log
import hashlib


# Fonctions
def get_safety(min_state, maj_state, sym_state, chi_state, longueur):
    """Donne la sécurité suivant le nombre de bits"""
    base = get_base(min_state, maj_state, sym_state, chi_state)

    nb_char = len(base)
    if nb_char == 0:
        bits = 0
    else:
        bits = int(round(log(nb_char ** longueur) / log(2)))

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

    while (x + 2) != 1:
        inter = x % b
        result = base[inter] + result
        x = (x // b) - 1

    return result


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


def code(site, clef, min_state, maj_state, sym_state, chi_state, longueur):
    """Renvoie le mot de passe issu du hachage du site salé avec la clef"""

    base = get_base(min_state, maj_state, sym_state, chi_state)

    if base == "":
        raise IndexError

    result_int = int(hashlib.sha256((site + clef).encode()).hexdigest(), 16)

    code2 = dec2base(result_int, base)[:longueur]
    safety, couleur, bits = get_safety(min_state, maj_state, sym_state, chi_state, longueur)

    return code2, safety, couleur, bits


def calculate_safety(bits):
    """Calcule la sécurité à partir des paramètres"""
    bits = int(bits)

    if bits < 42:
        longueur = 10
        min_state = False
        maj_state = False
        sym_state = False
        chi_state = True
    elif bits < 47:
        longueur = 10
        min_state = False
        maj_state = False
        sym_state = True
        chi_state = False
    elif bits < 48:
        longueur = 10
        min_state = True
        maj_state = False
        sym_state = False
        chi_state = False
    elif bits < 51:
        longueur = 10
        min_state = False
        maj_state = False
        sym_state = True
        chi_state = True
    elif bits < 55:
        longueur = 10
        min_state = True
        maj_state = False
        sym_state = False
        chi_state = True
    elif bits < 57:
        longueur = 10
        min_state = True
        maj_state = False
        sym_state = True
        chi_state = False
    elif bits < 61:
        longueur = 10
        min_state = True
        maj_state = True
        sym_state = False
        chi_state = False
    elif bits < 63:
        longueur = 10
        min_state = True
        maj_state = True
        sym_state = True
        chi_state = False
    elif bits < 66:
        longueur = 10
        min_state = True
        maj_state = True
        sym_state = True
        chi_state = True
    elif bits < 67:
        longueur = 14
        min_state = True
        maj_state = False
        sym_state = False
        chi_state = False
    elif bits < 72:
        longueur = 14
        min_state = False
        maj_state = False
        sym_state = True
        chi_state = True
    elif bits < 76:
        longueur = 14
        min_state = True
        maj_state = False
        sym_state = False
        chi_state = True
    elif bits < 80:
        longueur = 14
        min_state = True
        maj_state = False
        sym_state = True
        chi_state = False
    elif bits < 86:
        longueur = 14
        min_state = True
        maj_state = True
        sym_state = False
        chi_state = False
    elif bits < 88:
        longueur = 14
        min_state = True
        maj_state = True
        sym_state = True
        chi_state = False
    elif bits < 94:
        longueur = 14
        min_state = True
        maj_state = True
        sym_state = True
        chi_state = True
    elif bits < 95:
        longueur = 20
        min_state = True
        maj_state = False
        sym_state = False
        chi_state = False
    elif bits < 103:
        longueur = 20
        min_state = False
        maj_state = False
        sym_state = True
        chi_state = True
    elif bits < 109:
        longueur = 20
        min_state = True
        maj_state = False
        sym_state = False
        chi_state = True
    elif bits < 114:
        longueur = 20
        min_state = True
        maj_state = False
        sym_state = True
        chi_state = False
    elif bits < 115:
        longueur = 20
        min_state = True
        maj_state = True
        sym_state = False
        chi_state = False
    elif bits < 123:
        longueur = 20
        min_state = True
        maj_state = False
        sym_state = True
        chi_state = True
    elif bits < 126:
        longueur = 20
        min_state = True
        maj_state = True
        sym_state = True
        chi_state = False
    else:
        longueur = 20
        min_state = True
        maj_state = True
        sym_state = True
        chi_state = True

    return longueur, min_state, maj_state, sym_state, chi_state
