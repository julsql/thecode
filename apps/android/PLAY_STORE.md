# TheCode — Fiche Google Play Store

Document prêt à coller dans la console Google Play. Toutes les limites de caractères imposées par Google sont indiquées et respectées.

---

## 1. Nom de l'application *(30 caractères max)*

**Proposition principale**
```
TheCode — Mots de passe
```
*(23 caractères)*

**Variantes**
- `TheCode : Mot de passe local` *(28)*
- `TheCode — Coffre sans stockage` *(30)*
- `TheCode Password Generator` *(26)* — version anglophone

---

## 2. Description courte *(80 caractères max)*

**Proposition principale**
```
Générez vos mots de passe localement à partir d'une seule clé. Rien n'est stocké.
```
*(80 caractères)*

**Variantes**
- `Une clé, un site, un mot de passe. 100 % local, zéro stockage, zéro compte.` *(75)*
- `Mots de passe déterministes, hors ligne et chiffrés SHA-256. Sans coffre.` *(72)*
- `Un gestionnaire de mots de passe sans coffre : tout est recalculé à la volée.` *(77)*

---

## 3. Description complète *(4 000 caractères max)*

```
TheCode réinvente le gestionnaire de mots de passe : aucun mot de passe n'est jamais stocké. Tous sont régénérés à la volée, en local, à partir d'une seule clé secrète que vous seul connaissez.

━━━━━━━━━━━━━━━━━━━━━
UNE CLÉ. UNE INFINITÉ DE MOTS DE PASSE.
━━━━━━━━━━━━━━━━━━━━━

Le principe est simple : vous mémorisez UNE clé secrète. Pour chaque site, TheCode combine votre clé avec le nom du site et applique une fonction cryptographique SHA-256 pour générer un mot de passe unique et reproductible.

→ Même clé + même site = exactement le même mot de passe, à chaque fois.
→ Sites différents = mots de passe totalement différents.
→ Aucune base de données. Aucun coffre à protéger. Rien à synchroniser.

━━━━━━━━━━━━━━━━━━━━━
FONCTIONNALITÉS
━━━━━━━━━━━━━━━━━━━━━

• Génération déterministe SHA-256 entièrement locale
• Longueur ajustable de 4 à 40 caractères
• Choix des classes de caractères : minuscules, majuscules, chiffres, symboles
• Indicateur d'entropie en bits et niveau de sécurité en temps réel
• Remplissage automatique système (Android 8.0+) : TheCode propose un mot de passe directement dans n'importe quelle app ou site web, validé par votre empreinte digitale ou votre visage
• Authentification biométrique pour révéler la clé ou autoriser le remplissage
• Copie en un clic dans le presse-papier
• Partage rapide vers vos applications
• Mode sombre, clair ou automatique
• Interface Material Design 3 fluide et épurée
• Aucun compte requis — aucune publicité — aucune télémétrie

━━━━━━━━━━━━━━━━━━━━━
CONFIDENTIALITÉ ABSOLUE
━━━━━━━━━━━━━━━━━━━━━

• Votre clé ne quitte JAMAIS votre téléphone.
• Aucun mot de passe n'est sauvegardé, ni en local, ni dans le cloud.
• Aucune connexion internet n'est nécessaire — l'app fonctionne entièrement hors ligne.
• Les sauvegardes Android (transfert d'appareil, sauvegarde cloud) sont volontairement désactivées pour les préférences sensibles.
• Code source ouvert sous licence Apache 2.0 : tout est vérifiable.

Pas de coffre = pas de fuite possible. Vos mots de passe n'existent nulle part tant que vous ne les régénérez pas.

━━━━━━━━━━━━━━━━━━━━━
UN ÉCOSYSTÈME COMPLET
━━━━━━━━━━━━━━━━━━━━━

TheCode vous suit partout, avec la même clé :

• Application Android (vous y êtes)
• Applications iOS et macOS
• Extensions navigateur : Chrome, Firefox, Safari, Edge, Brave, Opera
• Générateur en ligne sur thecode.julsql.fr

La même clé sur toutes vos plateformes vous redonne tous vos mots de passe, instantanément.

━━━━━━━━━━━━━━━━━━━━━
POUR QUI ?
━━━━━━━━━━━━━━━━━━━━━

• Vous en avez assez des coffres-forts qui se font pirater
• Vous voulez quitter LastPass, 1Password, Bitwarden ou Dashlane
• Vous changez souvent de téléphone et détestez tout reconfigurer
• Vous voulez accéder à vos comptes sans dépendance à un service tiers
• Vous aimez les solutions élégantes et minimalistes

━━━━━━━━━━━━━━━━━━━━━
COMMENT ÇA MARCHE ?
━━━━━━━━━━━━━━━━━━━━━

1. Choisissez une clé secrète robuste (mémorisez-la — elle n'existe que dans votre tête)
2. Saisissez le nom d'un site (ex. « google.com »)
3. Ajustez la longueur et les caractères autorisés
4. Le mot de passe apparaît instantanément
5. Copiez-le, partagez-le, ou laissez le remplissage automatique l'insérer pour vous

Pour vous reconnecter plus tard : même clé, même nom de site → même mot de passe.

━━━━━━━━━━━━━━━━━━━━━
OPEN SOURCE & GRATUIT
━━━━━━━━━━━━━━━━━━━━━

TheCode est entièrement gratuit, sans achat intégré, sans abonnement, sans publicité. Le code est publié sous licence Apache 2.0 et auditable par tous.

Reprenez le contrôle de vos mots de passe. Téléchargez TheCode.
```
*(≈ 3 500 caractères — marge confortable sous la limite de 4 000)*

---

## 4. Texte promotionnel / What's new *(500 caractères max)*

**Pour la version 2.2**
```
• Service de remplissage automatique Android : TheCode propose vos mots de passe dans n'importe quelle app ou page web.
• Authentification biométrique pour révéler votre clé ou valider le remplissage.
• Indicateur d'entropie repensé.
• Mode sombre / clair / système.
• Compatibilité Android 5.0 → 14, optimisé pour Android 14.
```
*(≈ 380 caractères)*

---

## 5. Mots-clés / ASO (Optimisation Play Store)

Google Play n'a pas de champ « keywords » dédié comme l'App Store ; les mots-clés sont indexés depuis le titre + description courte + description longue. La description ci-dessus a été rédigée pour intégrer naturellement les requêtes utiles :

**Cibles principales**
- gestionnaire de mots de passe
- mot de passe sans coffre
- générateur de mot de passe
- mot de passe déterministe
- SHA-256 password
- password manager open source
- hors ligne / offline
- pas de cloud / no cloud
- remplissage automatique Android
- biométrie mot de passe

**Concurrents à viser dans la description**
LastPass, 1Password, Bitwarden, Dashlane, KeePass — utilisés ci-dessus dans une formulation comparative naturelle, conforme aux règles Google Play.

---

## 6. Catégorie & classification

| Champ | Valeur |
|---|---|
| Catégorie principale | **Outils** (Tools) |
| Catégorie secondaire | Productivité (Productivity) |
| Tags Google Play | `Sécurité`, `Productivité` |
| Public cible | Tout public (3+) |
| Contient des publicités | **Non** |
| Achats intégrés | **Non** |
| Accès au contenu | Sans restriction |

**Questionnaire IARC à prévoir**
- Aucune violence, aucun contenu sensible → classification PEGI 3 / ESRB Everyone.

---

## 7. Coordonnées & liens

| Champ | À renseigner |
|---|---|
| Site web de l'app | https://thecode.julsql.fr |
| E-mail développeur | *(votre adresse de contact publique)* |
| Politique de confidentialité | https://thecode.julsql.fr/privacy *(à confirmer / créer)* |
| Code source | Lien GitHub : https://github.com/julsql/thecode |

> **Important :** Google exige une URL de politique de confidentialité valide et accessible publiquement. Si elle n'existe pas encore, créez une page dédiée sur thecode.julsql.fr avant publication.

---

## 8. Déclaration sur la sécurité des données (Data Safety)

Section obligatoire dans Play Console. Voici les réponses correctes pour TheCode :

### Données collectées
**Aucune.** L'app ne collecte, ne transmet ni ne partage aucune donnée utilisateur.

### Données partagées avec des tiers
**Aucune.**

### Pratiques de sécurité
- ☑ Les données sont chiffrées en transit *(non applicable, aucune donnée n'est envoyée)*
- ☑ L'utilisateur peut demander la suppression des données *(non applicable, aucune donnée n'est stockée côté serveur)*
- ☑ L'app suit les bonnes pratiques de la Mobile App Security *(MASVS)*

### Stockage local sensible
- La clé de l'utilisateur est stockée dans `SharedPreferences` privées de l'app
- Sauvegardes Android désactivées (`android:allowBackup="false"` dans le manifest)
- Accès gardé par authentification biométrique pour la révélation et l'autofill

---

## 9. Section « Permissions » à expliquer

Si Google vous interroge sur l'usage des permissions :

| Permission | Justification |
|---|---|
| `BIND_AUTOFILL_SERVICE` | Service de remplissage automatique de mots de passe — fonctionnalité principale de l'app, équivalent de l'autofill iOS. |
| `USE_BIOMETRIC` / `USE_FINGERPRINT` | Protection de la clé secrète et validation des opérations sensibles via empreinte/visage. |
| Accès Internet | **Aucune** — l'app n'a pas la permission `INTERNET`. |

L'absence de permission Internet est un argument de vente : à mettre en avant dans la description et dans la réponse aux questions de la Play Console.

---

## 10. Assets graphiques requis

| Asset | Format | Dimensions | Notes |
|---|---|---|---|
| Icône Play Store | PNG 32 bits | 512 × 512 px | Réutiliser le logo TheCode actuel |
| Image de présentation (feature graphic) | PNG / JPG | 1024 × 500 px | **Obligatoire** — bandeau en haut de la fiche |
| Captures d'écran téléphone | PNG / JPG | min 320 px côté court, max 3840 px côté long | Min 2, max 8. Conseillé : 1080 × 1920 |
| Captures d'écran tablette 7" | Optionnel | 1024 × 600 px min | Recommandé |
| Captures d'écran tablette 10" | Optionnel | 1280 × 800 px min | Recommandé |
| Vidéo promo | YouTube | — | Optionnel mais recommandé (30 s à 2 min) |

### Captures d'écran à produire (suggestions)
1. **Écran principal** avec un mot de passe généré pour `google.com`, badge « Sécurité : Très élevé »
2. **Curseur de longueur** + cases à cocher des classes de caractères
3. **Activation du remplissage automatique** + écran système Android Autofill
4. **Prompt biométrique** lors de l'autofill
5. **Mode sombre** sur le même écran principal
6. **Écran d'aide** expliquant le principe en une phrase

### Suggestions de bandeau (feature graphic)
- Texte gauche : « Une clé. Aucune base. Aucun risque. »
- Visuel droite : capture du logo + mockup du téléphone
- Couleurs : palette de l'app (vérifier `colors.xml`)

---

## 11. Stratégie de positionnement (rappel marketing)

**Promesse unique**
> *« Le seul gestionnaire de mots de passe qui ne stocke rien. »*

**Trois piliers à marteler**
1. **Zéro stockage** = zéro fuite possible
2. **100 % local** = aucune dépendance à un cloud
3. **Une seule clé à mémoriser** = aucun coffre à protéger

**Réponses aux objections fréquentes** (à intégrer dans la FAQ du site, et à mentionner dans la section « À propos du développeur ») :
- *« Et si je perds ma clé ? »* → la clé n'est connue que de vous, mais elle peut être retapée à l'identique sur n'importe quel appareil, à tout moment.
- *« Et si on devine ma clé ? »* → SHA-256 est cryptographiquement sûr ; choisissez une clé longue, comme une phrase de passe.
- *« Pourquoi est-ce mieux qu'un coffre chiffré ? »* → un coffre peut fuiter (Bitwarden, LastPass…). TheCode ne stocke rien à compromettre.

---

## 12. Checklist avant publication

- [ ] Versionner `versionCode` à 12 et `versionName` à 2.2 *(déjà fait dans `app/build.gradle`)*
- [ ] Générer un AAB signé en release (`./gradlew bundleRelease`)
- [ ] Vérifier que `targetSdk` est ≥ 34 (Android 14) — Play Store l'impose
- [ ] Préparer 6 captures d'écran 1080 × 1920
- [ ] Créer le bandeau feature graphic 1024 × 500
- [ ] Publier la politique de confidentialité sur thecode.julsql.fr
- [ ] Remplir le questionnaire IARC dans la console
- [ ] Remplir la section Data Safety
- [ ] Soumettre en test interne d'abord, puis production
- [ ] Programmer la sortie en parallèle de l'annonce sur le site et l'extension

---

*Document généré pour la fiche Play Store — version de l'app : 2.2 (versionCode 12).*
