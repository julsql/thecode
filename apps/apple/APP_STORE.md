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
Mots de passe jamais stockés
```

_(28 caractères)_

Variante : `Une clef, aucun mot de passe` _(28)_

## 3. Texte promotionnel _(170 caractères max)_

Modifiable sans nouvelle version.

```
Aucun mot de passe stocké, nulle part : chacun est recalculé à la demande depuis votre clef. Sans compte, hors ligne, et sur tous vos appareils.
```

_(≈ 144 caractères)_

## 4. Description _(4 000 caractères max)_

```
Vos mots de passe ne sont stockés NULLE PART. Ni sur votre appareil, ni sur un serveur, ni dans un coffre chiffré. TheCode recalcule chacun d'eux à la demande, à partir d'une seule clef maîtresse que vous seul connaissez et du nom du site.

C'est ce qui le distingue des autres gestionnaires : il n'existe aucune base de mots de passe à pirater, à perdre ou à faire fuiter.

UNE CLEF. UN MOT DE PASSE PAR SITE.
• Même clef + même site = exactement le même mot de passe, sur chaque appareil.
• Sites différents = mots de passe sans rapport entre eux.
• Rien à voler : aucun mot de passe n'est jamais enregistré.

La dérivation (PBKDF2 à 600 000 itérations, puis HMAC-SHA256) est documentée, testée et reproductible : vos mots de passe ne dépendent pas de la survie d'un service.

TOUT LE STOCKAGE EST FACULTATIF
L'app fonctionne entièrement sans carnet, sans compte et sans synchronisation : une clef et un nom de site suffisent.
• Carnet local (facultatif) : retenez pour chaque site l'identifiant, la longueur et les caractères voulus — jamais le mot de passe. Il reste sur l'appareil, verrouillé par Face ID, Touch ID ou un mot de passe dédié.
• Transfert sans compte : envoyez le carnet vers vos autres apps TheCode par QR code chiffré ou par fichier chiffré.
• Compte (facultatif) : synchronisation automatique du carnet et des réglages par défaut, chiffrée de bout en bout. Le serveur ne voit jamais votre clef maîtresse, ni vos sites, ni vos identifiants. Connexion par e-mail, avec Google ou avec Apple.

FONCTIONNALITÉS
• Remplissage automatique sur iPhone, iPad et Mac : TheCode propose le mot de passe dans Safari et dans les apps, avec l'identifiant du compte
• Enregistrement proposé par le système : TheCode ne retient un compte que s'il sait en recalculer le mot de passe
• Mot de passe masqué par défaut, affiché d'un geste
• Longueur de 4 à 40 caractères, choix des minuscules, majuscules, chiffres, symboles
• Aucune publicité, aucun traceur, aucune mesure d'audience

CONFIDENTIALITÉ
• Votre clef maîtresse ne quitte jamais votre appareil : elle est gardée dans le trousseau.
• Sans compte, l'app ne contacte aucun serveur : tout fonctionne hors ligne.
• Avec un compte, le carnet est chiffré sur l'appareil avant d'être envoyé : le serveur ne voit ni vos sites, ni vos identifiants.
• La caméra ne sert qu'à lire un QR code de transfert ; aucune image n'est enregistrée.
• Code source ouvert sous licence Apache 2.0.

UN SEUL PROJET, SUR TOUS VOS APPAREILS
TheCode est un projet entièrement intégré et multiplateforme :
• Apps iPhone et iPad
• App Mac
• Application Android
• Extensions pour Chrome, Firefox, Edge, Brave et Safari
• Site thecode.julsql.fr
La même clef vous redonne les mêmes mots de passe sur chacun d'eux, même sans compte ni synchronisation.

SANS PUBLICITÉ
Aucune publicité, aucun traceur. La génération, le carnet et le remplissage fonctionnent sans compte ; un compte sert seulement à synchroniser vos appareils.

COMMENT ÇA MARCHE ?
1. Choisissez une clef maîtresse longue et mémorisez-la : elle ne peut pas être récupérée.
2. Saisissez un site (ex. « apple.com ») et, si besoin, l'identifiant.
3. Le mot de passe apparaît. Copiez-le, ou laissez le remplissage automatique l'insérer.
4. Activez TheCode dans Réglages > Général > Remplissage automatique et mots de passe (iOS), ou Réglages Système > Général > Remplissage automatique et mots de passe (macOS).
```

_(≈ 3 400 caractères)_

## 5. Mots-clés _(100 caractères max, séparés par des virgules, sans espace)_

```
gestionnaire,générateur,sans stockage,sécurité,clef,remplissage,autofill,hors ligne,open source
```

_(95 caractères)_ — « mots de passe » est déjà dans le nom, qu'Apple indexe : inutile de
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
| Achats intégrés         | Aucun           |
| Plateformes             | iPhone, iPad, Mac                                          |
| Confidentialité de l'app | Voir [`docs/store-privacy.md`](../../docs/store-privacy.md) |

**Informations pour l'examen** : l'app s'utilise sans compte. Pour la synchronisation, fournir un
compte de démonstration (adresse + mot de passe). Préciser que le fournisseur de remplissage
automatique s'active dans les Réglages.
