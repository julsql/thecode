import tkinter as tk
import thecode

# Initialisations des constantes
width = 400
height = 380
largeur = int(width / 2)
scale_long_list = [10, 14, 20]

back = "#232726"
text = "white"

min_state = True
maj_state = True
sym_state = True
chi_state = True
longueur = 20


def safe_scale_change(bits):
    """Lors de modification safeScale"""

    global longueur
    global min_state
    global maj_state
    global sym_state
    global chi_state

    longueur, min_state, maj_state, sym_state, chi_state = thecode.calculate_safety(bits)

    long_scale.set(longueur)
    min_var.set(min_state)
    maj_var.set(maj_state)
    sym_var.set(sym_state)
    chi_var.set(chi_state)

    generate()

    return None


def generate(*args):
    """Clique bouton générer
    Génère le mot de passe et l'écrit dans l'application"""

    mdp_entry.delete(0, tk.END)

    site = site_entry.get()
    clef = clef_entry.get()

    # Code avec un mot clef
    if not (site == "" or clef == "") and (min_state or maj_state or sym_state or chi_state):
        code, safety_txt, couleur, bits = thecode.code(site, clef, min_state, maj_state, sym_state, chi_state, longueur)
        mdp_entry.insert(0, code)
    else:
        safety_txt, couleur, bits = thecode.get_safety(min_state, maj_state, sym_state, chi_state, longueur)
        mdp_entry.insert(0, "Il manque des valeurs")

    # Affiche la sécurité du mot de passe
    safe_var.set(bits)
    safety_var.set(safety_txt)
    safety.config(fg=couleur)


def long_scale_change(value):
    """Lors de modification longScale, valeurs possibles : 10, 14, 20"""

    global longueur
    longueur = min(scale_long_list, key=lambda x: abs(x - float(value)))
    long_scale.set(longueur)
    generate()


def copy():
    """Clique sur bouton copier
    Copier mot de passe dans le presse-papier"""

    to_copy = mdp_entry.get()
    if (to_copy != "" and to_copy != "Il manque des valeurs"
            and to_copy != "Fichier non conforme" and to_copy != "Fichier traité"):
        root.clipboard_clear()
        root.clipboard_append(to_copy)
        print("Mot de passe copié dans le presse-papier")


def check():
    """Generate lorsque checkbutton modifié"""

    global min_state
    global maj_state
    global sym_state
    global chi_state

    min_state, maj_state, sym_state, chi_state = min_var.get(), maj_var.get(), sym_var.get(), chi_var.get()
    generate()


def dark_mode():
    """Clique sur checkButton Mode sombre,
    Mode sombre ou lumineux"""

    global back
    global text

    if dark_var.get() == 0:
        back = "white"
        text = "black"
    else:
        back = "#232726"
        text = "white"

    window.configure(bg=back)

    min_cb.config(fg=text, bg=back)
    maj_cb.config(fg=text, bg=back)
    sym_cb.config(fg=text, bg=back)
    chi_cb.config(fg=text, bg=back)
    dark_check.config(fg=text, bg=back)

    site_label.config(fg=text, bg=back)
    clef_label.config(fg=text, bg=back)
    long_label.config(fg=text, bg=back)
    safe_scale.config(fg=text, bg=back)
    safety.config(fg=back, bg=back)
    long_scale.config(fg=text, bg=back)
    clef_entry.config(fg=text, bg=back, highlightbackground=back)
    site_entry.config(fg=text, bg=back, highlightbackground=back)
    mdp_entry.config(fg=text, bg=back, highlightbackground=back)

    copy.config(highlightbackground=back)


# fenêtre graphique de l'application

root = tk.Tk()
root.title('TheCode')

# Taille de la fenetre
window = tk.Canvas(root, width=width, height=height)
window.configure(bg=back)
window.config(highlightthickness=0)
window.pack()

# Entry de texte avec label
site_label = tk.Label(root, text='Site')
site_on_change = tk.StringVar()
site_entry = tk.Entry(root, textvariable=site_on_change)

clef_var = tk.StringVar()
clef_label = tk.Label(root, text='Clef', textvariable=clef_var)
clef_var.set("Clef")

clef_on_change = tk.StringVar()
clef_entry = tk.Entry(root, textvariable=clef_on_change)

clef_on_change.trace('w', generate)
site_on_change.trace('w', generate)

long_label = tk.Label(root, text='Longueur')
long_var = tk.IntVar()

long_scale = tk.Scale(root, variable=long_var, orient='horizontal', length=188, from_=min(scale_long_list),
                      to=max(scale_long_list), command=long_scale_change)
long_var.set(max(scale_long_list))

safe_label = tk.Label(root, text='Longueur')
safe_var = tk.IntVar()

safe_scale = tk.Scale(root, variable=safe_var, orient='horizontal', length=188, from_=32, to=126,
                      command=safe_scale_change, showvalue=False)  # , state = "disabled")
safe_var.set(126)

mdp_entry = tk.Entry(root)

safety_var = tk.StringVar()
safety = tk.Label(root, textvariable=safety_var)
# safetyVar.set("Sécurité :")
# safety.config(fg = "white")

# Check buttons
min_var = tk.BooleanVar()
min_cb = tk.Checkbutton(root, text='minuscules', variable=min_var, onvalue=True, offvalue=False, command=check)
min_cb.select()

maj_var = tk.BooleanVar()
maj_cb = tk.Checkbutton(root, text='majuscules', variable=maj_var, onvalue=True, offvalue=False, command=check)
maj_cb.select()

sym_var = tk.BooleanVar()
sym_cb = tk.Checkbutton(root, text='symboles', variable=sym_var, onvalue=True, offvalue=False, command=check)
sym_cb.select()

chi_var = tk.BooleanVar()
chi_cb = tk.Checkbutton(root, text='chiffres', variable=chi_var, onvalue=True, offvalue=False, command=check)
chi_cb.select()

dark_var = tk.BooleanVar()
dark_check = tk.Checkbutton(root, text='Mode\nsombre', variable=dark_var, onvalue=True, offvalue=False,
                            command=dark_mode)
dark_check.select()

# Boutons
copy = tk.Button(root, text='Copier', command=copy, bg=back)

# Création des elements sur la fenêtre
begin = 20
window.create_window(100, begin, window=min_cb)
window.create_window(300, begin, window=maj_cb)
begin += 20
window.create_window(100, begin, window=sym_cb)
window.create_window(300, begin, window=chi_cb)
begin += 30
window.create_window(largeur, begin, window=clef_label)
begin += 20
window.create_window(largeur, begin, window=clef_entry)
window.create_window(50, begin, window=dark_check)
begin += 30
window.create_window(largeur, begin, window=site_label)
begin += 20
window.create_window(largeur, begin, window=site_entry)
begin += 30
window.create_window(largeur, begin, window=long_label)
begin += 30
window.create_window(largeur, begin, window=long_scale)
begin += 60
window.create_window(largeur, begin, window=mdp_entry)
window.create_window(350, begin, window=copy)
begin += 30
window.create_window(largeur, begin, window=safety)
begin += 30
window.create_window(largeur, begin, window=safe_scale)

#  Coloration
dark_mode()

# Creation fenetre
root.configure(bg=back)
root.mainloop()
