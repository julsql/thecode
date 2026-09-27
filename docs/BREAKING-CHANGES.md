# Ruptures de compatibilité

Ce fichier ne liste que les changements qui **modifient un mot de passe déjà
généré**, ou qui rendent **illisible une donnée déjà écrite** (carnet, blocs
synchronisés, codes de transfert, verrou). Tout le reste va dans les CHANGELOG
des applications.

## Lot 1 — Canonicalisation unifiée

**Impact : Android, site web, CLI. Extension et apps Apple : aucun.**

### Android

`DomainNormalizer` utilisait une heuristique « deux derniers labels » au lieu de
la Public Suffix List. Les comptes suivants voyaient leur mot de passe changer
selon l'appareil :

| Site                    | Android (avant) | Partout ailleurs        |
| ----------------------- | --------------- | ----------------------- |
| `example.co.uk`         | `co.uk`         | `example.co.uk`         |
| `shop.example.co.uk`    | `co.uk`         | `example.co.uk`         |
| `example.com.br`        | `com.br`        | `example.com.br`        |
| `foo.github.io`         | `github.io`     | `foo.github.io`         |
| `test.s3.amazonaws.com` | `amazonaws.com` | `test.s3.amazonaws.com` |
| `192.168.1.1`           | `1.1`           | `192.168.1.1`           |

Android utilise désormais la PSL. **Les mots de passe de ces comptes changent
sur Android** — ils deviennent ceux que donnaient déjà les autres plateformes.

Autrement dit : Android ne diverge plus. Si tu utilisais déjà un de ces comptes
depuis l'extension ou l'iPhone, c'est le mot de passe correct qui s'applique
enfin partout.

### Site web et CLI

Aucune canonicalisation n'existait : la saisie était hashée telle quelle.
`https://www.google.com/login`, `www.google.com` et `google.com` donnaient trois
mots de passe différents. Ils convergent désormais vers `google.com`.

Une saisie qui ne ressemble pas à un hôte (`serveur perso`, `banque`) reste
inchangée : le champ est libre et sert parfois d'étiquette.

### Retrouver un ancien mot de passe

L'ancienne valeur reste calculable : il suffit de saisir le site sous sa forme
d'avant (`co.uk`, `www.google.com`…) dans le CLI ou sur le site web, qui
laissent les libellés non canonicalisables intacts.

## Lot 5 — Stockage de la clef maîtresse

### Android

La clef vivait en clair dans `thecode.prefs`, aux côtés des réglages ordinaires,
alors que le README affirmait qu'elle n'était jamais persistée.

Elle est désormais seule dans `thecode.secure.prefs`, chiffré par
`EncryptedSharedPreferences` et adossé au Keystore matériel. Une clef écrite par
une version antérieure est déplacée au premier lancement, puis **retirée de
l'ancien fichier dans tous les cas** : l'y laisser après avoir annoncé le
contraire serait pire que de demander une ressaisie.

Si le Keystore est indisponible, la clef n'est pas persistée du tout plutôt
qu'écrite en clair sans le dire.

Aucun mot de passe n'est affecté.

### Apple

Même problème : la clef était dans `UserDefaults`, donc en clair dans le
conteneur de l'app group.

Elle est désormais dans le **Keychain**, chiffrée au repos et liée à
l'appareil, partagée avec les extensions AutoFill par le groupe d'accès
trousseau que déclare le projet (capability **Keychain Sharing** sur les quatre
targets). Sur macOS, `kSecUseDataProtectionKeychain` impose le même trousseau
qu'iOS. Une clef écrite par une version antérieure est déplacée au premier
lancement, puis retirée de `UserDefaults` dans tous les cas.

Aucun mot de passe n'est affecté.

## Algorithme v2

**Impact : tous les clients.**

La v1 hache `SHA-256(site + clef)` : sans séparateur, `("google.com", "abc")`
et `("google.co", "mabc")` donnent le même mot de passe, et sans KDF un seul
mot de passe qui fuite permet de retrouver la clef maîtresse hors ligne.

La v2 dérive :

```
mk   = PBKDF2-SHA256(clef, "thecode-master/v2", 600000 itérations, 32 octets)
seed = HMAC-SHA256(mk, "thecode/v2" ‖ 0x00 ‖ site ‖ 0x00 ‖ login ‖ 0x00 ‖ compteur)
```

Le rendu (conversion en base, un caractère par groupe) est inchangé. Voir
`shared/spec/algo-v2.md`.

**Tous les mots de passe v2 diffèrent de ceux de la v1.** La v2 est
l'algorithme par défaut ; la v1 reste disponible en **génération ponctuelle**,
hors carnet (apps et extension, page « ancien algorithme » du site, `--algo 1`
du CLI), pour retrouver un mot de passe posé sur un site avant la v2 et le
remplacer.

Les vecteurs v1 et v2 de `shared/test-vectors.json` sont figés.

## Carnet v2, chiffrement v2, un seul secret

Aucun mot de passe n'est affecté : ces changements portent sur les données.

### Carnet v2

Toute entrée du carnet dérive en v2 : le champ `v` des entrées disparaît du
schéma (`shared/vault.schema.json`). Un `v` reçu est ignoré et jamais réécrit.
Le renouvellement d'une entrée incrémente son compteur au lieu de changer
d'algorithme.

### Chiffrement v2 (synchronisation et transfert)

- **Synchronisation** : la clef de chiffrement dérive de la clef maîtresse et
  d'un **sel propre au compte** (`kdf_salt`, 16 octets tirés par le serveur) ;
  chaque bloc est chiffré en AES-256-GCM avec l'identifiant de l'entrée en
  données associées, pour qu'un bloc ne puisse pas être rejoué sous un autre
  identifiant. Les blocs v1 ne sont plus lus ; le service n'étant pas encore en
  production, sa base en a été vidée à la migration.
- **Transfert** : les codes QR et fichiers passent au format `TC2`, avec leur
  propre sel aléatoire. Un code `TC1` est refusé : il faut le régénérer depuis
  l'appareil source, à jour.

Voir `shared/spec/vault-sync.md` et `shared/spec/vault-transfer.md`.

### Un seul secret

Il n'existe plus de **mot de passe de carnet**. Le carnet s'ouvre avec la
biométrie ou le code de l'appareil dans les apps, et avec la clef maîtresse
dans l'extension, sur le site et sur un appareil sans authentification. Les
anciens enregistrements de verrou (`vaultLock` dans l'extension,
`thecode.vaultLock` sur le site) sont effacés au chargement : aucune empreinte
de la clef n'est stockée.

« Verrouiller » ferme désormais **toute la session** — génération, carnet et
synchronisation — et plus seulement l'écran du carnet. Voir
`shared/spec/vault-lock.md`.
