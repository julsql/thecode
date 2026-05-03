# TheCode Android App

> Application Android officielle de **TheCode**\
> Génération déterministe et locale de mots de passe sécurisés.

## Aperçu
Cette application Android permet de générer des mots de passe **uniques par site** à partir de :

- une **clé secrète** que vous seul connaissez ;
- un **nom de site** (ex. `google`, `facebook`).

Le même couple `(clé, site)` produit toujours le même mot de passe. Aucune donnée n'est stockée ni transmise : tout est calculé localement.

L'application reproduit l'expérience visuelle et fonctionnelle de l'app iOS / macOS, en utilisant **Java + XML** et **Material Design 3**.

## Fonctionnalités
- Génération déterministe `SHA-256` + conversion dans une base personnalisée
- Longueur ajustable de **4 à 40 caractères**
- Choix des classes de caractères : minuscules, majuscules, symboles, chiffres
- Indicateur d'entropie et niveau de sécurité (en bits)
- Mode sombre / clair / système
- Copie en un clic dans le presse-papier
- Partage du mot de passe par n'importe quelle app
- **Remplissage automatique système** (Android 8.0+) avec authentification biométrique — équivalent de l'extension Apple AutoFill
- Aucune donnée stockée — aucun compte requis — 100 % hors ligne

## Remplissage automatique
Une fois le service activé dans **Paramètres → Mots de passe → Service de remplissage automatique → TheCode**, l'app intervient sur tous les champs `password` détectés (apps natives ou WebView) :

1. Le système détecte un champ mot de passe et appelle `TheCodeAutofillService`.
2. Le service identifie le **domaine** (web ou nom de package) puis propose une suggestion **« TheCode pour <domaine> »**.
3. Si l'utilisateur la choisit, **`AutofillAuthActivity`** déclenche un `BiometricPrompt`.
4. Une fois authentifié, le mot de passe est généré à la volée à partir de la clé stockée et inséré.

Aucun mot de passe n'est jamais persisté, et `onSaveRequest` est volontairement no-op puisque la génération est entièrement déterministe.

## Stack technique
| Élément | Choix |
|---|---|
| Langage | **Java 17** |
| UI | **XML + Material Components 3** |
| `minSdk` | 21 (Android 5.0) |
| `targetSdk` | 34 |
| Build | Gradle 8.9 / AGP 8.7 |
| Tests unitaires | JUnit 4 |

## Architecture
```
app/src/main/java/fr/juliette/thecode/
├── Code.java                 ← algorithme déterministe (port de PasswordUtils.swift)
├── Preferences.java          ← persistance locale (SharedPreferences)
├── LaunchActivity.java       ← splash + application du thème
├── MainActivity.java         ← écran principal Material 3
└── autofill/
    ├── TheCodeAutofillService.java   ← service Android Autofill
    ├── AutofillAuthActivity.java     ← écran transparent + BiometricPrompt
    ├── StructureParser.java          ← repérage des champs « password »
    ├── DomainNormalizer.java         ← canonicalisation des domaines
    └── ParsedStructure.java
```

L'algorithme est volontairement isolé dans `Code.java` pour pouvoir être testé en JVM, sans dépendance Android (à l'exception de `android.graphics.Color` pour les couleurs des labels).

## Vecteurs de test
Les tests vérifient la compatibilité avec les vecteurs historiques de TheCode :

| Clé | Site | Mot de passe (longueur 20, tous charsets) |
|---|---|---|
| `clef` | `site` | `u8YfpdVdK*#Bpy6(9f*5` |
| `c` | `s` | `wDwWUk$@<%r1f:YvVqUI` |

## Build & exécution
### Pré-requis
- Android Studio Hedgehog ou supérieur
- JDK 17
- SDK Android 34 installé

### Lancer l'app
```bash
./gradlew installDebug
```

### Lancer les tests unitaires
```bash
./gradlew test
```

## Sécurité
- La clé n'est **jamais** transmise hors de l'appareil.
- Aucun mot de passe n'est sauvegardé.
- Les sauvegardes Android (cloud, transfert d'appareil) sont **désactivées** pour le fichier de préférences.
- Tous les calculs sont réalisés sur le terminal.

## Licence
Distribué sous la licence Apache 2.0 — voir `LICENSE`.
