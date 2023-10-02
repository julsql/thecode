# -*- coding: utf8 -*-
from math import log, floor
import hashlib


def get_securite(base, longueur):
    """Donne la secutite suivant le nombre de bits"""

    nb_carac = len(base)
    if nb_carac == 0:
        bits = 0
    else:
        bits = int(round(log(nb_carac ** longueur) / log(2)))

    if bits == 0:
        secure = "Aucune"
        couleur = "#FE0101"
    elif bits < 64:
        secure = "Très Faible"
        couleur = "#FE0101"
    elif bits < 80:
        secure = "Faible"
        couleur = "#FE4501"
    elif bits < 100:
        secure = "Moyenne"
        couleur = "#FE7601"
    elif bits < 126:
        secure = "Forte"
        couleur = "#53FE38"
    else:
        secure = "Très Forte"
        couleur = "#1CD001"

    return secure, bits, couleur


def dec2base(i, base="portezcviuxwhskyajgblndqfm"):
    """Convertit i en base 10 en result en base len(base) avec la liste de caractères base"""
    l = len(base)
    result = base[i % l]
    i = (i // l) - 1

    while i > -1:
        i, result = (i // l) - 1, base[i % l] + result
    return result


def get_base(minState, majState, symState, chiState):
    """Modifie la base en fonction des caractères selectionnés"""

    base = ""
    if minState:
        base += "portezcviuxwhskyajgblndqfm"
    if majState:
        base += "THEQUICKBROWNFXJMPSVLAZYDG"
    if symState:
        base += "@#&!)-%;<:*$+=/?>("
    if chiState:
        base += "567438921"
    return base


def main(site, clef, longueur, minState, majState, symState, chiState):
    """Renvoie le mot de passe issus du hachage du site salé avec la clef"""

    base = get_base(minState, majState, symState, chiState)
    if base == "":
        return None, "Aucune", 0, "#FE0101"

    resultint = int(hashlib.sha256((site + clef).encode()).hexdigest(), 16)

    print("=========CODE HEXA==========")
    print(resultint)

    mdp = dec2base(resultint, base)[:longueur]

    print("=========CODE FINAL==========")
    print(mdp)

    securite, bits, couleur = get_securite(base, longueur)

    return mdp, securite, bits, couleur

