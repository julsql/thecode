# Empreinte de clé

Une faute de frappe sur la clef maîtresse ne se voit pas : elle produit
simplement un autre mot de passe, parfaitement valide en apparence. On ne s'en
aperçoit qu'au refus de connexion, sans savoir si le tort vient de la clef, du
site ou des paramètres.

L'empreinte rend la clef **reconnaissable sans la révéler**.

## Calcul

```
fp = PBKDF2-SHA256(clef, salt = "thecode-fingerprint/v1", iterations = 600000, dkLen = 32)
```

Puis :

- **trois caractères** pris dans un alphabet sans ambiguïté visuelle
  (`23456789ABCDEFGHJKMNPQRSTUVWXYZ` — ni `0`/`O`, ni `1`/`I`/`L`) ;
- **une couleur** parmi douze, pour un repère visuel immédiat.

Le sel diffère de celui des mots de passe et de celui du transfert : la même
valeur dérivée ne doit jamais servir à deux usages.

## Ce que l'empreinte révèle

Elle confirme une hypothèse de clef : qui la connaît peut tester une clef
candidate et savoir s'il a juste. Mais c'est déjà le cas avec n'importe quel mot
de passe généré, et le KDF à 600 000 itérations rend l'essai aussi coûteux
qu'une dérivation normale.

Trois caractères représentent ~15 bits : une collision arrive environ une fois
sur 32 768. Assez pour attraper une faute de frappe, trop peu pour prouver quoi
que ce soit — c'est un garde-fou, pas une authentification.

## Affichage

À côté du champ de saisie, dès que la clef est entrée. L'utilisateur mémorise
son empreinte à force de la voir ; une valeur différente saute aux yeux.
