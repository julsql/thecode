# TheCode — Fiche App Store (iOS et macOS)

Document prêt à coller dans App Store Connect, pour l'app iPhone/iPad et l'app Mac. Les limites de
caractères d'Apple sont indiquées et respectées.

---

## 1. Nom _(30 caractères max)_

```
TheCode — Mots de passe
```

_(23 caractères)_

## 2. Sous-titre _(30 caractères max)_

```
Une clef, aucun mot de passe
```

_(28 caractères)_

Variante : `Mots de passe jamais stockés` _(28)_

## 3. Texte promotionnel _(170 caractères max)_

Modifiable sans nouvelle version.

```
Nouveau : verrou du carnet par Face ID ou Touch ID, remplissage automatique avec l'identifiant et synchronisation chiffrée de bout en bout, facultative.
```

_(≈ 150 caractères)_

## 4. Description _(4 000 caractères max)_

```
TheCode est un gestionnaire de mots de passe qui n'en stocke aucun. Chaque mot de passe est recalculé sur votre appareil, à la demande, à partir d'une clef maîtresse que vous seul connaissez et du nom du site.

UNE CLEF. UN MOT DE PASSE PAR SITE.
• Même clef + même site = exactement le même mot de passe, sur chaque appareil.
• Sites différents = mots de passe sans rapport entre eux.
• Rien à voler : aucun mot de passe n'est enregistré, ni sur l'appareil, ni sur un serveur.

La dérivation (PBKDF2 à 600 000 itérations, puis HMAC-SHA256) est documentée, testée et reproductible : vos mots de passe ne dépendent pas de la survie d'un service.

FONCTIONNALITÉS
• Remplissage automatique sur iPhone, iPad et Mac : TheCode propose le mot de passe dans Safari et dans les apps, avec l'identifiant du compte
• Carnet : retenez pour chaque site l'identifiant, la longueur et les caractères voulus — jamais le mot de passe
• Enregistrement proposé par le système : TheCode ne retient un compte que s'il sait en recalculer le mot de passe
• Verrou du carnet par Face ID, Touch ID ou mot de passe dédié
• Mot de passe masqué par défaut, affiché d'un geste
• Longueur de 4 à 40 caractères, choix des minuscules, majuscules, chiffres, symboles
• Réglages par défaut retenus, et partagés entre vos appareils si vous avez un compte
• Transfert du carnet d'un appareil à l'autre par QR code chiffré
• Synchronisation automatique, chiffrée de bout en bout, facultative
• Connexion avec Apple, avec Google ou par adresse e-mail
• Aucune publicité, aucun traceur, aucune mesure d'audience

CONFIDENTIALITÉ
• Votre clef maîtresse ne quitte jamais votre appareil : elle est gardée dans le trousseau.
• Sans compte, l'app ne contacte aucun serveur : tout fonctionne hors ligne.
• Avec un compte, le carnet est chiffré sur l'appareil avant d'être envoyé : le serveur ne voit ni vos sites, ni vos identifiants.
• La caméra ne sert qu'à lire un QR code de transfert ; aucune image n'est enregistrée.
• Code source ouvert sous licence Apache 2.0.

PARTOUT, AVEC LA MÊME CLEF
Apps iPhone, iPad et Mac, application Android, extensions pour Chrome, Firefox, Edge, Brave et Safari, et le site thecode.julsql.fr. La même clef vous redonne les mêmes mots de passe sur chacun d'eux, même sans synchronisation.

GRATUIT, AVEC UNE OFFRE COMPLÈTE
La génération, le carnet et le remplissage sont gratuits et illimités. Un compte gratuit synchronise quelques entrées sur trois appareils ; l'offre complète lève ces limites.

COMMENT ÇA MARCHE ?
1. Choisissez une clef maîtresse longue et mémorisez-la : elle ne peut pas être récupérée.
2. Saisissez un site (ex. « apple.com ») et, si besoin, l'identifiant.
3. Le mot de passe apparaît. Copiez-le, ou laissez le remplissage automatique l'insérer.
4. Activez TheCode dans Réglages > Général > Remplissage automatique et mots de passe (iOS), ou Réglages Système > Général > Remplissage automatique et mots de passe (macOS).
```

_(≈ 3 000 caractères)_

## 5. Mots-clés _(100 caractères max, séparés par des virgules, sans espace)_

```
gestionnaire,générateur,password,coffre,sécurité,clef,remplissage,autofill,hors ligne,open source
```

_(97 caractères)_ — « mots de passe » est déjà dans le nom, qu'Apple indexe : inutile de
le répéter ici.

## 6. Nouveautés de cette version _(4 000 caractères max)_

```
• Verrou du carnet : Face ID, Touch ID ou mot de passe dédié
• Carnet en v2, avec un identifiant par compte
• Remplissage automatique avec l'identifiant, facultatif
• Enregistrement proposé par le système, quand TheCode sait recalculer le mot de passe
• Mot de passe masqué par défaut
• Synchronisation automatique, chiffrée de bout en bout
• Réglages par défaut partagés entre vos appareils
• Connexion avec Apple ou avec Google
```

## 7. URL

| Champ                          | Valeur                                                 |
| ------------------------------ | ------------------------------------------------------ |
| URL d'assistance               | https://thecode.julsql.fr/fr/contact                   |
| URL marketing                  | https://thecode.julsql.fr                              |
| Politique de confidentialité   | https://thecode.julsql.fr/fr/privacy                   |
| Conditions d'utilisation (EULA) | EULA standard d'Apple, ou https://thecode.julsql.fr/fr/terms |
| Copyright                      | `2026 <nom de l'éditeur>` — voir `apps/website/src/legal/identity.ts` |

## 8. Informations générales

| Champ                   | Valeur                                                     |
| ----------------------- | ---------------------------------------------------------- |
| Catégorie principale    | Utilitaires                                                |
| Catégorie secondaire    | Productivité                                               |
| Classification par âge  | 4+                                                         |
| Achats intégrés         | Aucun (l'offre complète se souscrit sur le site)           |
| Plateformes             | iPhone, iPad, Mac                                          |
| Confidentialité de l'app | Voir [`docs/store-privacy.md`](../../docs/store-privacy.md) |

**Informations pour l'examen** : l'app s'utilise sans compte. Pour la synchronisation, fournir un
compte de démonstration (adresse + mot de passe). Préciser que le fournisseur de remplissage
automatique s'active dans les Réglages.
