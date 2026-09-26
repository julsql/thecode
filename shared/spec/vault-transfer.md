# Transfert d'un carnet

Le carnet ne contient aucun mot de passe. Il révèle en revanche **sur quels
sites vous avez un compte et sous quel identifiant** — une photo d'écran suffit.
Il est donc chiffré avant de quitter l'appareil.

## Format (v2)

```
TC2.<base64url(sel)>.<base64url(nonce)>.<base64url(ciphertext)>
```

- `TC2` — version du format. Un lecteur qui ne la connaît pas refuse plutôt que
  d'interpréter au hasard. **`TC1` n'est plus lu** : il est refusé comme
  n'importe quelle version inconnue.
- `sel` — **16 octets aléatoires**, tirés à chaque export. Jamais réutilisés
  d'un export à l'autre.
- `nonce` — **12 octets aléatoires**, tirés à chaque export.
- `ciphertext` — le carnet compressé puis chiffré, **tag GCM de 16 octets
  concaténé à la fin** (sortie standard de WebCrypto, `AESGCM` de Python,
  `Cipher` de Java, `AES.GCM.SealedBox.ciphertext + tag` de CryptoKit).

Tout l'encodage est en **base64url sans remplissage** (RFC 4648 §5, sans `=`).
Le payload fait exactement quatre segments séparés par `.` ; un autre nombre est
un format inattendu. Un sel qui ne décode pas en 16 octets, ou un nonce qui ne
décode pas en 12, est refusé avant tout déchiffrement.

Le contenu chiffré est le JSON du carnet (UTF-8, sans espaces), passé en
**zlib** (RFC 1950 : en-tête de 2 octets, deflate brut, Adler-32 ; c'est ce
que rendent `zlib.compress` et `CompressionStream("deflate")` — le `.zlib`
d'Apple ne rend que le deflate brut, sans en-tête ni somme) : un carnet de
cinquante entrées tombe de ~10 Ko à ~2 Ko, ce qui tient dans un seul QR code.

## Chiffrement

**AES-256-GCM**. Le choix est dicté par la portabilité : c'est le seul
chiffrement authentifié disponible nativement sur les cinq plateformes.
XChaCha20-Poly1305 serait préférable pour la marge de nonce, mais WebCrypto ne
l'expose pas, et l'ajouter voudrait dire embarquer une bibliothèque dans une
extension de navigateur — davantage de code à auditer pour un gain théorique.

La clef vient de la clef maîtresse et du sel du payload :

```
tk  = PBKDF2-HMAC-SHA256(
        password   = UTF-8(clef maîtresse),
        salt       = UTF-8("thecode-transfer/v2") || sel,   // 19 + 16 = 35 octets
        iterations = 600000,
        dkLen      = 32)
aad = UTF-8("thecode/transfer/v2")                          // 19 octets
ciphertext || tag = AES-256-GCM-Encrypt(tk, nonce, zlib(JSON du carnet), aad)
```

`||` est la concaténation d'octets. L'étiquette est ASCII, sans octet nul ni
séparateur entre elle et le sel.

Argon2id résisterait mieux au matériel dédié, mais n'est disponible nativement
nulle part ici. PBKDF2 à 600 000 itérations est la recommandation OWASP pour
SHA-256, et reste tenable sur un téléphone.

Le **sel aléatoire** par export empêche de précalculer une table valable pour
tous les carnets : chaque payload intercepté doit être attaqué séparément.
L'**étiquette** versionnée qui le précède garantit qu'une même valeur dérivée ne
sert jamais à deux usages (mots de passe, empreinte, synchronisation,
transfert) : une faiblesse sur l'un n'exposerait pas l'autre.

Les **données associées** (`aad`) lient le bloc à son usage : un blob de
synchronisation (`thecode/entry/v2|…`, `thecode/settings/v2`, voir
`vault-sync.md`) ne se déchiffre pas comme un transfert, et réciproquement. Le
sel, lui, est authentifié implicitement : en changer un bit change la clef, et
le tag ne passe plus.

L'appareil qui reçoit connaît déjà la clef maîtresse puisque l'utilisateur la
saisit. Le transfert ne coûte donc aucune manipulation supplémentaire.

Vecteur : `vault-fixtures/transfer-vector.json` — `payload` à déchiffrer en
`vault`, `derivedTransferHex` (la clef `tk` attendue, en hexadécimal, pour
déboguer la dérivation), et `rejected` : des payloads que tout lecteur doit
refuser (`TC1`, sel altéré, chiffré sans `aad`).

## Découpage en plusieurs QR

Un QR code plafonne à ~2,9 Ko. Au-delà, le payload est découpé :

```
TC2m.<index>.<total>.<fragment>
```

- `body` = le payload privé de son préfixe `TC2.`, soit
  `<sel>.<nonce>.<ciphertext>` ;
- `body` est coupé en morceaux de **2600 caractères** (le dernier plus court) ;
  `total` est leur nombre, `index` va de 0 à `total - 1`, tous deux en décimal
  ASCII ;
- au réassemblage : `payload = "TC2." + fragment[0] + … + fragment[total-1]`.

Les fragments sont affichés en boucle ; le lecteur les accumule jusqu'à les
avoir tous. Un fragment lu deux fois est ignoré, l'ordre n'a pas d'importance,
et un index hors bornes est écarté plutôt que de corrompre l'assemblage — les
codes défilent sur l'écran d'en face, rien de tout cela n'est sous contrôle.

Un fragment contient lui-même des `.` (ceux qui séparent sel, nonce et
ciphertext) : le lecteur ne coupe l'en-tête que sur les **trois premiers** `.`
et garde le reste tel quel. Un code unique commence par `TC2.`, un fragment par
`TC2m.` ; un code `TC1.` ou `TC1m.` est refusé.

Le préfixe `TC2.` n'est pas répété dans chaque fragment : il est remis une fois
au réassemblage. La coupure à 2600 caractères laisse la place à l'en-tête
`TC2m.<index>.<total>.` qui s'ajoute à chaque morceau. Le sel de 16 octets
(22 caractères) ajouté par la v2 est dans `body` : il ne change ni la coupure
ni l'encodage des QR, qui restent en mode octet, correction L, comme le figent
les matrices de `vault-fixtures/qr-vectors.json` (indépendantes du format du
payload).

## Qui affiche, qui lit

|              | afficher                       | lire                     |
| ------------ | ------------------------------ | ------------------------ |
| CLI          | — (`--export` rend le payload) | `--import`               |
| Extension    | encodeur de `shared/js/qr.js`  | fichier                  |
| Site         | encodeur de `shared/js/qr.js`  | fichier                  |
| Android      | ZXing                          | caméra (ZXing + CameraX) |
| iOS et macOS | CoreImage                      | caméra (AVFoundation)    |

L'encodeur JavaScript est écrit à la main : l'extension ne livre que le code de
ce dépôt, et y ajouter une bibliothèque tierce contredirait l'argument utilisé
plus haut pour refuser XChaCha20. Les plateformes natives, elles, ont ce qu'il
faut dans le système ou dans une bibliothèque déjà nécessaire pour **lire** — un
décodeur ne s'écrit pas à la main.

`shared/vault-fixtures/qr-vectors.json` fige sept matrices attendues, relues par
un décodeur indépendant avant d'être figées. Un seul module de différence et le
code ne se scanne pas.

Le navigateur ne lit pas de QR : il importe un fichier. Une webcam et un
décodeur supplémentaires ne se justifiaient pas là où un fichier suffit, et le
fichier marche sur tous les navigateurs.

## À la réception

Le carnet reçu est **fusionné**, jamais substitué : cf. `vault-merge.md`. Un
import qui écraserait effacerait les entrées créées sur l'appareil qui reçoit.

Les conflits que la fusion refuse de trancher sont présentés à l'utilisateur
avant d'écrire quoi que ce soit.

## Ce que ce format ne protège pas

La **taille** du payload trahit approximativement le nombre d'entrées. C'est
accepté : masquer cela demanderait un remplissage de taille fixe, pour un gain
faible face à quelqu'un qui voit déjà votre écran.
