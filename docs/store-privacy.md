# Confidentialité : réponses pour les stores

Réponses prêtes à reporter dans la Play Console (« Sécurité des données »), App Store Connect
(« Confidentialité de l'app »), le Chrome Web Store et addons.mozilla.org. Elles décrivent ce que
fait le code au 26 septembre 2026 ; la politique de confidentialité publiée
(`apps/website/src/legal/fr.ts`) dit la même chose, avec plus de détail.

URL de la politique de confidentialité : https://thecode.julsql.fr/fr/privacy (anglais :
https://thecode.julsql.fr/en/privacy).

## Les faits sur lesquels tout repose

- **Sans compte, rien ne part.** Génération, carnet et remplissage automatique fonctionnent hors
  ligne. Le compte est facultatif et ne sert qu'à la synchronisation.
- **Avec un compte**, le serveur reçoit et garde :
  - l'adresse e-mail (et sa date de confirmation) ;
  - une empreinte Argon2id du mot de passe du compte (aucune pour un compte Google/Apple qui n'en
    a pas défini) ;
  - l'identifiant `sub` Google ou Apple, s'il est utilisé pour se connecter ; l'adresse Apple peut
    être une adresse relais `@privaterelay.appleid.com` ;
  - par appareil connecté : le nom que donne le système (`Build.MODEL` sur Android,
    `UIDevice.current.name` sur iOS, nom de l'ordinateur sur macOS, « extension », « site web »),
    `app`/`web`, dates de création et d'expiration, révocation, jeton haché ;
  - offre, origine de l'offre, statut et fin de période d'abonnement, identifiants client et
    abonnement Stripe, codes d'invitation/parrainage/à vie utilisés ;
  - liens envoyés par courrier : jeton haché, expiration, nouvelle adresse demandée ;
  - le carnet et les réglages par défaut **chiffrés de bout en bout** (AES-256-GCM, clef dérivée
    de la clef maîtresse par PBKDF2) : le serveur ne peut pas les lire. Seul l'`entry_id` (UUID
    aléatoire) est en clair ;
  - l'adresse IP, dans les journaux techniques.
- **Jamais envoyés** : la clef maîtresse, les mots de passe (ils ne sont stockés nulle part), les
  sites et identifiants du carnet en clair, le mot de passe ou la méthode du verrou du carnet, les
  données biométriques, les images de la caméra.
- **Aucun SDK d'analyse, de publicité ou de suivi des plantages**, sur aucune plateforme.
- **Chiffrement en transit** : HTTPS vers l'API.
- **Suppression** : depuis la page du compte du site (https://thecode.julsql.fr/fr/account),
  immédiate et définitive (`DELETE /v1/account`), abonnement résilié d'abord. Export complet :
  `GET /v1/account/export`.
- **Sous-traitants** : hébergeur (UE), Stripe (paiement, sur le site uniquement), Google et Apple
  (connexion, si choisie), fournisseur de messagerie (courriers du compte).
- **Paiement** : uniquement sur le site, via Stripe. Aucun achat intégré dans les apps.

## Google Play — Sécurité des données

### Vue d'ensemble

| Question                                                                    | Réponse                                                                     |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| L'app collecte-t-elle ou partage-t-elle des types de données obligatoires ? | **Oui** (uniquement si l'utilisateur crée un compte de synchronisation)     |
| Toutes les données collectées sont-elles chiffrées en transit ?             | **Oui**                                                                     |
| Proposez-vous un moyen de demander la suppression des données ?             | **Oui** — https://thecode.julsql.fr/fr/account (voir « Points à trancher ») |
| L'app est-elle conforme aux Règles relatives aux familles ?                 | Non concernée (public cible : adultes)                                      |

### Types de données

| Catégorie → type                           | Collecté | Partagé | Facultatif                     | Finalités                                   |
| ------------------------------------------ | -------- | ------- | ------------------------------ | ------------------------------------------- |
| Informations personnelles → Adresse e-mail | Oui      | Non     | Oui (le compte est facultatif) | Fonctionnalités de l'app, Gestion du compte |
| Informations personnelles → ID utilisateur | Oui      | Non     | Oui                            | Fonctionnalités de l'app, Gestion du compte |

Tout le reste : **non collecté**. En particulier :

- **Carnet et réglages par défaut** : chiffrés de bout en bout, illisibles par le développeur.
  Google exclut explicitement ces données de la déclaration.
- **Position** : non. L'adresse IP est dans les journaux mais ne sert pas à localiser.
- **Informations financières / historique d'achat** : non collectées par l'app. L'abonnement est
  souscrit sur le site, via Stripe.
- **Activité dans l'app, historique de navigation, diagnostics, identifiants de l'appareil** : non.
  Le modèle de l'appareil (`Build.MODEL`, ex. « Pixel 8 ») sert de libellé dans la liste des
  appareils : ce n'est pas un identifiant au sens de Google.
- **Photos et vidéos** : non. La caméra ne lit que des QR codes, rien n'est enregistré ni envoyé.

« Partagé » vaut **Non** : Stripe, Google, Apple, l'hébergeur et le fournisseur de messagerie
agissent pour notre compte (prestataires de service), ce que Google ne compte pas comme un
partage.

### Permissions Android

| Permission                                | Justification                                                                                             |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `INTERNET`, `ACCESS_NETWORK_STATE`        | Synchronisation chiffrée facultative et connexion avec Google. Sans compte, aucun serveur n'est contacté. |
| `CAMERA` (facultative)                    | Lire le QR code d'un carnet affiché sur un autre appareil. Aucune image n'est enregistrée ni envoyée.     |
| `BIND_AUTOFILL_SERVICE` (service déclaré) | Service de saisie automatique : calcule sur l'appareil le mot de passe du site ou de l'app demandé.       |
| Biométrie (`androidx.biometric`)          | Déverrouiller la clef maîtresse et le carnet. Vérifiée par le système, rien n'est transmis.               |

## Apple — Confidentialité de l'app (iOS et macOS)

**Collectez-vous des données depuis cette app ?** Oui.

| Type de données                          | Lié à l'utilisateur | Suivi (tracking) | Finalités                |
| ---------------------------------------- | ------------------- | ---------------- | ------------------------ |
| Coordonnées → Adresse e-mail             | Oui                 | **Non**          | Fonctionnalités de l'app |
| Identifiants → Identifiant d'utilisateur | Oui                 | **Non**          | Fonctionnalités de l'app |

Tout le reste : **non collecté** (santé, finances, position, contacts, historique de navigation
et de recherche, achats, utilisation, diagnostics, données sensibles).

- **Contenu utilisateur** : le carnet synchronisé est chiffré de bout en bout ; le développeur ne
  peut pas y accéder. Au sens d'Apple, ce n'est pas une donnée « collectée ».
- **Achats** : non. Aucun achat intégré ; l'abonnement se prend sur le site.
- **Nom de l'appareil** : `UIDevice.current.name` (générique, « iPhone », depuis iOS 16) et le nom
  de l'ordinateur sur macOS servent de libellé dans la liste des appareils. Sur macOS, ce nom
  contient souvent le prénom de l'utilisateur : le déclarer en « Autres types de données », lié,
  « Fonctionnalités de l'app », est la réponse prudente.
- **Suivi** : aucun. Pas d'App Tracking Transparency à demander.
- **Suppression du compte** : depuis la page du compte du site (voir « Points à trancher »).

Textes d'usage déjà en place : `NSCameraUsageDescription` (lecture du QR code d'un carnet).

## Extension de navigateur

### Chrome Web Store — Pratiques de confidentialité

**Objectif unique**

> Calculer, sur l'appareil, le mot de passe de chaque site à partir d'une clef maîtresse, le
> proposer dans les champs de mot de passe, et synchroniser facultativement un carnet chiffré de
> bout en bout.

**Justification des permissions**

| Permission                    | Justification (à coller)                                                                                                                                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `identity`                    | Used only for the optional "Continue with Google" sign-in to the encrypted sync account, through `identity.launchWebAuthFlow` (OpenID Connect, scopes `openid email`). The ID token is sent to our sync server to open the account; no other Google API is called. |
| `storage`                     | Keeps the vault (sites, logins, settings — never passwords), the default settings, the vault-lock hash and the sync session on the device. The master key is held in `storage.session`, in memory only, and cleared when the browser closes.                       |
| `activeTab`                   | Reads the URL of the current tab when the user opens the popup, to compute the password for that site.                                                                                                                                                             |
| Host permissions `<all_urls>` | The content script must run on any site where the user logs in: it finds password fields and shows the computed password next to them. Nothing from the page is stored or sent.                                                                                    |
| Remote code                   | **No.** All code is bundled in the package.                                                                                                                                                                                                                        |

**Utilisation des données** (cases à cocher)

- Informations permettant d'identifier personnellement l'utilisateur : **oui** (adresse e-mail,
  uniquement avec un compte de synchronisation).
- Informations d'authentification : **oui** (mot de passe du compte de synchronisation, envoyé au
  serveur pour se connecter et conservé haché ; jeton Google).
- Santé, finances, communications personnelles, position, historique Web, activité de
  l'utilisateur, contenu des sites : **non**. L'URL de la page sert au calcul, localement, et
  n'est jamais envoyée.
- Les trois certifications (pas de vente, pas d'usage hors objectif unique, pas d'usage pour la
  solvabilité ou le prêt) : **cochées**.

### addons.mozilla.org

Texte pour les notes aux relecteurs et la politique de confidentialité de la fiche :

> The `identity` permission is only used for the optional "Continue with Google" sign-in
> (`browser.identity.launchWebAuthFlow`, OpenID Connect, scopes `openid email`) to the encrypted
> sync account. Host access to all URLs lets the content script find password fields on any login
> page and offer the password computed locally for that site; page content is never stored or
> transmitted. The only data sent off the device, and only with an account, is the account email,
> the account password (for sign-in), the Google ID token, and the end-to-end encrypted vault.
> No analytics, no tracking, no remote code.

Consentement à la collecte (`data_collection_permissions`, exigé par AMO pour les nouvelles
extensions) : non déclaré dans `manifest-safari-firefox.json` à ce jour. Valeur proposée, la
synchronisation étant facultative : `"required": ["none"]` et
`"optional": ["authenticationInfo", "personallyIdentifyingInfo"]`.

## Points à trancher avant de soumettre

1. **Suppression du compte depuis l'app.** Apple (règle 5.1.1(v)) et Google Play exigent qu'une
   app qui permet de **créer** un compte (ici : « Continuer avec Google » sur Android, « Se
   connecter avec Apple » et Google sur iOS/macOS) permette aussi d'en demander la suppression
   depuis l'app. Aujourd'hui, la suppression n'existe que sur le site. Un lien direct vers
   https://thecode.julsql.fr/fr/account depuis la section synchronisation peut suffire ; une
   suppression dans l'app est plus sûre.
2. **Révocation des jetons Apple.** Apple demande, à la suppression d'un compte ouvert avec « Se
   connecter avec Apple », d'appeler son API de révocation. Le serveur ne le fait pas.
3. **Abonnement vendu hors store.** L'offre complète se paie sur le site. Aucune des apps ne doit
   inciter à payer ailleurs (lien, bouton, prix) sans passer par les programmes prévus par Apple
   et Google : à vérifier dans les écrans de synchronisation.
4. **Fournisseur de messagerie** : à nommer dans la politique si l'on veut une liste exhaustive
   (la configuration par défaut pointe vers le SMTP de Gmail).
5. **Durées non vérifiables dans le code** : journaux techniques « quelques jours », sauvegardes
   « sept jours au maximum ». À confirmer côté hébergement.
