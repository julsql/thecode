# Réglages par défaut

Longueur et jeux de caractères utilisés pour un site **absent du carnet**. Une
entrée du carnet garde toujours ses propres réglages, qui priment.

```json
{
  "length": 20,
  "charset": { "lower": true, "upper": true, "symbols": true, "numbers": true },
  "updatedAt": "2026-01-15T10:30:00Z"
}
```

Valeurs d'usine : 20, tous les jeux cochés. `length` est borné comme ailleurs
(4 à 40) ; au moins un jeu doit rester coché.

## Sur chaque outil

Chaque client **retient** ses réglages localement dès qu'ils changent, et les
reprend à l'ouverture :

- extension : `storage.local` (déjà le cas) ;
- site : `localStorage` (protégé par try/catch : navigation privée) ;
- Android, iOS, macOS : préférences de l'app (déjà le cas) ;
- CLI : fichier de configuration local ; les options `--length`, `--no-symbols`…
  priment sur les réglages retenus pour la commande en cours.

`updatedAt` est mis à maintenant à chaque modification locale.

## Partagés avec un compte

Quand un compte de synchronisation est lié, les réglages voyagent avec le
carnet, chiffrés comme une entrée (voir `vault-sync.md`, clef `tk`,
AES-256-GCM, nonce de 12 octets, base64url sans remplissage) :

### `GET /v1/settings`

Rend `{"nonce": "...", "blob": "..."}`, ou **204** si le compte n'en a pas.

### `PUT /v1/settings`

Corps `{"nonce": "...", "blob": "..."}`. Remplace la valeur du compte. Réponse
**204**. Le serveur ne lit rien : un seul blob par compte, taille bornée
(4 Kio), hors plafond d'entrées de l'offre.

### Ordre côté client

À chaque synchronisation, après celle du carnet : **tirer**, garder la valeur
dont `updatedAt` est le plus récent (à égalité, la distante), l'appliquer
localement, puis **pousser** si la locale était la plus récente. Un blob
indéchiffrable (autre clef maîtresse) est ignoré sans écraser les réglages
locaux ni le distant.

`DELETE /v1/vault` et la suppression du compte effacent aussi les réglages.
