# Transfert d'un carnet

Le carnet ne contient aucun mot de passe. Il révèle en revanche **sur quels
sites vous avez un compte et sous quel identifiant** — une photo d'écran suffit.
Il est donc chiffré avant de quitter l'appareil.

## Format

```
TC1.<base64url(nonce)>.<base64url(ciphertext)>
```

- `TC1` — version du format. Un lecteur qui ne la connaît pas refuse plutôt que
  d'interpréter au hasard.
- `nonce` — 12 octets aléatoires, **jamais réutilisés** avec la même clef.
- `ciphertext` — le carnet compressé puis chiffré, tag d'authentification inclus.

Le contenu chiffré est le JSON du carnet passé en **deflate** : un carnet de
cinquante entrées tombe de ~10 Ko à ~2 Ko, ce qui tient dans un seul QR code.

## Chiffrement

**AES-256-GCM**. Le choix est dicté par la portabilité : c'est le seul
chiffrement authentifié disponible nativement sur les cinq plateformes.
XChaCha20-Poly1305 serait préférable pour la marge de nonce, mais WebCrypto ne
l'expose pas, et l'ajouter voudrait dire embarquer une bibliothèque dans une
extension de navigateur — davantage de code à auditer pour un gain théorique.

La clef vient de la clef maîtresse, avec un sel distinct de celui des mots de
passe :

```
tk = PBKDF2-SHA256(clef, salt = "thecode-transfer/v1", iterations = 600000, dkLen = 32)
```

Argon2id résisterait mieux au matériel dédié, mais n'est disponible nativement
nulle part ici. PBKDF2 à 600 000 itérations est la recommandation OWASP pour
SHA-256, et reste tenable sur un téléphone.

Le sel distinct est essentiel : sans lui, la même valeur dérivée servirait à
deux usages différents, et une faiblesse sur l'un exposerait l'autre.

L'appareil qui reçoit connaît déjà la clef maîtresse puisque l'utilisateur la
saisit. Le transfert ne coûte donc aucune manipulation supplémentaire.

## Découpage en plusieurs QR

Un QR code plafonne à ~2,9 Ko. Au-delà, le payload est découpé :

```
TC1m.<index>.<total>.<base64url(fragment)>
```

Les fragments sont affichés en boucle ; le lecteur les accumule jusqu'à les
avoir tous. Un fragment lu deux fois est ignoré, l'ordre n'a pas d'importance.

## À la réception

Le carnet reçu est **fusionné**, jamais substitué : cf. `vault-merge.md`. Un
import qui écraserait effacerait les entrées créées sur l'appareil qui reçoit.

Les conflits que la fusion refuse de trancher sont présentés à l'utilisateur
avant d'écrire quoi que ce soit.

## Ce que ce format ne protège pas

La **taille** du payload trahit approximativement le nombre d'entrées. C'est
accepté : masquer cela demanderait un remplissage de taille fixe, pour un gain
faible face à quelqu'un qui voit déjà votre écran.
