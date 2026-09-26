# thecode (CLI)

[![tests](https://github.com/julsql/thecode/actions/workflows/cli.yml/badge.svg)](https://github.com/julsql/thecode/actions/workflows/cli.yml)
[![Python](https://img.shields.io/badge/python-3.9%2B-blue)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Version ligne de commande de TheCode. Génère un mot de passe déterministe à partir d'une clef
maîtresse et d'un site, avec le même algorithme que le site web, l'extension et les apps (v2 :
PBKDF2-SHA256 + HMAC-SHA256). Aucun mot de passe n'est stocké.

Le CLI sait aussi tenir un carnet local (réglages et identifiant de chaque site, jamais le mot de
passe), le transférer chiffré vers un autre appareil, et le synchroniser, chiffré de bout en bout,
avec un compte TheCode.

## Installation

```bash
cd thecode/apps/cli
pip install .
```

Ou en mode développement :

```bash
pip install -e .
```

## Utilisation

```bash
thecode -p <clef> <site>
```

Exemple :

```bash
thecode -p password google.com
```

`-p` est requis, sauf pour `--list`, `--defaults`, `--save-defaults`, `--login`, `--register` et
`--logout`.

### Génération

- `-p, --password` : clef maîtresse
- `site` : site pour lequel générer le mot de passe (ex. `google.com`), canonicalisé via la Public
  Suffix List
- `-s, --show` : affiche le mot de passe sur stdout (par défaut il est copié dans le presse-papiers)
- `-l, --length` : longueur du mot de passe, de 4 à 40 (défaut : celle de l'entrée du carnet, sinon
  le réglage par défaut)
- `--no-lower` / `--lower` : désactive / active les minuscules
- `--no-upper` / `--upper` : désactive / active les majuscules
- `--no-symbols` / `--symbols` : désactive / active les symboles
- `--no-numbers` / `--numbers` : désactive / active les chiffres
- `--account ACCOUNT` : identifiant du compte, quand plusieurs comptes existent pour ce site
- `--algo {1,2}` : version de l'algorithme (défaut : 2). `--algo 1` retrouve un mot de passe posé sur
  un site avant la v2, sans passer par le carnet
- `--fingerprint` : affiche l'empreinte de la clef, pour vérifier qu'elle est bien saisie
- `--variants` : liste les mots de passe possibles quand on a oublié les réglages d'un site

Une option explicite prime toujours, pour la commande en cours, sur l'entrée du carnet et sur les
réglages par défaut.

### Carnet

Le carnet vit dans `~/.config/thecode/vault.json` (ou `$XDG_CONFIG_HOME/thecode/`).

- `--save` : enregistre le site et ses paramètres dans le carnet
- `--alias DOMAINE` : rattache un domaine à l'entrée (`google.fr` et `youtube.com` partagent alors le
  mot de passe de `google.com`), répétable
- `--renew` : renouvelle le mot de passe d'une entrée (incrémente son compteur) et affiche l'ancien
  et le nouveau côte à côte
- `--list` : liste les entrées du carnet
- `--vault VAULT` : autre emplacement du carnet

### Réglages par défaut

Longueur et jeux de caractères utilisés pour un site absent du carnet (d'usine : 20, tous les jeux).
Ils sont retenus dans `~/.config/thecode/settings.json` (ou `$XDG_CONFIG_HOME/thecode/`).

```bash
thecode --save-defaults -l 16 --no-symbols   # retient 16 caractères, sans symboles
thecode --save-defaults --symbols            # réactive les symboles, garde le reste
thecode --defaults                           # affiche les réglages retenus
```

Longueur bornée entre 4 et 40, au moins un jeu actif.

### Transfert sans compte

```bash
thecode -p <clef> --export              # affiche le carnet chiffré (format TC2)
thecode -p <clef> --import 'TC2.…'      # le fusionne avec le carnet local
```

Le code est chiffré avec la clef maîtresse : il se lit aussi depuis les apps, l'extension et le
site.

### Compte et synchronisation

- `--register EMAIL` : crée un compte (demande le mot de passe du compte, puis un code d'invitation
  facultatif : l'inscription est ouverte, laisser vide)
- `--login EMAIL` : se connecte (demande le mot de passe du compte)
- `--logout` : oublie la session sur cet appareil
- `--sync` : synchronise le carnet puis les réglages par défaut (tire, fusionne, pousse)
- `--endpoint ENDPOINT` : service de synchronisation (défaut : `https://thecode-api.julsql.fr`)

La session est gardée dans `~/.config/thecode/session.json`. Le carnet et les réglages partent
chiffrés de bout en bout (AES-256-GCM, clef dérivée de la clef maîtresse et du sel du compte) : le
serveur ne voit que des blocs opaques. Pour les réglages, la modification la plus récente
l'emporte.

## Sans installation

```bash
python -m thecode.cli -p password google.com
```

## Tests

```bash
pip install -e .[test]
pytest
```

## Licence

MIT — voir [`LICENSE`](LICENSE).
