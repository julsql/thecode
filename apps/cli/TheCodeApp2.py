# -*- coding: utf8 -*-

# Application python qui génere des mots de passes avec une clef

## Application TheCode sur python

from math import log, floor
import tkinter as tk
from tkinter import filedialog
import os
import hashlib

## Initialisations

width = 400
height = 380
largeur = int(width / 2)
scaleLongList = [10,14,20]
back = "#232726"
text = "white"
minState = True
majState = True
symState = True
chiState = True
longueur = 20
base = ""

## Fonctions

def modifSecurite():
    """Donne la secutite suivant le nombre de bits"""

    nb_carac = len(base)
    if nb_carac == 0:
        bits = 0
    else:
        bits = int(round(log(nb_carac**longueur)/log(2)))

    if bits == 0 : secure = " Aucune "; couleur = "red"
    elif bits < 64 : secure = " Tres Faible "; couleur = "red"
    elif bits < 80 : secure = " Faible "; couleur = "red"
    elif bits < 100 : secure = " Moyenne "; couleur = "orange"
    elif bits < 126 : secure = " Forte "; couleur = "green"
    else : secure = " Tres Forte "; couleur = "green"

    safeVar.set(bits)

    return "Securite :" + secure + str(bits) + " bits", couleur


def dec2base(x, caracteres):
    """Convertit x en base 10 en x en base lon avec la liste de caractères caracteres"""

    lon = len(caracteres)
    result = caracteres[0]

    while x != 0:
        x, result = x // lon , caracteres[x % lon] + result

    return result

def modifBase():
    """Modifie la base en fonction des caractères séléctionnés"""

    global base
    base = ""
    if minState:
        base += "portezcviuxwhskyajgblndqfm"
    if majState:
        base += "THEQUICKBROWNFXJMPSVLAZYDG"
    if symState:
        base += "@#&!)-%;<:*$+=/?>("
    if chiState:
        base += "567438921"

def modifie(site, clef) :
    """Renvoie le mot de passe issus du hachage du site salé avec la clef"""

    if base == "":
        raise IndexError
        return None

    resultint = int(hashlib.sha256((site + clef).encode()).hexdigest(), 16)

    nb_carac = len(base)

    code2 = dec2base(resultint, base)[:longueur]

    securite, couleur = modifSecurite()

    return (code2, securite, couleur)


def coder_fichier(fichier_source, fichier_sortie, clef):
    """Prend en argument un fichier comportant des mots à coder et crée un nouveau fichier avec le mot à coder et le mot codé selon une clef"""

    if clef == "":
        raise IndexError
        return None

    site_code = []
    site = []
    with open (fichier_source, 'r') as f:
        i = f.readline()
        while i != "":
            if i != "\n":
                a = i.strip("\n").replace(' ', '')
                for k in range(10):
                    a.replace(str(k), "")
                site.append(a)
            i = f.readline()

    securite = str(modifie("test", "clef")[1])

    with open (fichier_sortie,'w') as f:
        f.write("Clef : " + str(clef) + "\n" + securite +" \n \n")

        for i in range(len(site)):
            code = modifie(site[i], clef)
            f.write(site[i] + ' :\n' + code[0] + '\n\n')

## Fonctions pour l'application

def Generer(event = None, a = None, c = None) :
    """Clique bouton generer
    Genere le mot de passe et l'ecrit dans l'application"""

    modifBase()

    mdpEntry.delete(0,tk.END)
    mdpEntry.insert(0,"Il manque des valeurs")

    site = siteEntry.get()
    clef = clefEntry.get()

    # Code avec un mot clef ou deux entiers
    if not (site == "" or clef == "") and (minState or majState or symState or chiState):
        a = modifie(site, clef)

        # Affiche le mot de passe
        mdpEntry.delete(0,tk.END)
        mdpEntry.insert(0,a[0])

    # Affiche la securite du mot de passe
    securite, couleur = modifSecurite()
    safetyVar.set(securite)
    safety.config(fg = couleur)


def longScaleChange(value):
    """Lors de modification longScale, valeurs possibles : 10, 14, 20"""

    global longueur
    longueur = min(scaleLongList, key = lambda x : abs(x-float(value)))
    longScale.set(longueur)
    Generer()

def safeScaleChange(bits):
    """Lors de modification safeScale"""

    bits = int(bits)

    global longueur
    global minState
    global majState
    global symState
    global chiState

    if bits < 42 :
        longueur = 10
        minState = False
        majState = False
        symState = False
        chiState = True
    elif bits < 47 :
        longueur = 10
        minState = False
        majState = False
        symState = True
        chiState = False
    elif bits < 48 :
        longueur = 10
        minState = True
        majState = False
        symState = False
        chiState = False
    elif bits < 51 :
        longueur = 10
        minState = False
        majState = False
        symState = True
        chiState = True
    elif bits < 55 :
        longueur = 10
        minState = True
        majState = False
        symState = False
        chiState = True
    elif bits < 57 :
        longueur = 10
        minState = True
        majState = False
        symState = True
        chiState = False
    elif bits < 61 :
        longueur = 10
        minState = True
        majState = True
        symState = False
        chiState = False
    elif bits < 63 :
        longueur = 10
        minState = True
        majState = True
        symState = True
        chiState = False
    elif bits < 66 :
        longueur = 10
        minState = True
        majState = True
        symState = True
        chiState = True
    elif bits < 67 :
        longueur = 14
        minState = True
        majState = False
        symState = False
        chiState = False
    elif bits < 72 :
        longueur = 14
        minState = False
        majState = False
        symState = True
        chiState = True
    elif bits < 76 :
        longueur = 14
        minState = True
        majState = False
        symState = False
        chiState = True
    elif bits < 80 :
        longueur = 14
        minState = True
        majState = False
        symState = True
        chiState = False
    elif bits < 86 :
        longueur = 14
        minState = True
        majState = True
        symState = False
        chiState = False
    elif bits < 88 :
        longueur = 14
        minState = True
        majState = True
        symState = True
        chiState = False
    elif bits < 94 :
        longueur = 14
        minState = True
        majState = True
        symState = True
        chiState = True
    elif bits < 95 :
        longueur = 20
        minState = True
        majState = False
        symState = False
        chiState = False
    elif bits < 103 :
        longueur = 20
        minState = False
        majState = False
        symState = True
        chiState = True
    elif bits < 109 :
        longueur = 20
        minState = True
        majState = False
        symState = False
        chiState = True
    elif bits < 114 :
        longueur = 20
        minState = True
        majState = False
        symState = True
        chiState = False
    elif bits < 115 :
        longueur = 20
        minState = True
        majState = True
        symState = False
        chiState = False
    elif bits < 123 :
        longueur = 20
        minState = True
        majState = False
        symState = True
        chiState = True
    elif bits < 126 :
        longueur = 20
        minState = True
        majState = True
        symState = True
        chiState = False
    else :
        longueur = 20
        minState = True
        majState = True
        symState = True
        chiState = True

    longScale.set(longueur)
    minVar.set(minState)
    majVar.set(majState)
    symVar.set(symState)
    chiVar.set(chiState)

    Generer()

    return None

def copy():
    """Clique sur bouton copier
    Copier mot de passe dans le presse papier"""

    toCopy = mdpEntry.get()
    if toCopy != "" and toCopy != "Il manque des valeurs" and toCopy != "Fichier non conforme" and toCopy != "Fichier traité":
        root.clipboard_clear()
        root.clipboard_append(toCopy)
        print("Mot de passe copié dans le presse-papier")


def importText():
    """Clique sur bouton importer
    Import un fichier de nom de sites et en renvoie un autre codé avec les paramètres"""

    fichier_entree = filedialog.askopenfilename(title = "Choisissez un fichier comportant une liste de sites à coder",defaultextension = ".txt", filetypes = (("Texte", "*.txt"),))

    fichier_sortie = ".".join(fichier_entree.split(".")[:-1]) + "_codé.txt"

    clef = clefEntry.get()

    try:
        coder_fichier(fichier_entree, fichier_sortie, clef)

        mdpEntry.delete(0,tk.END)
        mdpEntry.insert(0,"Fichier traité")
        os.popen("open " + fichier_sortie)

    except IndexError:
        mdpEntry.delete(0,tk.END)
        mdpEntry.insert(0,"Il manque des valeurs")

    except ValueError:
        mdpEntry.delete(0,tk.END)
        mdpEntry.insert(0,"Fichier non conforme")

    except FileNotFoundError:
        None

def check():
    """Generer lorsque checkbutton modifié"""

    global minState
    global majState
    global symState
    global chiState

    minState, majState, symState, chiState = minVar.get(), majVar.get(), symVar.get(), chiVar.get()

    Generer()


def DarkMode():
    """Clique sur checkButton Mode sombre
    Mode sombre ou lumineux"""

    if darkVar.get() == 0:
        back = "white"
        text = "black"
    else:
        back = "#232726"
        text = "white"

    fenetre.configure(bg = back)

    minCB.config(fg = text, bg = back)
    majCB.config(fg = text, bg = back)
    symCB.config(fg = text, bg = back)
    chiCB.config(fg = text, bg = back)
    darkCheck.config(fg = text, bg = back)

    siteLabel.config(fg = text, bg = back)
    clefLabel.config(fg = text, bg = back)
    longLabel.config(fg = text, bg = back)
    safeScale.config(fg = text, bg = back)
    safety.config(fg = back, bg = back)
    longScale.config(fg = text, bg = back)
    clefEntry.config(fg = text, bg = back, highlightbackground = back)
    siteEntry.config(fg = text, bg = back, highlightbackground = back)
    mdpEntry.config(fg = text, bg = back, highlightbackground = back)

    importer.config(highlightbackground = back)
    copy.config(highlightbackground = back)

## fenêtre graphique de l'application

root = tk.Tk()
root.title('TheCode')

# Taille de la fenetre
fenetre = tk.Canvas(root, width = width, height = height)
fenetre.configure(bg = back)
fenetre.config(highlightthickness = 0)
fenetre.pack()

# Entry de texte avec label
siteLabel = tk.Label(root, text = 'Site')
siteOnChange = tk.StringVar()
siteEntry = tk.Entry(root, textvariable = siteOnChange)

clefVar = tk.StringVar()
clefLabel = tk.Label(root, text = 'Clef', textvariable = clefVar)
clefVar.set("Clef")

clefOnChange = tk.StringVar()
clefEntry = tk.Entry(root, textvariable = clefOnChange)

clefOnChange.trace('w', Generer)
siteOnChange.trace('w', Generer)

longLabel = tk.Label(root, text = 'Longueur')
longVar = tk.IntVar()

longScale = tk.Scale(root, variable = longVar, orient = 'horizontal', length = 188, from_ = min(scaleLongList), to = max(scaleLongList), command = longScaleChange)
longVar.set(max(scaleLongList))

safeLabel = tk.Label(root, text = 'Longueur')
safeVar = tk.IntVar()

safeScale = tk.Scale(root, variable = safeVar, orient = 'horizontal', length = 188, from_ = 32, to = 126, command = safeScaleChange, showvalue = 0)#, state = "disabled")
safeVar.set(126)

mdpEntry = tk.Entry(root)

safetyVar = tk.StringVar()
safety = tk.Label(root, textvariable = safetyVar)

# Checkbuttons
minVar = tk.BooleanVar()
minCB  = tk.Checkbutton(root, text = 'minuscules', variable = minVar, onvalue = True, offvalue = False, command = check)
minCB.select()

majVar = tk.BooleanVar()
majCB  = tk.Checkbutton(root, text = 'majuscules', variable = majVar, onvalue = True, offvalue = False, command = check)
majCB.select()

symVar = tk.BooleanVar()
symCB  = tk.Checkbutton(root, text = 'symboles', variable = symVar, onvalue = True, offvalue = False, command = check)
symCB.select()

chiVar = tk.BooleanVar()
chiCB  = tk.Checkbutton(root, text = 'chiffres', variable = chiVar, onvalue=True, offvalue = False, command = check)
chiCB.select()

darkVar = tk.BooleanVar()
darkCheck = tk.Checkbutton(root, text = 'Mode\nsombre', variable = darkVar, onvalue=True, offvalue=False, command = DarkMode)
darkCheck.select()

# Boutons
importer = tk.Button(root, text = 'Importer', command = importText)

copy = tk.Button(root, text = 'Copier', command = copy, bg = back)

# Creation des elements sur la fenetre
begin = 20
fenetre.create_window(100, begin, window = minCB)
fenetre.create_window(300, begin, window = majCB)
begin += 20
fenetre.create_window(100, begin, window = symCB)
fenetre.create_window(300, begin, window = chiCB)
begin += 30
fenetre.create_window(200, begin, window = importer)
begin += 30
fenetre.create_window(largeur, begin, window = clefLabel)
begin += 20
fenetre.create_window(largeur, begin, window = clefEntry)
fenetre.create_window(50, begin, window = darkCheck)
begin += 30
fenetre.create_window(largeur, begin, window = siteLabel)
begin += 20
fenetre.create_window(largeur, begin, window = siteEntry)
begin += 30
fenetre.create_window(largeur, begin, window = longLabel)
begin += 30
fenetre.create_window(largeur, begin, window = longScale)
begin += 60
fenetre.create_window(largeur, begin, window = mdpEntry)
fenetre.create_window(350, begin, window=copy)
begin += 30
fenetre.create_window(largeur, begin, window = safety)
begin += 30
fenetre.create_window(largeur, begin, window = safeScale)

#  Coloration
DarkMode()

# Creation fenetre
root.configure(bg = back)
root.mainloop()