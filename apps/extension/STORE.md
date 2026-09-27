# TheCode — Fiches Chrome Web Store et addons.mozilla.org

Textes prêts à coller, en français puis en anglais. Le nom et la description courte de Chrome
viennent du manifeste (`_locales/*/messages.json`) : les changer là, pas dans le dashboard.

Justification des permissions, pratiques de confidentialité et notes pour les relecteurs :
[`docs/store-privacy.md`](../../docs/store-privacy.md).

Captures : 1280×800, 5 au maximum sur Chrome, les mêmes sur AMO.

Pas d'énumération de navigateurs ou de plateformes dans la description : le Chrome Web Store
la refuse comme « spam de mots-clés » (refus du 27 septembre 2026).

---

## 1. Nom

```
TheCode
```

## 2. Résumé

Chrome reprend `extension_description` du manifeste (132 caractères max). AMO accepte 250
caractères.

**Français** _(127 caractères)_

```
Mots de passe jamais stockés : recalculés depuis votre clef maîtresse. Carnet et synchro chiffrée en option. Partout les mêmes.
```

**English** _(123 characters)_

```
Passwords never stored: recomputed from your master key. Optional vault and encrypted sync. Same passwords on every device.
```

## 3. Description

**Français**

```
TheCode est un gestionnaire de mots de passe qui n'en stocke aucun. Chaque mot de passe est recalculé dans votre navigateur, à la demande, à partir d'une clef maîtresse que vous seul connaissez et du nom du site.

UNE CLEF. UN MOT DE PASSE PAR SITE.
• Même clef + même site = exactement le même mot de passe, sur chaque appareil.
• Sites différents = mots de passe sans rapport entre eux.
• Rien à voler : aucun mot de passe n'est enregistré, ni dans le navigateur, ni sur un serveur.

La dérivation (PBKDF2 à 600 000 itérations, puis HMAC-SHA256) est documentée, testée et reproductible : vos mots de passe ne dépendent pas de la survie d'un service.

FONCTIONNALITÉS
• Le mot de passe du site ouvert, calculé en un clic depuis la barre d'outils
• Proposé directement à côté des champs de mot de passe, pour l'identifiant saisi sur la page
• Carnet : retenez pour chaque site l'identifiant, la longueur et les caractères voulus — jamais le mot de passe
• Carnet verrouillé par votre clef maîtresse
• Longueur de 4 à 40 caractères, choix des minuscules, majuscules, chiffres, symboles
• Réglages par défaut retenus, et partagés entre vos appareils si vous avez un compte
• Transfert du carnet vers vos autres appareils par QR code chiffré
• Synchronisation automatique, chiffrée de bout en bout, facultative
• Connexion avec Google ou par adresse e-mail
• Aucune publicité, aucun traceur, aucune mesure d'audience

CONFIDENTIALITÉ
• Votre clef maîtresse ne quitte jamais votre appareil ; elle est effacée à la fermeture du navigateur.
• Sans compte, l'extension ne contacte aucun serveur : tout fonctionne hors ligne.
• Avec un compte, le carnet est chiffré dans le navigateur avant d'être envoyé : le serveur ne voit ni vos sites, ni vos identifiants.
• Le contenu des pages n'est jamais enregistré ni envoyé.
• Code source ouvert sous licence Apache 2.0.

PARTOUT, AVEC LA MÊME CLEF
TheCode existe aussi en application mobile et de bureau, et sur le site thecode.julsql.fr. La même clef vous redonne les mêmes mots de passe partout, même sans synchronisation.

GRATUIT
La génération, le carnet et le remplissage sont gratuits et illimités. Un compte gratuit synchronise quelques entrées sur trois appareils ; l'offre complète, sur thecode.julsql.fr, lève ces limites.

COMMENT ÇA MARCHE ?
1. Choisissez une clef maîtresse longue et mémorisez-la : elle ne peut pas être récupérée.
2. Ouvrez un site et cliquez sur l'icône TheCode, ou sur la suggestion à côté du champ de mot de passe.
3. Le mot de passe apparaît : insérez-le ou copiez-le.
```

**English**

```
TheCode is a password manager that stores none. Each password is recomputed in your browser, on demand, from a master key only you know and the name of the site.

ONE KEY. ONE PASSWORD PER SITE.
• Same key + same site = exactly the same password, on every device.
• Different sites = unrelated passwords.
• Nothing to steal: no password is saved, neither in the browser nor on a server.

The derivation (PBKDF2 with 600,000 iterations, then HMAC-SHA256) is documented, tested and reproducible: your passwords do not depend on a service staying alive.

FEATURES
• The password for the open site, computed in one click from the toolbar
• Offered right next to password fields, for the username typed on the page
• Vault: remember each site's username, length and characters — never the password
• Vault locked by your master key
• Length from 4 to 40 characters, choice of lowercase, uppercase, digits, symbols
• Default settings remembered, and shared across your devices if you have an account
• Vault transfer to your other devices through an encrypted QR code
• Automatic, end-to-end encrypted sync, optional
• Sign in with Google or with an email address
• No ads, no trackers, no analytics

PRIVACY
• Your master key never leaves your device; it is wiped when the browser closes.
• Without an account, the extension contacts no server: everything works offline.
• With an account, the vault is encrypted in the browser before it is sent: the server sees neither your sites nor your usernames.
• Page content is never stored or sent.
• Open source under the Apache 2.0 licence.

EVERYWHERE, WITH THE SAME KEY
TheCode also comes as a mobile and desktop app, and on the website thecode.julsql.fr. The same key gives you back the same passwords everywhere, even without sync.

FREE
Generation, the vault and filling are free and unlimited. A free account syncs a few entries across three devices; the complete plan, on thecode.julsql.fr, lifts those limits.

HOW IT WORKS
1. Pick a long master key and remember it: it cannot be recovered.
2. Open a site and click the TheCode icon, or the suggestion next to the password field.
3. The password appears: insert it or copy it.
```

## 4. Nouveautés de la version 3.0.0

AMO : « Notes de version ». Chrome n'a pas de champ dédié.

**Français**

```
• Nouvel algorithme de calcul (v2) : migrez vos mots de passe site par site. L'ancien (v1) reste disponible en génération ponctuelle
• Carnet en v2, avec un identifiant par compte, verrouillé par votre clef maîtresse
• Mot de passe proposé à côté des champs, pour l'identifiant saisi
• Synchronisation automatique, chiffrée de bout en bout
• Réglages par défaut partagés entre vos appareils
• Connexion avec Google
• Transfert du carnet par QR code chiffré
```

**English**

```
• New password algorithm (v2): migrate your passwords site by site. The previous one (v1) remains available for one-off generation
• v2 vault, with a username per account, locked by your master key
• Password offered next to the fields, for the username typed
• Automatic, end-to-end encrypted sync
• Default settings shared across your devices
• Sign in with Google
• Vault transfer through an encrypted QR code
```

## 5. Champs du dashboard

| Champ                           | Valeur                                              |
| ------------------------------- | --------------------------------------------------- |
| Catégorie Chrome                | Outils (Productivité)                               |
| Catégorie AMO                   | Confidentialité et sécurité                         |
| Étiquettes AMO                  | password manager, security, privacy                 |
| Site web / page d'accueil       | https://thecode.julsql.fr                           |
| Assistance (URL)                | https://thecode.julsql.fr/fr/contact                |
| Assistance (e-mail)             | contact@thecode.julsql.fr                           |
| Politique de confidentialité    | https://thecode.julsql.fr/fr/privacy                |
| Licence (AMO)                   | Apache License 2.0                                  |
| Version minimale de Firefox     | 140 (142 sur Android), fixée par le manifeste       |
| Notes pour les relecteurs (AMO) | `docs/store-privacy.md`, section addons.mozilla.org |
