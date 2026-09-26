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

## Synchronisation automatique

Dès qu'un compte est lié, chaque client synchronise **de lui-même** le carnet
puis les réglages par défaut (voir `default-settings.md`) :

- à l'ouverture : lancement de l'app, retour au premier plan, ouverture de la
  popup ou d'une page du site ;
- après chaque écriture locale : entrée enregistrée, mise à jour, supprimée,
  renouvelée, import ;
- après un changement de réglage par défaut.

Règles :

- **Regroupement** : les déclencheurs rapprochés sont fusionnés (attente de
  2 secondes après le dernier) ; une synchronisation en cours n'est jamais
  doublée, une demande pendant qu'elle tourne en relance une seule après.
- **Espacement** : à l'ouverture, pas plus d'une fois toutes les 30 secondes.
- **Discrétion** : rien ne bloque l'écran. Un échec (réseau, 401 après
  renouvellement, 402/403 de plafond) laisse un message court dans la zone de
  synchronisation, jamais une fenêtre ; les données locales ne sont pas
  touchées.
- **Sans clef maîtresse** saisie, rien ne part : le carnet est chiffré avec elle.
- Le bouton « Synchroniser » reste, pour forcer une synchronisation immédiate.

## Limites

Le serveur refuse une entrée dépassant `max_blob_bytes` et un compte dépassant
`max_entries_per_account`. Le carnet stocke des métadonnées, pas des fichiers.

## Offres

La génération ne passe par aucun serveur : elle est gratuite, hors ligne, sans
compte. Ce que l'abonnement paierait, c'est la synchronisation.

**Les offres sont dormantes** (`THECODE_PLANS_ENABLED` à faux, la valeur par
défaut) : tout le monde a les plafonds les plus larges, le compte est annoncé
en offre complète — les clients lisent cette valeur pour décider ce qu'ils
proposent — et la souscription répond qu'il n'y a rien à prendre. Un code reste
le seul moyen de marquer un compte, ce qui permet d'éprouver le comportement
payant sans demander d'argent à personne.

Le tableau ci-dessous décrit l'état où elles s'appliquent.

| Offre               | Entrées synchronisées     | Appareils connectés |
| ------------------- | ------------------------- | ------------------- |
| Gratuite            | `free_max_entries`        | `free_max_devices`  |
| Complète (2 €/mois) | `max_entries_per_account` | `pro_max_devices`   |

Un dépassement dû à l'offre répond **402**, jamais 403 : le client doit pouvoir
distinguer « vous n'avez pas le droit » de « il faut s'abonner », et ne proposer
l'abonnement que dans le second cas. Au plafond d'appareils de l'offre complète,
rien ne se débloque au-dessus : la connexion répond **403**. Le carnet local,
lui, n'est jamais bridé : les entrées au-delà du plafond restent sur l'appareil.

### Sessions du site

Le site est l'endroit où l'on déconnecte un appareil — c'est là que renvoie le
message du 402/403. Le plafond ne doit donc jamais lui fermer la porte.

Le site s'annonce à l'ouverture de session : `"client": "web"` dans
`POST /v1/auth/login`, `/register` et `/google`. Tout autre client envoie
`"app"` ou n'envoie rien (`app` par défaut) ; une autre valeur répond 422. La
nature de la session est stockée (`sessions.client`) et conservée par
`/refresh`. La session ouverte par `POST /v1/auth/password/reset` est une
session du site, puisque le lien y mène. On ne se fie pas à `device_label` :
c'est un libellé libre, affiché, pas un contrat.

Une session du site :

- ne compte pas dans « appareils connectés » (`device_count` de
  `/v1/auth/me`) ;
- n'est jamais refusée pour cause de plafond d'appareils — ni 402, ni 403 ;
- apparaît dans `GET /v1/account/devices` avec `"client": "web"`, et se
  déconnecte comme les autres.

Pour que « web » ne devienne pas un contournement illimité, les sessions du
site sont bornées à part : au plus `web_max_sessions` (5 par défaut, quelle que
soit l'offre) sessions vivantes par compte. Au-delà, la **plus ancienne**
session du site est déconnectée — jamais de refus : le site doit toujours
s'ouvrir.

Risque résiduel, assumé : rien n'empêche un client natif de se dire « web ».
Il obtient alors au plus `web_max_sessions` sessions de plus que son offre, et
chaque nouvelle en chasse une ancienne — ce qui rend le partage d'un compte
entre plus de personnes pénible plutôt que gratuit. Le site synchronise le
carnet lui aussi : restreindre ce qu'une session web peut faire casserait le
site sans rien empêcher d'autre.

### Synchronisation partielle

`GET /v1/vault` rend `max_entries`, le plafond du compte. Le client ne pousse
que ce qui y tient, et garde le reste sur l'appareil :

1. Tout ce qui est déjà sur le serveur (les `id` du pull), pierres tombales
   comprises : une modification ou une suppression doit toujours pouvoir
   partir.
2. Les places libres — `max_entries` moins les entrées du point 1 non
   supprimées — vont aux autres entrées non supprimées, **les plus anciennes
   d'abord** : `createdAt`, `updatedAt` à défaut, puis `id` pour départager.
3. Une entrée jamais synchronisée puis supprimée ne part pas : elle n'a rien à
   propager.

Le reste est propre à l'appareil : il est dans le carnet, se calcule et se
fusionne comme le reste, mais le serveur ne le voit pas. Supprimer une entrée
synchronisée libère sa place à la synchronisation suivante. Le client dit
combien d'entrées sont restées sur l'appareil.

Le serveur compte après l'écriture, et ne refuse qu'une **croissance** au-delà
du plafond : une suppression poussée avec un ajout libère sa place, et un
compte déjà au-delà — après une fin d'abonnement — continue de modifier et de
supprimer ce qu'il a.

Vecteurs : `vault-fixtures/sync-selection.json`.

Le **compteur** — renouveler un mot de passe sans changer de clef maîtresse —
fait partie de l'offre complète.

Ce contrôle-là vit sur l'appareil, et ne peut pas vivre ailleurs : le compteur
voyage à l'intérieur du bloc chiffré, le serveur ne le voit pas et ne peut donc
rien en dire. Chaque client garde l'offre à côté de ses jetons, relue à la
connexion et à chaque synchronisation, et s'en sert pour proposer ou refuser le
renouvellement. Sans compte, l'offre est la gratuite.

Les plafonds sont dans `apps/api/thecode_api/plans.py`, et nulle part ailleurs.
Une limite écrite deux fois finit par dire deux choses différentes, et la
divergence se découvre en s'y cognant.

## Compte, codes et abonnement

Le **site est le seul endroit** où l'on choisit son offre, paie et déconnecte
un appareil. Les clients se connectent et synchronisent — et, avec Google,
peuvent créer un compte **gratuit**, sans offre à choisir : un
écran de facturation par plateforme multiplierait les endroits où une erreur de
droits peut se glisser, pour un geste qu'on fait deux fois par an.

- `GET /v1/auth/me` — l'état du compte : offre, statut, consommation, plafonds.
- `POST /v1/auth/verify` / `/verify/resend` — confirmation d'adresse. Le jeton
  est stocké haché, à usage unique, et un nouvel envoi invalide le précédent.
- `GET /v1/account/devices`, `DELETE /v1/account/devices/{id}` — un plafond
  d'appareils sans moyen d'en déconnecter un laisserait bloqué qui l'atteint.
- `POST /v1/account/code` — un code d'invitation, de parrainage (remise Stripe)
  ou à vie. Un code ne se rejoue pas sur le même compte.
- `POST /v1/auth/google` — crée le compte ou ouvre la session à partir d'un
  jeton d'identité Google. Le lien se fait sur le `sub` de Google, jamais sur
  l'adresse : Google permet d'en changer, et une adresse réattribuée à
  quelqu'un d'autre lui ouvrirait le compte. Un compte existant avec la même
  adresse vérifiée est **relié**, pas dupliqué — deux comptes pour la même
  personne couperaient son carnet en deux. Voir « Se connecter avec Google »
  plus bas pour le contrat et la façon dont chaque client obtient son jeton.
- `POST /v1/account/password` — change le mot de passe. L'actuel est exigé, et
  les **autres** appareils sont déconnectés : pas celui qui vient de le
  changer. Un compte créé par Google n'a pas de mot de passe et en pose un ici,
  ce qui lui ouvre les applications — elles ne savent se connecter qu'avec une
  adresse et un mot de passe.
- `POST /v1/account/email` — demande un changement d'adresse. Rien ne bouge
  avant que le lien, envoyé à la **nouvelle** adresse, ne soit suivi.
- `POST /v1/auth/password/forgot` et `/reset` — oubli. La demande répond la même
  chose quelle que soit l'adresse, sinon la route serait un annuaire des
  comptes ; la réinitialisation déconnecte **tous** les appareils, puisqu'elle
  sert aussi à reprendre un compte dont on a perdu le contrôle.

Aucun de ces changements ne touche au carnet : il est chiffré avec la clef
maîtresse, que le service ne connaît pas. Changer la serrure du compte ne rend
son contenu ni lisible, ni illisible.

- `GET /v1/billing/plans`, `POST /v1/billing/checkout`, `POST /v1/billing/portal`,
  `POST /v1/billing/webhook`.

La source de vérité de l'abonnement est le **webhook**, jamais le retour de
navigateur : fermer l'onglet juste après avoir payé doit quand même abonner, et
recopier l'URL de succès ne doit rien donner. Un compte à vie ne se rétrograde
jamais sur un événement Stripe : il n'a pas d'abonnement.

### Se connecter avec Google

Une seule route pour tous les clients, qui crée le compte ou ouvre la session :

```
POST /v1/auth/google
{ "id_token": "<jeton d'identité Google>",
  "nonce": "<facultatif>",
  "device_label": "iPhone de Julie",
  "client": "app",
  "invite_code": "",
  "lang": "fr" }

200 → { "access_token", "refresh_token", "token_type", "expires_in" }
401 → jeton refusé (« Connexion Google refusée. », sans détail)
402 / 403 → plafond d'appareils atteint (jamais pour "client": "web") ; 403 aussi pour une inscription fermée
            ou un code exigé et absent
```

Le serveur vérifie la signature (clefs publiques de Google), l'émetteur,
l'expiration, l'adresse vérifiée, et l'**audience**, qui doit être l'une de :

- `THECODE_GOOGLE_CLIENT_ID` — le client **web**. C'est le seul publié par
  `GET /v1/auth/registration` (`googleClientId`) ; vide, Google est désactivé ;
- `THECODE_GOOGLE_EXTRA_CLIENT_IDS` — d'autres clients, séparés par des
  virgules, vide par défaut. Aujourd'hui le client **iOS** des applications
  Apple, qui l'embarquent elles-mêmes.

| Client      | Obtention du jeton                                                                              | Audience   | Nonce       |
| ----------- | ----------------------------------------------------------------------------------------------- | ---------- | ----------- |
| Site        | Google Identity Services, client web                                                            | web        | —           |
| Extension   | `chrome.identity.launchWebAuthFlow`, flux implicite `response_type=id_token`, client web        | web        | obligatoire |
| Android     | Credential Manager, `serverClientId` = client web                                               | web        | facultatif  |
| iOS / macOS | `ASWebAuthenticationSession` + PKCE avec un client de type iOS, échange du code contre le jeton | client iOS | facultatif  |

Le **nonce** : quand la requête en porte un, le jeton doit porter exactement le
même (`nonce` du jeton), sinon 401 — un jeton sans nonce est refusé lui aussi.
Le flux implicite de l'extension en exige un de Google : l'extension le tire au
hasard, le passe à Google puis le renvoie ici tel quel.

Pas de « Se connecter avec Apple ».

Un premier passage par Google **crée un compte gratuit** : aucune offre à
choisir, aucun paiement, aucun écran de facturation dans l'application. Le
compte est ouvert (adresse vérifiée par Google, pas de mot de passe) et suit les
plafonds de l'offre gratuite ; passer à l'offre complète se fait sur le site,
comme pour tout compte. Seule la configuration d'inscription s'applique :
`invite_code` sert quand le service demande un code.

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
