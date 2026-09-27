# TheCode Android App

> Application Android officielle de **TheCode**\
> Génération déterministe et locale de mots de passe sécurisés.

## Aperçu

Cette application Android permet de générer des mots de passe **uniques par site** à partir de :

- une **clé secrète** que vous seul connaissez ;
- un **nom de site** (ex. `google.com`), avec un identifiant et un compteur facultatifs.

Le même couple `(clé, site)` produit toujours le même mot de passe. Aucun mot de passe n'est stocké
ni transmis : chacun est recalculé localement. Sans compte, l'app ne contacte aucun serveur.

L'application reproduit l'expérience visuelle et fonctionnelle de l'app iOS / macOS, en utilisant
**Java + XML** et **Material Design 3**.

## Fonctionnalités

- Algorithme **v2** : `PBKDF2-SHA256` (600 000 itérations) sur la clé, puis `HMAC-SHA256` sur le
  site, l'identifiant et le compteur, et conversion dans une base personnalisée. La v1
  (`SHA-256`) reste disponible en génération ponctuelle, pour retrouver un mot de passe posé avant
  la v2
- Longueur ajustable de **4 à 40 caractères**
- Choix des classes de caractères : minuscules, majuscules, symboles, chiffres
- Indicateur de robustesse de la clé et empreinte de la clé (pour vérifier la saisie)
- Mode sombre / clair / système
- Copie en un clic dans le presse-papier, partage par n'importe quelle app
- **Carnet local** (facultatif) : réglages et identifiant de chaque site, jamais le mot de passe ;
  renouvellement par compteur, domaines rattachés
- Carnet déverrouillé par la **biométrie** ou le code de l'appareil, sinon par la clé maîtresse ;
  « Verrouiller » ferme toute la session
- **Transfert sans compte** par QR code chiffré (caméra) ou fichier (`TC2`)
- **Compte facultatif** (e-mail/mot de passe ou Google) : le carnet et les réglages par défaut se
  synchronisent automatiquement, chiffrés de bout en bout (sel propre au compte, AES-256-GCM lié à
  l'identifiant de chaque entrée)
- Suppression du compte depuis l'app
- **Remplissage automatique système** (Android 8.0+) avec identifiant et authentification
  biométrique — équivalent de l'extension Apple AutoFill

## Remplissage automatique

Une fois le service activé dans **Paramètres → Mots de passe → Service de remplissage automatique →
TheCode**, l'app intervient sur les champs `password` détectés (apps natives ou WebView) :

1. Le système détecte un champ mot de passe et appelle `TheCodeAutofillService`.
2. Le service identifie le **domaine** (web ou nom de package) et, si le carnet le connaît,
   l'**identifiant**, puis propose une suggestion **« TheCode pour <domaine> »**.
3. Si l'utilisateur la choisit, **`AutofillAuthActivity`** déclenche un `BiometricPrompt`.
4. Une fois authentifié, le mot de passe est généré à la volée à partir de la clé stockée et inséré.

Aucun mot de passe n'est jamais persisté. `onSaveRequest` n'enregistre pas le mot de passe saisi :
avec un compte connecté, il propose seulement d'ajouter au carnet le site et l'identifiant quand ce
mot de passe est celui que TheCode aurait calculé.

## Stack technique

| Élément          | Choix                                   |
| ---------------- | --------------------------------------- |
| Langage          | **Java 17**                             |
| UI               | **XML + Material Components 3**         |
| `minSdk`         | 24 (Android 7.0)                        |
| `targetSdk`      | 36                                      |
| Build            | Gradle 9.4 / AGP 9.2                    |
| Stockage chiffré | `EncryptedSharedPreferences` + Keystore |
| QR               | ZXing + CameraX                         |
| Tests unitaires  | JUnit 4                                 |

## Architecture

```
app/src/main/java/fr/juliette/thecode/
├── Code.java                 ← algorithme v1 (port de PasswordUtils.swift)
├── CodeV2.java               ← algorithme v2 (PBKDF2 + HMAC)
├── Generator.java            ← choix v1 / v2, réglages → mot de passe
├── Preferences.java          ← réglages (SharedPreferences) et secrets (EncryptedSharedPreferences)
├── SessionLock.java          ← session et fenêtre de grâce du verrou
├── AutoSync.java             ← synchronisation automatique
├── KeyStrength.java          ← robustesse de la clé
├── Fingerprint.java          ← empreinte de la clé
├── LaunchActivity.java       ← splash + application du thème
├── MainActivity.java         ← écran principal Material 3
├── VaultActivity.java        ← carnet, compte, synchronisation
├── autofill/
│   ├── TheCodeAutofillService.java   ← service Android Autofill
│   ├── AutofillAuthActivity.java     ← écran transparent + BiometricPrompt
│   ├── StructureParser.java          ← repérage des champs identifiant / mot de passe
│   ├── DomainNormalizer.java         ← canonicalisation des domaines
│   └── PublicSuffixList.java         ← Public Suffix List
├── vault/
│   ├── Vault.java, VaultEntry.java   ← carnet et fusion
│   ├── VaultLock.java                ← verrou du carnet
│   ├── Sync.java, SyncScheduler.java ← client de l'API de synchronisation
│   ├── Transfer.java                 ← transfert chiffré (TC2)
│   └── DefaultSettings.java          ← réglages par défaut synchronisés
└── transfer/
    └── TransferActivity.java, Qr*.java ← QR code : rendu, lecture caméra, réassemblage
```

Les algorithmes sont volontairement isolés (`Code.java`, `CodeV2.java`) pour pouvoir être testés en
JVM, sans dépendance Android.

## Vecteurs de test

Les tests vérifient la conformité avec les vecteurs partagés du monorepo
(`shared/test-vectors.json`, copiés dans `app/src/test/resources`) :

| Algo | Clé    | Site   | Mot de passe (longueur 20, tous charsets) |
| ---- | ------ | ------ | ----------------------------------------- |
| v1   | `clef` | `site` | `u8YfpdVdK*#Bpy6(9f*5`                    |
| v1   | `c`    | `s`    | `wDwWUk$@<%r1f:YvVqUI`                    |
| v2   | `clef` | `site` | `h4XOFa2UFJL*xB3f*bc:`                    |

## Build & exécution

### Pré-requis

- Android Studio récent (compatible AGP 9.2)
- JDK 17
- SDK Android 36 installé

### Lancer l'app

```bash
./gradlew installDebug
```

### Lancer les tests unitaires

```bash
./gradlew test
```

## Sécurité

- La clé maîtresse est seule dans `thecode.secure.prefs`, chiffré par `EncryptedSharedPreferences`
  et adossé au Keystore matériel, avec les jetons de synchronisation. Si le Keystore est
  indisponible, elle n'est pas persistée plutôt qu'écrite en clair.
- La clé n'est **jamais** transmise hors de l'appareil.
- Aucun mot de passe n'est sauvegardé, ni sur l'appareil ni sur le serveur.
- Les sauvegardes Android (cloud, transfert d'appareil) sont **désactivées**.
- Tous les calculs sont réalisés sur le terminal.

## Licence

Distribué sous la licence Apache 2.0 — voir `LICENSE`.
