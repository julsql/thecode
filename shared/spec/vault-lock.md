# Verrou du carnet

La gestion du carnet (liste des entrées, paramètres d'une entrée, suppression,
renouvellement) n'est accessible qu'après authentification. Le verrou protège
l'**écran** de gestion, pas les données : le remplissage automatique et la
génération continuent de lire le carnet sans rien demander.

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
  `storage.session` ; site : le champ clef du générateur, en mémoire) : la clef
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
carnet se referme aussitôt. Verrouiller le carnet n'efface pas la clef de la
session.

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
