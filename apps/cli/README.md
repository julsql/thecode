# thecode (CLI)

[![tests](https://github.com/julsql/thecode/actions/workflows/cli.yml/badge.svg)](https://github.com/julsql/thecode/actions/workflows/cli.yml)
[![Python](https://img.shields.io/badge/python-3.9%20%7C%203.10%20%7C%203.11%20%7C%203.12-blue)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](https://opensource.org/licenses/MIT)

Version ligne de commande de TheCode. Génère un mot de passe déterministe à partir d'une clef maître et d'un site, en utilisant la même logique que l'extension et le site web.

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

### Options

- `-p, --password` : clef maître (obligatoire)
- `-s, --show` : affiche le mot de passe sur stdout (par défaut il est copié dans le presse-papiers)
- `-l, --length` : longueur du mot de passe (défaut : celle de l'entrée du carnet, sinon le réglage par défaut)
- `--no-lower` / `--lower` : désactive / active les minuscules
- `--no-upper` / `--upper` : désactive / active les majuscules
- `--no-symbols` / `--symbols` : désactive / active les symboles
- `--no-numbers` / `--numbers` : désactive / active les chiffres

Une option explicite prime toujours, pour la commande en cours, sur l'entrée du carnet et sur les
réglages par défaut.

### Réglages par défaut

Longueur et jeux de caractères utilisés pour un site absent du carnet (d'usine : 20, tous les jeux).
Ils sont retenus dans `~/.config/thecode/settings.json` (ou `$XDG_CONFIG_HOME/thecode/`).

```bash
thecode --save-defaults -l 16 --no-symbols   # retient 16 caractères, sans symboles
thecode --save-defaults --symbols            # réactive les symboles, garde le reste
thecode --defaults                           # affiche les réglages retenus
```

Longueur bornée entre 4 et 40, au moins un jeu actif. Avec un compte lié, `--sync` les partage
après le carnet, chiffrés comme une entrée : la modification la plus récente l'emporte.

## Sans installation

```bash
python -m thecode.cli -p password google.com
```

## Tests

```bash
pip install -e .[test]
pytest
```
