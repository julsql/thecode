# Algorithme v2

La v1 hache `SHA-256(site + clef)`. Trois défauts, dont un grave.

## Ce qui est corrigé

### Collision de concaténation

`site + clef` sans séparateur : `("google.com", "abc")` et `("google.co", "mabc")`
produisent **le même mot de passe**. Reproduit, et figé dans les vecteurs v1.

La v2 sépare chaque champ par un octet nul, qu'aucun des champs ne peut
contenir.

### Absence de KDF — le défaut grave

SHA-256 se calcule par milliards par seconde sur du matériel courant. Un seul
mot de passe généré qui fuite permet donc de retrouver la clef maîtresse hors
ligne — et cette clef ouvre **tous** les comptes.

La v2 passe la clef dans un KDF coûteux avant toute dérivation.

### Login et compteur absents

Sans eux, deux comptes sur un même site donnent le même mot de passe, et rien ne
permet d'en changer un sans changer la clef maîtresse. Le carnet contourne cela
en v1 par des `siteKey` distincts ; la v2 le traite directement.

## Dérivation

`login` est pris **sans les espaces qui l'entourent** : chaque client retire les
espaces de début et de fin à la saisie, avant la dérivation et avant
l'enregistrement dans le carnet. Un espace collé en trop ne doit pas donner un
autre mot de passe.

```
mk   = PBKDF2-SHA256(clef, salt = "thecode-master/v2", iterations = 600000, dkLen = 32)
seed = HMAC-SHA256(mk, "thecode/v2" ‖ 0x00 ‖ siteKey ‖ 0x00 ‖ login ‖ 0x00 ‖ counter)
```

`counter` est encodé en décimal ASCII. Le rendu — conversion en base puis
garantie d'un caractère par groupe — reste **identique à la v1** : c'est la
partie qui a été mesurée saine (124,3 bits sur 126 annoncés en longueur 20).

### Pourquoi PBKDF2 et non Argon2id

Argon2id résiste mieux au matériel dédié et serait le choix par défaut. Il n'est
disponible nativement sur aucune des cinq plateformes, et l'embarquer signifie
une bibliothèque de plus à auditer dans une extension de navigateur.

PBKDF2-SHA256 à 600 000 itérations est la recommandation OWASP pour SHA-256, et
reste tenable sur un téléphone. Le gain face à la v1 — de « quelques
nanosecondes » à « quelques centaines de millisecondes » par essai — est de sept
ordres de grandeur, là où l'écart entre PBKDF2 et Argon2id se compte en
dizaines. C'est le premier saut qui compte.

Le sel diffère de ceux du transfert et de l'empreinte : une même valeur dérivée
ne doit jamais servir à deux usages.

## Carnet et v1

Toute entrée du carnet dérive en v2 : une entrée ne porte pas de champ de
version (voir vault-merge.md). La v1 ne subsiste qu'en génération ponctuelle,
hors carnet, pour retrouver un mot de passe posé sur un site avant la v2.

Le **renouvellement** incrémente `counter` : l'ancien et le nouveau mot de passe
s'affichent, et rien n'est écrit tant que ce n'est pas confirmé — incrémenter
d'abord rendrait le compte inaccessible, l'ancien mot de passe étant encore
celui du site.
