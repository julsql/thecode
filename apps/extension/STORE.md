# TheCode — Fiches Chrome Web Store et Firefox Add-ons (AMO)

Document prêt à coller dans le tableau de bord du Chrome Web Store (aussi utilisé pour Edge et
Brave) et dans le Developer Hub de Firefox Add-ons. Les limites de caractères sont indiquées et
respectées. Le même texte sert aux deux boutiques.

---

## Français

### 1. Description courte — Chrome Web Store _(132 caractères max)_

```
Aucun mot de passe stocké, nulle part : chacun est recalculé à la demande depuis une seule clef maîtresse. Sans compte, hors ligne.
```

_(131 caractères)_

### 2. Résumé — Firefox Add-ons _(250 caractères max)_

```
Aucun mot de passe stocké, nulle part : TheCode recalcule chacun d'eux à la demande depuis une seule clef maîtresse et le nom du site. Carnet, compte et synchronisation facultatifs. Aussi sur iPhone, iPad, Mac, Android et le web.
```

_(229 caractères)_

### 3. Description détaillée _(Chrome : 16 000 caractères max ; Firefox : sans limite pratique)_

```
Vos mots de passe ne sont stockés NULLE PART. Ni dans le navigateur, ni sur un serveur, ni dans un coffre chiffré. TheCode recalcule chacun d'eux à la demande, à partir d'une seule clef maîtresse que vous seul connaissez et du nom du site.

C'est ce qui le distingue des autres gestionnaires : il n'existe aucune base de mots de passe à pirater, à perdre ou à faire fuiter.

UNE CLEF. UN MOT DE PASSE PAR SITE.
• Même clef + même site = exactement le même mot de passe, sur chaque appareil.
• Sites différents = mots de passe sans rapport entre eux.
• Rien à voler : aucun mot de passe n'est jamais enregistré.

La dérivation (PBKDF2 à 600 000 itérations, puis HMAC-SHA256) est documentée, testée et reproductible : vos mots de passe ne dépendent pas de la survie d'un service.

TOUT LE STOCKAGE EST FACULTATIF
L'extension fonctionne entièrement sans carnet, sans compte et sans synchronisation : une clef et le site ouvert suffisent.
• Carnet local (facultatif) : retenez pour chaque site l'identifiant, la longueur et les caractères voulus — jamais le mot de passe. Il reste dans le navigateur, verrouillé par un mot de passe dédié.
• Transfert sans compte : envoyez le carnet vers vos autres apps TheCode par QR code chiffré ou par fichier chiffré.
• Compte (facultatif) : synchronisation automatique du carnet et des réglages par défaut, chiffrée de bout en bout. Le serveur ne voit jamais votre clef maîtresse, ni vos sites, ni vos identifiants. Connexion par e-mail ou avec Google.

FONCTIONNALITÉS
• Le site ouvert est reconnu : le mot de passe s'affiche en un clic dans la fenêtre de l'extension
• Proposition du mot de passe directement dans les champs de connexion des pages
• Mot de passe masqué par défaut, copié d'un clic
• Longueur de 4 à 40 caractères, choix des minuscules, majuscules, chiffres, symboles
• Aucune publicité, aucun traceur, aucune mesure d'audience

CONFIDENTIALITÉ
• Votre clef maîtresse ne quitte jamais votre navigateur.
• Sans compte, l'extension ne contacte aucun serveur : tout fonctionne hors ligne.
• Avec un compte, le carnet est chiffré dans le navigateur avant d'être envoyé : le serveur ne voit ni vos sites, ni vos identifiants.
• L'accès aux pages sert uniquement à reconnaître le site et à proposer le mot de passe dans les champs de connexion ; rien n'est lu ni envoyé ailleurs.
• Code source ouvert sous licence Apache 2.0.

UN SEUL PROJET, SUR TOUS VOS APPAREILS
TheCode est un projet entièrement intégré et multiplateforme :
• Extensions pour Chrome, Firefox, Edge, Brave et Safari
• Apps iPhone et iPad
• App Mac
• Application Android
• Site thecode.julsql.fr
La même clef vous redonne les mêmes mots de passe sur chacun d'eux, même sans compte ni synchronisation.

SANS PUBLICITÉ
Aucune publicité, aucun traceur. La génération et le carnet fonctionnent sans compte ; un compte sert seulement à synchroniser vos appareils.

COMMENT ÇA MARCHE ?
1. Choisissez une clef maîtresse longue et mémorisez-la : elle ne peut pas être récupérée.
2. Ouvrez un site, puis l'extension : le site est déjà renseigné. Ajoutez l'identifiant si besoin.
3. Le mot de passe apparaît. Copiez-le, ou choisissez-le directement dans le champ de connexion.

Plus tard, sur n'importe quel appareil : même clef, même site → même mot de passe.
```

_(≈ 3 300 caractères)_

---

## English

### 1. Short description — Chrome Web Store _(max 132 characters)_

```
No password is ever stored, anywhere: each one is recomputed on demand from a single master key. No account needed, works offline.
```

_(130 characters)_

### 2. Summary — Firefox Add-ons _(max 250 characters)_

```
No password is ever stored, anywhere: TheCode recomputes each one on demand from a single master key and the site's name. Vault, account and sync are optional. Also on iPhone, iPad, Mac, Android and the web.
```

_(207 characters)_

### 3. Detailed description _(Chrome: max 16,000 characters; Firefox: no practical limit)_

```
Your passwords are stored NOWHERE. Not in the browser, not on a server, not in an encrypted vault. TheCode recomputes each one on demand, from a single master key only you know and the site's name.

That is what sets it apart from other password managers: there is no password database to hack, lose or leak.

ONE KEY. ONE PASSWORD PER SITE.
• Same key + same site = exactly the same password, on every device.
• Different sites = unrelated passwords.
• Nothing to steal: no password is ever saved.

The derivation (PBKDF2 with 600,000 iterations, then HMAC-SHA256) is documented, tested and reproducible: your passwords do not depend on any service staying alive.

ALL STORAGE IS OPTIONAL
The extension works fully without a vault, without an account and without sync: a key and the open site are all it needs.
• Local vault (optional): keep each site's username, length and characters — never the password. It stays in the browser, locked with a dedicated password.
• Transfer without an account: send the vault to your other TheCode apps with an encrypted QR code or an encrypted file.
• Account (optional): automatic sync of the vault and default settings, end-to-end encrypted. The server never sees your master key, your sites or your usernames. Sign in with email or Google.

FEATURES
• The open site is recognised: the password shows up in one click in the extension's window
• The password is offered right inside the pages' login fields
• Password masked by default, copied in one click
• Length from 4 to 40 characters; lowercase, uppercase, digits, symbols
• No ads, no trackers, no analytics

PRIVACY
• Your master key never leaves your browser.
• Without an account, the extension contacts no server: everything works offline.
• With an account, the vault is encrypted in the browser before it leaves: the server sees neither your sites nor your usernames.
• Page access is only used to recognise the site and offer the password in login fields; nothing is read or sent elsewhere.
• Open source under the Apache 2.0 licence.

ONE PROJECT, ON ALL YOUR DEVICES
TheCode is a fully integrated, cross-platform project:
• Extensions for Chrome, Firefox, Edge, Brave and Safari
• iPhone and iPad app
• Mac app
• Android app
• Website thecode.julsql.fr
The same key gives you the same passwords on each of them, even without an account or sync.

NO ADS
No ads, no trackers. Generation and the vault work without an account; an account is only used to sync your devices.

HOW IT WORKS
1. Pick a long master key and remember it: it cannot be recovered.
2. Open a site, then the extension: the site is already filled in. Add the username if needed.
3. The password appears. Copy it, or pick it right inside the login field.

Later, on any device: same key, same site → same password.
```

_(≈ 2 800 characters)_

---

## Informations communes / Shared details

| Champ / Field                        | Valeur / Value                                     |
| ------------------------------------ | -------------------------------------------------- |
| Catégorie Chrome / Chrome category   | Outils / Tools                                     |
| Catégorie Firefox / Firefox category | Confidentialité et sécurité / Privacy & Security   |
| Site web / Website                   | https://thecode.julsql.fr                          |
| Assistance / Support                 | https://thecode.julsql.fr/fr/contact               |
| Confidentialité / Privacy policy     | https://thecode.julsql.fr/fr/privacy — /en/privacy |
| Code source / Source code            | https://github.com/julsql/thecode                  |
| Licence / License                    | Apache 2.0                                         |

Pratiques de confidentialité (Chrome) et justification des permissions : voir
[`docs/store-privacy.md`](../../docs/store-privacy.md).
