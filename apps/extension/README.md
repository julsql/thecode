
TheCode - Extension
=======================================

TheCode est un générateur de mot de passe qui se base sur le site web et une clef pour générer un mot de passe.

Aucun besoin de stocker ou se souvenir du mot de passe ;
il suffi de retourner sur le site et donner la même clef pour retrouver le mot de passe.

Ainsi, il ne faut se souvenir que d'une clef unique pour avoir des mots de passe sécurisés,
différents sur chaque site et stockés nul part.

Objectif
---------
- Détecter les champs mot de passe sur une page et proposer un mot de passe généré.
- **Ne jamais stocker les mots de passe générés.**
- La clé maîtresse est fournie par l'utilisateur via la popup et **gardée en mémoire** (session) dans le background service worker.
- Un 'salt' non-secret issu du site web est stocké localement pour permettre la même dérivation si l'utilisateur souhaite réinitialiser la clé avec la même passphrase across restarts. (Optionnel)

Installation (Chrome / Edge / Brave)
-----------------------------------
1. Téléchargez et dézippez l'archive.
2. Ouvrez `chrome://extensions` (ou `edge://extensions`) et activez le Mode développeur.
3. Cliquez sur "Charger l'extension non empaquetée" et sélectionnez le dossier `password-suggester`.
4. Ouvrez l'extension (icône) et entrez votre clé de session. Tant que l'extension est active, la clé sera utilisée pour générer des mots de passe dérivés par site.

Installation (Firefox)
-----------------------------------
1. Téléchargez et dézippez l'archive.
2. Ouvrez `about:debugging#/runtime/this-firefox`.
3. Cliquez sur "Charger un module complémentaire temporaire" et sélectionnez le fichier `thecode-extension/manifest.json`.
4. Ouvrez l'extension (icône) et entrez votre clé de session. Tant que l'extension est active, la clé sera utilisée pour générer des mots de passe dérivés par site.

Installation (Safari)
-----------------------------------
1. Téléchargez et dézippez l'archive.
2. Activez le mode développeur
3. Allez dans `Safari > Réglage > Développeur` et cliquez sur "Ajouter une extension temporaire..." et et sélectionnez le fichier `thecode-extension`
4. Ouvrez l'extension (icône) et entrez votre clé de session. Tant que l'extension est active, la clé sera utilisée pour générer des mots de passe dérivés par site.

Sécurité & comportement
-----------------------
- **La clé maître n'est PAS persistée en clair.** Elle est dérivée et gardée en mémoire tant que le service worker est actif.
- **Les mots de passe générés ne sont jamais stockés.** Ils sont retournés au content script pour insertion dans le champ courant.

Adaptation / publication
------------------------
- Cette base fonctionne sur Chrome/Edge/Brave.
- Firefox supporte aussi WebExtensions; utilisez le manifest safari-firefox
- Pour Safari, utilisez le manifest safari-firefox puis empaquetez via Xcode.

Remarques
---------
- MV3 service workers peuvent être démarrés/stoppés par le navigateur; si le worker se termine, la clé en mémoire sera perdue et vous devrez la réinitialiser via la popup.
- L'algorithme qui génère les mots de passe est unitairement testé.
