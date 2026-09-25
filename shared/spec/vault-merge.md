# Fusion de deux carnets

Deux appareils modifient leur carnet chacun de leur côté. À la synchronisation
il faut les réconcilier sans perdre de modification et sans surprendre
l'utilisateur.

La règle doit être **identique sur les cinq implémentations** : deux appareils
qui fusionnent les mêmes carnets doivent aboutir au même résultat, sinon ils
repartent en divergence à la synchronisation suivante.

## Uniquement des entrées v2

Le carnet n'accepte **que** des entrées `v = 2`. La v1 ne subsiste qu'en
génération ponctuelle, hors carnet.

- **Écriture** : aucune création ni mise à jour ne peut produire `v ≠ 2`.
  Enregistrer depuis un écran réglé en v1 crée ou garde une entrée v2.
- **Lecture** : toute entrée `v ≠ 2` est écartée, sans erreur, au chargement du
  carnet local, à l'import (QR, transfert) et à la synchronisation. Elle
  disparaît donc du carnet local à la prochaine écriture.
- Il n'y a plus de migration v1 → v2 : il n'existe plus d'entrée v1 à migrer.

Vecteur : `vault-fixtures/v2-only.json` — après lecture de `vault`, seules les
entrées de `expectedIds` restent.

## Principe

Fusion par entrée, appariée sur `id` (UUID). Une entrée présente d'un seul côté
est reprise telle quelle.

Quand la même `id` existe des deux côtés :

| Champ         | Règle                                                          | Pourquoi                                                                                                                      |
| ------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `domains`     | **union**                                                      | Ajouter `google.fr` sur le téléphone ne doit pas effacer `youtube.com` ajouté sur l'ordinateur                                |
| `counter`     | **max**                                                        | Un compteur ne recule pas tout seul : une valeur plus haute signifie que le mot de passe a déjà été renouvelé quelque part    |
| `deleted`     | **vrai l'emporte**                                             | Une suppression doit se propager, pas être annulée par l'autre carnet                                                         |
| `siteKey`     | **jamais fusionné**                                            | C'est ce qui produit le mot de passe. Deux valeurs différentes pour une même `id` = conflit signalé, jamais résolu en silence |
| tout le reste | **dernier écrivain gagne**, champ par champ, selon `updatedAt` |                                                                                                                               |

`updatedAt` de l'entrée fusionnée = le plus récent des deux.

## Ce qui n'est jamais résolu automatiquement

**`siteKey` divergent pour une même `id`.** Choisir au hasard changerait un mot
de passe sans que personne ne le demande. La fusion s'arrête sur cette entrée,
la signale, et laisse l'utilisateur trancher.

**`counter` en recul.** La règle du max l'empêche, mais si l'entrée entrante
porte un counter plus bas _et_ un `updatedAt` plus récent, c'est le signe que
l'autre appareil est en retard. On garde le max et on le signale : l'utilisateur
doit savoir que son mot de passe a été renouvelé ailleurs.

## Égalité de `updatedAt`

Deux écritures à la même seconde : on départage sur la **représentation JSON
canonique** de l'entrée, la plus petite lexicographiquement l'emporte.

Départager sur la position (« celui de gauche gagne ») paraît plus simple mais
n'est pas commutatif : chaque appareil garderait le sien et ils ne
convergeraient jamais. L'`id` ne peut pas servir non plus, puisque les deux
entrées en conflit portent la même.

Le critère est arbitraire ; ce qui compte est qu'il soit **déterministe,
indépendant de l'ordre des arguments, et identique dans toutes les
implémentations**.

### Forme canonique

Deux appareils qui n'écrivent pas la même chaîne désignent un gagnant différent
et ne convergent jamais. La forme est donc fixée, et non laissée au
sérialiseur JSON de chaque plateforme — leurs comportements par défaut diffèrent
sur les quatre points suivants, tous rencontrés dans ce projet :

1. **JSON compact** : `,` et `:` sans espace autour. `json.dumps` en met par
   défaut, `JSON.stringify` non.
2. **Clés triées à tous les niveaux**, y compris dans `charset`. Un tri
   seulement au premier niveau laisse l'ordre d'insertion décider du reste.
3. **`/` non échappé**. `org.json` écrit `\/`, les autres écrivent `/`.
4. **Caractères non-ASCII écrits tels quels**, jamais en `\uXXXX`.

Et une normalisation de contenu : **`deleted` est absent quand il est faux**,
jamais `"deleted": false`. Le piège se tend au retour d'une synchronisation, où
le serveur rend une pierre tombale explicite pour chaque entrée : elle ne doit
être reportée que lorsqu'elle est vraie. La forme canonique le retire de toute
façon, pour que les carnets écrits par des versions antérieures ne divergent
pas.

`shared/vault-fixtures/canonical-entries.json` fige des entrées et la chaîne
attendue pour chacune. Les cinq implémentations sont testées contre ce fichier :
c'est la seule garantie qui vaille, les tests par plateforme ayant déjà laissé
passer exactement ce genre d'écart.

## Propriétés attendues

La fusion est :

- **commutative** — `merge(a, b)` donne le même résultat que `merge(b, a)`
- **idempotente** — `merge(a, a) == a`, et `merge(merge(a,b), b) == merge(a,b)`

Ces deux propriétés sont testées sur chaque implémentation : sans elles, l'ordre
de synchronisation des appareils changerait le résultat.
