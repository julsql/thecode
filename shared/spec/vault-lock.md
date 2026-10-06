# Verrou du carnet

La gestion du carnet (liste des entrées, paramètres d'une entrée, suppression,
renouvellement) n'est accessible qu'après authentification. Le verrou protège
l'**écran** de gestion, pas les données : le remplissage automatique et la
génération continuent de lire le carnet sans rien demander.

Le bouton « Verrouiller », lui, ferme **toute la session** (voir
« Verrouiller » plus bas) : tant qu'elle est verrouillée, ni génération, ni
carnet, ni synchronisation.

Il n'existe **pas de mot de passe de carnet** : un seul secret, la clef
maîtresse. Le carnet s'ouvre avec la biométrie (apps natives) ou avec la clef
maîtresse elle-même.

## Apps : Android, iOS, macOS

- **biométrie ou code de l'appareil** (Face ID, Touch ID, empreinte, via l'OS),
  le code de l'appareil servant de repli comme le fait l'OS lui-même ;
- **sinon** (aucune biométrie ni code configuré) : ressaisie de la clef
  maîtresse, comparée **en temps constant** à celle déjà gardée dans le
  Keychain / Keystore.

### Une seule session avec la clef

La clef a déjà son verrou (biométrie, grâce de 3 minutes). Le carnet partage
**la même session** : déverrouiller la clef ouvre le carnet, déverrouiller le
carnet ouvre la clef, et la fenêtre de 3 minutes est commune.

L'écran carnet reste toujours **accessible** depuis l'écran principal, clef
verrouillée ou non : c'est lui qui demande le déverrouillage. Un bouton grisé
tant que la clef n'est pas déverrouillée n'explique rien.

## Extension et site

Pas de biométrie fiable dans un navigateur : déverrouiller, c'est **saisir la
clef maîtresse**.

- **Une clef est déjà définie dans la session** (extension :
  `storage.session` ; site : le champ clef du générateur, en mémoire — voir
  « Rechargement du site ») : la clef
  saisie doit être **la même**, comparée en temps constant. Une clef différente
  est refusée, avec l'indication que ce n'est pas la même clef que celle en
  cours d'utilisation.
- **Aucune clef définie** (nouvelle session du navigateur) : la clef saisie
  ouvre le carnet **et** devient la clef maîtresse de la session ; le
  générateur l'utilise ensuite.

Aucune empreinte de la clef maîtresse n'est jamais stockée, nulle part. Les
anciens enregistrements de verrou (`vaultLock` dans l'extension,
`thecode.vaultLock` sur le site) sont effacés au chargement.

## Session

Même fenêtre de grâce que la clef : **3 minutes**. Le carnet reste déverrouillé
tant qu'on y est ; quitter l'écran, passer l'app en arrière-plan, perdre le focus
ou fermer l'onglet fait courir la fenêtre. Revenu dans les 3 minutes, le carnet
est toujours ouvert ; au-delà, il redemande l'authentification. Sans clef
maîtresse dans la session, la grâce ne rouvre rien.

L'instant de sortie est retenu hors de l'écran (préférences de l'app, stockage de
session du navigateur) pour survivre à la fermeture de l'écran carnet. Il n'est
qu'un horodatage : aucun secret n'y est stocké. « Verrouiller » l'efface : le
carnet se referme aussitôt, et la grâce ne rouvre jamais une session
verrouillée.

### Rechargement du site

Recharger la page ne fait pas ressaisir la clef. Quand la page se ferme
(`pagehide`), le site confie la clef à `sessionStorage` — propre à l'onglet,
vidé à sa fermeture — avec l'instant de sortie. Au chargement suivant il la
reprend si moins de **3 minutes** se sont écoulées, et l'efface du stockage
dans tous les cas : elle n'y reste que le temps du rechargement, jamais
pendant que la page vit. Au-delà, ou onglet fermé, la clef est oubliée.

Une session verrouillée ou sans clef ne confie rien : après rechargement, il
n'y a plus de clef et la saisie suivante devient celle de la session.

## Verrouiller

« Verrouiller » verrouille **la session partout**, pas seulement l'écran
carnet. La clef maîtresse **n'est pas effacée**, mais elle devient
**inutilisable** jusqu'à la ré-authentification :

- plus de génération de mot de passe (écran principal, popup de l'extension,
  menu proposé dans les pages web) ;
- plus d'accès au carnet (liste, enregistrement, renouvellement,
  suppression, transfert) ;
- plus de synchronisation, ni manuelle ni automatique.

Ré-authentification :

- **apps natives** : biométrie ou code de l'appareil (repli : clef maîtresse),
  comme à l'ouverture de la session partagée (`SessionLock`) ;
- **extension et site** : ressaisie de la clef maîtresse, comparée **en temps
  constant** à la clef de la session. Une autre clef est refusée : « Ce n'est
  pas la même clef ». La bonne clef rouvre tout d'un coup.

Où le trouver :

- **extension** : dans l'écran carnet et dans l'en-tête de la popup. Verrouillée,
  la popup remplace le champ clef par un champ « Déverrouiller » ; le menu
  proposé dans les pages web affiche « TheCode est verrouillé : ouvrez
  l'extension pour le déverrouiller » à la place d'un mot de passe. L'état
  verrouillé vit à côté de la clef (`storage.session`) et survit au recyclage
  du service worker ;
- **site** : dans l'écran carnet et à côté du champ clef du générateur.
  Verrouillé, le générateur masque le mot de passe, la copie et
  l'enregistrement et propose de déverrouiller.

« Effacer » reste distinct : il **oublie** la clef (et le verrou avec elle).

## Clef oubliée

Il n'y a pas de mot de passe de carnet à oublier. Une clef maîtresse oubliée ne
peut pas être retrouvée : elle n'est stockée nulle part hors de l'appareil, et
les mots de passe comme le carnet chiffré en dépendent.

## Gestion

Une fois déverrouillé :

- liste des entrées non supprimées (libellé, identifiant, domaines), précédée
  du rappel : « Si vous ne voyez pas tous vos mots de passe, vérifiez que vous
  utilisez la même clef. » ;
- détail d'une entrée : `siteKey`, domaines, identifiant, longueur, jeux de
  caractères, compteur, date de mise à jour ;
- suppression, après confirmation : pierre tombale `deleted = true` et
  `updatedAt` à maintenant, pour que la suppression se propage à la
  synchronisation (voir vault-merge.md) ;
- le renouvellement existant reste disponible depuis le détail.
