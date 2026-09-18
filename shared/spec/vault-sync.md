# Synchronisation par serveur

Option **facultative**, à côté du transfert par QR code (`vault-transfer.md`).
Sans compte lié, aucune implémentation ne contacte de serveur.

Le serveur ne peut rien lire. Il stocke des blocs opaques, horodate, et rend ce
qui a changé. Toute la fusion se fait sur l'appareil, selon `vault-merge.md` —
non par prudence, mais parce que le serveur en est incapable : il n'a jamais la
clef.

## Ce que le serveur apprend malgré tout

À énoncer clairement plutôt que de laisser croire à un secret parfait :

- le nombre d'entrées, et lesquelles changent ;
- la fréquence des synchronisations, et depuis combien d'appareils ;
- l'adresse e-mail du compte, et les adresses IP qui s'y connectent.

Il n'apprend ni les sites, ni les identifiants, ni les réglages, ni les mots de
passe — qu'il ne pourrait de toute façon pas connaître, puisqu'ils ne sont
stockés nulle part.

## Identifiants

Ceux du compte de synchronisation sont **distincts de la clef maîtresse**.
S'authentifier avec celle-ci ferait qu'une faiblesse du service exposerait les
mots de passe eux-mêmes.

Côté serveur, le mot de passe du compte est haché en Argon2id. Ce choix ne
contredit pas celui de PBKDF2 dans `vault-transfer.md` : ici le hachage n'a
besoin de tourner que sur le serveur, où la bibliothèque existe, et non sur les
cinq plateformes.

L'accès se fait par jeton : quinze minutes pour le jeton d'accès, un jeton de
renouvellement rotatif pour la suite. Sur un usage normal, le jeton d'accès
expire entre deux synchronisations ; chaque client le renouvelle sans
redemander le mot de passe.

## Chiffrement des entrées

Chaque entrée est chiffrée **séparément**, avec la même clef de transfert que
`vault-transfer.md` :

```
tk = PBKDF2-SHA256(clef, salt = "thecode-transfer/v1", iterations = 600000, dkLen = 32)
```

Une entrée devient :

```json
{
  "entry_id": "<l'id de l'entrée, en clair>",
  "nonce": "<base64url, 12 octets, jamais réutilisés>",
  "blob": "<base64url(AES-256-GCM(JSON de l'entrée))>",
  "deleted": false
}
```

Entrée par entrée et non carnet entier : sinon chaque modification
réécrirait tout, et le delta ne servirait à rien.

`entry_id` reste en clair. Le serveur doit pouvoir reconnaître qu'une entrée
remplace une précédente sans la lire. C'est un UUID aléatoire : il ne dit rien
du site.

`deleted` aussi reste en clair, pour la même raison : une pierre tombale doit se
propager même si le serveur ne sait pas ce qu'elle efface.

Tout l'encodage est en **base64url sans remplissage**. Un « + » ou un « = »
suffirait à casser l'interopérabilité entre implémentations.

## Adresse du service

`https://thecode-api.julsql.fr`.

Le service a d'abord vécu sous `https://thecode.julsql.fr/api`. Cet accès a été
retiré. Un appareil qui l'aurait encore enregistré avec ses jetons reçoit le
HTML du site — le routeur de la page attrape tout — et doit se reconnecter sur
le sous-domaine.

Le sous-domaine impose au service d'envoyer les en-têtes CORS pour le site, qui
n'est plus sur la même origine. Les applications natives et les extensions n'y
sont pas soumises.

## Protocole

### `GET /v1/vault?since=<révision>`

Rend `{"revision": n, "entries": [...]}` : les entrées de révision strictement
supérieure à `since`. Sans `since`, tout le carnet.

### `POST /v1/vault`

```json
{ "base_revision": n, "entries": [...] }
```

Concurrence optimiste : si la révision du serveur a dépassé `base_revision`, il
répond **409** et n'écrit rien. Écraser reviendrait à perdre en silence ce qu'un
autre appareil a écrit entre-temps.

### `DELETE /v1/vault`

Efface réellement les entrées du compte, sans pierre tombale : c'est une action
explicite de l'utilisatrice sur son propre compte, pas une synchronisation.

## Ordre imposé côté client

**Tirer, fusionner, pousser.** Jamais dans un autre ordre.

Pousser d'abord écraserait ce qu'un autre appareil a écrit entre-temps ; le
serveur le refuse par le 409, mais le client ne doit pas s'y fier pour être
correct.

Un 409 signifie qu'un autre appareil a écrit entre le `GET` et le `POST` : le
client refait le cycle complet. Il ne rejoue pas seulement le `POST`, sans quoi
il pousserait une fusion faite sur une base périmée.

Un 401 signifie que le jeton d'accès a expiré : le client le renouvelle et
rejoue le cycle **entier**, pour la même raison.

## Limites

Le serveur refuse une entrée dépassant `max_blob_bytes` et un compte dépassant
`max_entries_per_account`. Le carnet stocke des métadonnées, pas des fichiers.

## Implémentations

| Implémentation | Fichier                                |
| -------------- | -------------------------------------- |
| CLI            | `apps/cli/thecode/sync.py`             |
| Extension      | `apps/extension/sync.js`               |
| Site           | `apps/website/src/sync.ts`             |
| Android        | `apps/android/.../vault/Sync.java`     |
| Apple          | `apps/apple/Shared/Sync.swift`         |
| Serveur        | `apps/api/thecode_api/routes/vault.py` |

Les cinq clients suivent le même ordre et les mêmes règles ; leurs tests
montent chacun un serveur en mémoire aux règles ci-dessus, et vérifient qu'aucun
nom de site ni identifiant ne passe en clair sur le réseau.

`shared/vault-fixtures/sync-row.json` fige une ligne chiffrée par le CLI :
chaque implémentation doit la déchiffrer et retrouver l'entrée à l'identique.
Le chiffrement n'est pas ce qui a cassé jusqu'ici, c'est le JSON autour — un
champ inventé, un défaut ajouté, et la fusion diverge.
