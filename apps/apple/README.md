
TheCode - Extension iOS
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

Installation (Safari)
-----------------------------------
1. Ouvrez l'application dans Xcode
2. Branchez votre iPhone à votre Mac
3. Lancez l'application depuis Xcode
4. Il faudra peut être accepter les applications non signées `Général > VPN et gestion de l'appareil` et autoriser les applications de ce développeur

Sécurité & comportement
-----------------------
- **La clé maître n'est PAS persistée en clair.** Elle est dérivée et gardée en mémoire tant que le service worker est actif.
- **Les mots de passe générés ne sont jamais stockés.** Ils sont retournés au content script pour insertion dans le champ courant.

Remarques
---------
- MV3 service workers peuvent être démarrés/stoppés par le navigateur; si le worker se termine, la clé en mémoire sera perdue et vous devrez la réinitialiser via la popup.
- L'algorithme qui génère les mots de passe est unitairement testé.
