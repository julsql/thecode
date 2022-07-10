# -*- coding: utf8 -*-

# Application python qui génere des mots de passes avec une clef

## Application TheCode sur python

from math import log, floor
import tkinter as tk
from tkinter import filedialog
import os

alphabets = [
'pamqlsoziekdjfurythgnwbxvc', 'wqapmloikxszedcjuyhnvfrtgb', 'qaszdefrgthyjukilompcvbnxw',
'nhybgtvfrcdexszwqajuiklopm', 'mlkjhgfdsqwxcvbnpoiuytreza', 'ijnbhuygvcftrdxwsezqakolpm',
'poiuytrezamlkjhgfdsqnbvcxw', 'wxcvbnqsdfghjklmazertyuiop', 'unybtvrcexzwaqikolpmjhgfds',
'oplmkjuiytghbnvcfdrezasqxw', 'sezqadrftwxcgyvhubjinkolpm', 'jfkdlsmqhgpaozieurytvcbxnw',
'gftrhdyejsuzkqailompnwbxvc', 'frgthyjukilompnbvcxwedzsaq', 'gftryehdjsuziakqlopmnwbxvc',
'mlkjhgfdsqxecrvtbynuiopwza', 'pamqlsoziekdjfurythgnwbvcx', 'jklmuiopdfghertyqsazwxcvbn',
'vgfcbhdxnjwskiqazolmpertyu', 'onbivucyxtwrezapgjhklmfdsq', 'portezcviuxwhskyajgblndqfm',
'qposidufygthjreklzmawnxbvc', 'pwoxicuvbtynrmelzakjhgfdsq', 'hajzkelrmtgyfudisoqpnbvxcw',
'wqxscdvfbgnhjukilompytreza', 'thequickbrownfxjmpsvlazydg', 'abcdefghijklmnopqrstuvwxyz'
]

symboles = "@#&!)-_%;:*$+=/?<>&-?($*@#"
spec = {"à":"a", "â":"a", "é":"e", "è":"e", "ê":"e", "ë":"e", "î":"i", "ô":"o", "ö":"o", "ù":"u", "ç":"c"}

## Fonctions

def chiffre(site, a, b) -> str:
    '''Code le mot avec les clefs a et b'''
    alpha = alphabet(site[1])
    code = ""
    site = site.lower()
    alpha0 = alphabet(site[0])
    alpha1 = alphabet(alpha0[a%len(alpha0)])
    alpha2 = alphabet(alpha0[b%len(alpha0)])
    for i in range(len(site)):
        code += alpha1[(a*alpha2.index(site[i])+b)%26]
    return code

def lettre(site, clef):
    '''Code le mot avec la clef'''
    code = ""
    site = site.lower()
    clef = clef.lower()
    alpha1 = alphabet(site[1])
    alpha2 = alphabet(site[0])
    alpha = alphabet(clef[0])
    for i in range(len(site)):
        a = alpha2.index(site[i])
        b = alpha.index(clef[i%len(clef)])
        code += alpha1[(a+b) % 26]
    return code

def longueur(site):
    """rend un mot a la bonne longueur en evitant les repetitions"""
    site = site.lower()
    L = alphabet(site[0])
    site2 = ""
    for i in range(len(site)*2):
        if i%2 == 0:
            site2 += site[int(i/2)]
        else :
            site2 += L[int(i/2)]
    T = alphabet(site2[1])
    if len(site2)<=20:
        for i in range(20-len(site2)):
            site2 = site2 + T[i]
    else :
        site2 = site2[:20]
    return site2

def couleur(bits):
    """Donne la secutite suivant le nombre de bits"""
    if bits < 64 : secure = " Tres Faible "; couleur = "red"
    elif bits < 80 : secure = " Faible "; couleur = "red"
    elif bits < 100 : secure = " Moyenne "; couleur = "orange"
    elif bits < 128 : secure = " Forte "; couleur = "green"
    else : secure = " Tres Forte "; couleur = "green"
    return (secure, couleur)

couleur = lambda bits: (" Tres Faible ", "red") if bits < 64 else ((" Faible ", "red") if bits < 80 else ((" Moyenne ", "orange") if bits < 100 else ((" Forte ", "green") if bits < 128 else (" Tres Forte ", "green"))))

"""Genere un alphabet suivant la lettre donnee"""
alphabet = lambda lettre: alphabets[alphabets[-1].index(lettre)]

def complexification(code, min, maj, sym, chi, len2):
    '''Complexifie le mot de passe'''
    alpha1 = alphabet(code[0]).upper()
    alpha2 = alphabet(code[1])
    longueur = len(code)
    code2 = ""

    if min and not(maj) and not(sym) and not(chi):
        nb_carac = 26
        code2 = code

    elif not(min) and maj and not(sym) and not(chi):
        nb_carac = 26
        code2 = code.upper()

    elif not(min) and not(maj) and sym and not(chi):
        nb_carac = 26
        for i in range(longueur):
            lettrei = code[i]
            code2 = code2 + symboles[alpha2.index(lettrei)]

    elif not(min) and not(maj) and not(sym) and chi:
        nb_carac = 10
        for i in range(longueur):
            lettrei = code[i]
            code2 = code2 + str(alpha2.index(lettrei))

    elif min and maj and not(sym) and not(chi):
        nb_carac = 52
        for i in range(longueur):
            if i%2 == 0:
                code = code.lower()
                lettrei = code[i]
                code2 = code2 + lettrei
            else:
                code = code.upper()
                lettrei = code[i]
                code2 = code2 + lettrei

    elif min and not(maj) and sym and not(chi):
        nb_carac = 52
        for i in range(longueur):
            lettrei = code[i]
            if i%2 == 0:
                code2 = code2 + symboles[alpha2.index(lettrei)]
            else:
                code2 = code2 + lettrei

    elif min and not(maj) and not(sym):
        nb_carac = 36
        for i in range(longueur):
            lettrei = code[i]
            if i%2 == 0:
                code2 = code2 + lettrei
            else:
                code2 = code2 + str(alpha2.index(lettrei))

    elif not(min) and maj and sym and not(chi):
        nb_carac = 52
        code = code.upper()
        for i in range(longueur):
            lettrei = code[i]
            if i%2 == 0:
                code2 = code2 + symboles[alpha1.index(lettrei)]
            else:
                code2 = code2 + lettrei

    elif not(min) and maj and not(sym):
        nb_carac = 36
        code = code.upper()
        for i in range(longueur):
            lettrei = code[i]
            if i%2 == 0:
                code2 = code2 + lettrei
            else:
                code2 = code2 + str(alpha1.index(lettrei))

    elif not(min) and not(maj) and sym:
        nb_carac = 36
        for i in range(longueur):
            lettrei = code[i]
            if i%2 == 0:
                code2 = code2 + symboles[alpha2.index(lettrei)]
            else:
                code2 = code2 + str(alpha2.index(lettrei))

    elif min and maj and sym and not(chi):
        nb_carac = 78
        for i in range(longueur):
            if i%3 == 0:
                code = code.lower()
                lettrei = code[i]
                code2 = code2 + symboles[alpha2.index(lettrei)]
            elif i%3 == 1:
                code = code.lower()
                lettrei = code[i]
                code2 = code2 + lettrei
            else:
                code = code.upper()
                lettrei = code[i]
                code2 = code2 + lettrei

    elif not(min) and maj:
        nb_carac = 62
        for i in range(longueur):
            if i%3 == 0:
                code = code.lower()
                lettrei = code[i]
                code2 = code2 + str(alpha2.index(lettrei))
            elif i%3 == 1:
                code = code.lower()
                lettrei = code[i]
                code2 = code2 + symboles[alpha2.index(lettrei)]
            else:
                code = code.upper()
                lettrei = code[i]
                code2 = code2 + lettrei

    elif min and not(maj):
        nb_carac = 62
        for i in range(longueur):
            lettrei = code[i]
            if i%3 == 0:
                code2 = code2 + lettrei
            elif i%3 == 1:
                code2 = code2 + symboles[alpha2.index(lettrei)]
            else:
                code2 = code2 + str(alpha2.index(lettrei))

    elif min and not(sym):
        nb_carac = 62
        for i in range(longueur):
            if i%3 == 0:
                code = code.upper()
                lettrei = code[i]
                code2 = code2 + lettrei
            elif i%3 == 1:
                code = code.lower()
                lettrei = code[i]
                code2 = code2 + lettrei
            else:
                code = code.lower()
                lettrei = code[i]
                code2 = code2 + str(alpha2.index(lettrei))

    else:
        nb_carac = 88
        for i in range(longueur):
            if i%4 == 0:
                code = code.lower()
                lettrei = code[i]
                code2 = code2 + symboles[alpha2.index(lettrei)]
            elif i%4 == 1:
                code = code.lower()
                lettrei = code[i]
                code2 = code2 + lettrei
            elif i%4 == 2:
                code = code.lower()
                lettrei = code[i]
                code2 = code2 + str(alpha2.index(lettrei))
            else:
                code = code.upper()
                lettrei = code[i]
                code2 = code2 + lettrei
    code2 = code2[:len2]
    bits = int(round(log(nb_carac**len(code2))/log(2)))
    return (code2, "Securite :" + couleur(bits)[0] + str(bits) + " bits", bits, couleur(bits)[1])

def coder_fichier(fichier_source, fichier_sortie, long, minState, majState, symState, chiState, *keys):
    '''Prend en argument un fichier comportant des mots à coder et crée un nouveau fichier avec le mot à coder et le mot codé selon une clef affine de type Ax+B ou vigenere type chaine de caractère'''

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

    if len(keys) == 1:
        intro = "Codage : lettre\nclef : " + str(keys[0]) + "\n"
        for i in range(len(site)):
            site_code.append(complexification(lettre(longueur(site[i]), keys[0]), minState, majState, symState, chiState, long))
    else:
        intro = "Codage : chiffre\nclef a : " + str(keys[0]) + " , clef b : " + str(keys[1]) + "\n"
        for i in range(len(site)):
            site_code.append(complexification(chiffre(longueur(site[i]), keys[0], keys[1]), minState, majState, symState, chiState, long))

    with open (fichier_sortie,'w') as f:
        f.write(intro+ str(site_code[1][1]) +" \n \n")
        for i in range (len(site_code)):
            f.write(site[i] + ' :\n' + site_code[i][0] + '\n\n')

## Initialisations

minState = True
majState = True
symState = True
chiState = True
largeur = 200
scaleList = [10,14,20]
back = "#232726"
text = "white"

## Fonctions pour l'application

def Generer(event = None) :
    """Actions lorsque bouton generer clique"""
    minState, majState, symState, chiState = bool(int(minVar.get())), bool(int(majVar.get())), bool(int(symVar.get())), bool(int(chiVar.get()))

    site = siteEntry.get()
    clef = clefEntry.get()
    long = int(longvar.get())

    for key, valeur in spec.items():
        site = site.replace(key, valeur)
        clef = clef.replace(key, valeur)

    clef = clef.split("/")

    # Code avec un mot clef ou deux entiers
    try:
        if clefVar.get() == "Clef" : a = complexification(lettre(longueur(site), clef[0]), minState, majState, symState, chiState, long)
        else : a = complexification(chiffre(longueur(site), int(clef[0]), int(clef[1])), minState, majState, symState, chiState, long)

        # Affiche le mot de passe
        mdpEntry.delete(0,tk.END)
        mdpEntry.insert(0,a[0])

        # Affiche la securite du mot de passe
        safetyVar.set(a[1])
        safety.config(fg = a[3])

    except IndexError:
        mdpEntry.delete(0,tk.END)
        mdpEntry.insert(0,"Il manque des valeurs")

    except ValueError:
        mdpEntry.delete(0,tk.END)
        mdpEntry.insert(0,"Mauvaises valeurs")

# Bouton chiffre clique
def chiffreBut():
    """Actions lorsque bouton chiffreButton clique"""
    clefVar.set("Clefs A/B")
    clefEntry.delete(0,tk.END)

# Bouton lettre clique
def lettreBut():
    """Actions lorsque bouton lettreButton clique"""
    clefVar.set("Clef")
    clefEntry.delete(0,tk.END)

def scaleChange(value):
    """Lors de modification longScale, valeurs possibles : 10,14,20"""
    current = longScale.get()
    newvalue = min(scaleList, key = lambda x : abs(x-float(value)))
    longScale.set(newvalue)

def copy():
    root.clipboard_clear()
    root.clipboard_append(mdpEntry.get())
    print("Mot de passe collé dans le presse papier")

def importText():

    fichier_entree = filedialog.askopenfilename(title = "Choisissez un fichier comportant une liste de sites à coder",defaultextension = ".txt", filetypes = (("Texte", "*.txt"),))

    minState, majState, symState, chiState = bool(minVar.get()), bool(majVar.get()), bool(symVar.get()), bool(chiVar.get())

    fichier_sortie = ".".join(fichier_entree.split(".")[:-1]) + "_codé.txt"

    clef = clefEntry.get().split("/")
    long = int(longvar.get())

    try:
        if len(clef) == 1:
            coder_fichier(fichier_entree, fichier_sortie, long, minState, majState, symState, chiState, clef[0])
        else:
            coder_fichier(fichier_entree, fichier_sortie, long, minState, majState, symState, chiState, int(clef[0]), int(clef[1]))

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

def DarkMode():
    """Mode sombre ou lumineux"""
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
    safety.config(fg = back, bg = back)
    longScale.config(fg = text, bg = back)
    clefEntry.config(fg = text, bg = back, highlightbackground = back)
    siteEntry.config(fg = text, bg = back, highlightbackground = back)
    mdpEntry.config(fg = text, bg = back, highlightbackground = back)

    chiffreButton.config(highlightbackground = back)
    importer.config(highlightbackground = back)
    copy.config(highlightbackground = back)
    lettreButton.config(highlightbackground = back)
    generer.config(highlightbackground = back)

## fenêtre graphique de l'application

root = tk.Tk()
root.title('TheCode')

# Taille de la fenetre
fenetre = tk.Canvas(root, width = 400, height = 350)
fenetre.configure(bg = back)
fenetre.config(highlightthickness = 0)
fenetre.pack()

# Entry de texte avec label
siteLabel = tk.Label(root, text = 'Site')
siteEntry = tk.Entry (root)

clefVar = tk.StringVar()
clefLabel = tk.Label(root, text = 'Clef', textvariable = clefVar)
clefVar.set("Clef")

clefEntry = tk.Entry (root)
clefBEntry = tk.Entry (root)

longLabel = tk.Label(root, text = 'Longueur')
longvar = tk.IntVar()

longScale = tk.Scale(root,variable = longvar, orient = 'horizontal',length = 188, from_ = min(scaleList), to = max(scaleList), command = scaleChange)
longvar.set(max(scaleList))

mdpEntry = tk.Entry(root)

safetyVar = tk.StringVar()
safety = tk.Label(root, textvariable = safetyVar)

# Checkbuttons
minVar = tk.IntVar()
minCB  = tk.Checkbutton(root, text = 'minuscules', variable = minVar, onvalue = True, offvalue = False)
minCB.select()

majVar = tk.IntVar()
majCB  = tk.Checkbutton(root, text = 'majuscules', variable = majVar, onvalue = True, offvalue = False)
majCB.select()

symVar = tk.IntVar()
symCB  = tk.Checkbutton(root, text = 'symboles', variable = symVar, onvalue = True, offvalue = False)
symCB.select()

chiVar = tk.IntVar()
chiCB  = tk.Checkbutton(root, text = 'chiffres', variable = chiVar, onvalue=True, offvalue = False)
chiCB.select()

darkVar = tk.IntVar()
darkCheck = tk.Checkbutton(root, text = 'Mode\nsombre', variable = darkVar, onvalue=True, offvalue=False, command = DarkMode)
darkCheck.select()

# Boutons
generer = tk.Button(root, text = 'Generer', command = Generer, bg = back)
root.bind("<Return>", Generer)

chiffreButton = tk.Button(root, text = 'Chiffre', command = chiffreBut)
importer = tk.Button(root, text = 'Importer', command = importText)

lettreButton = tk.Button(root, text = 'Lettre', command = lettreBut)
copy = tk.Button(root, text = 'Copier', command = copy, bg = back)

# Creation des elements sur la fenetre
begin = 20
fenetre.create_window(100, begin, window = minCB)
fenetre.create_window(300, begin, window = majCB)
begin += 20
fenetre.create_window(100, begin, window = symCB)
fenetre.create_window(300, begin, window = chiCB)
begin += 30
fenetre.create_window(100, begin, window = chiffreButton)
fenetre.create_window(300, begin, window = lettreButton)
fenetre.create_window(200, begin, window = importer)
begin += 30
fenetre.create_window(largeur, begin, window = siteLabel)
begin += 20
fenetre.create_window(largeur, begin, window = siteEntry)
fenetre.create_window(50, begin, window = darkCheck)
begin += 30
fenetre.create_window(largeur, begin, window = clefLabel)
begin += 20
fenetre.create_window(largeur, begin, window = clefEntry)
begin += 30
fenetre.create_window(largeur, begin, window = longLabel)
begin += 30
fenetre.create_window(largeur, begin, window = longScale)
begin += 40
fenetre.create_window(largeur, begin, window = generer)
begin += 30
fenetre.create_window(largeur, begin, window = mdpEntry)
fenetre.create_window(350, begin, window=copy)
begin += 30
fenetre.create_window(largeur, begin, window = safety)

#  Coloration
DarkMode()

generer.pack_forget()

# Creation fenetre
root.configure(bg = back)
root.mainloop()