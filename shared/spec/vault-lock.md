# Verrou du carnet

La gestion du carnet (liste des entrées, paramètres d'une entrée, suppression,
renouvellement) n'est accessible qu'après authentification. Le verrou protège
l'**écran** de gestion, pas les données : le remplissage automatique et la
génération continuent de lire le carnet sans rien demander.

## Première ouverture

À la première ouverture de l'écran carnet sur un appareil, on fait choisir la
méthode :

- **biométrie disponible** (Face ID, Touch ID, empreinte, via l'OS) : choix entre
  biométrie et mot de passe de carnet ;
- **sinon** : création obligatoire d'un mot de passe de carnet (saisi deux fois,
  8 caractères minimum).

La biométrie choisie garde le mot de passe de l'appareil de l'OS en repli, comme
le fait l'OS lui-même. Le site et l'extension n'ont pas accès à une biométrie
fiable : mot de passe uniquement.

Le choix est **local à l'appareil** et n'est jamais synchronisé : le serveur ne
voit ni la méthode ni le mot de passe.

## Stockage du mot de passe de carnet

Jamais en clair. On garde :

```
salt = 16 octets aléatoires
hash = PBKDF2-SHA256(motDePasse, salt, iterations = 600000, dkLen = 32)
```

`{ "v": 1, "salt": base64url, "hash": base64url }`, dans le stockage local de la
plateforme (Keychain / Keystore quand il existe, sinon stockage local). La
comparaison se fait en temps constant quand la plateforme le permet.

## Session

Déverrouillé jusqu'à la sortie de l'écran carnet, la mise en arrière-plan de
l'app ou la fermeture de la popup / de l'onglet. Pas de déverrouillage mémorisé.

## Oubli

« Mot de passe oublié » propose d'**effacer le carnet local** et le verrou, après
confirmation explicite. Rien d'autre ne permet de passer le verrou. Si la
synchronisation est active, le carnet revient à la prochaine synchronisation.

## Changer de méthode

Depuis l'écran carnet déverrouillé : changer le mot de passe (l'actuel est
exigé), ou basculer biométrie ↔ mot de passe.

## Gestion

Une fois déverrouillé :

- liste des entrées non supprimées (libellé, identifiant, domaines) ;
- détail d'une entrée : `siteKey`, domaines, identifiant, longueur, jeux de
  caractères, compteur, date de mise à jour ;
- suppression, après confirmation : pierre tombale `deleted = true` et
  `updatedAt` à maintenant, pour que la suppression se propage à la
  synchronisation (voir vault-merge.md) ;
- le renouvellement existant reste disponible depuis le détail.
