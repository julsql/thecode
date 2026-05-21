# thecode (CLI)

[![tests](https://github.com/TheCodeDevLab/thecode-cli/actions/workflows/tests.yml/badge.svg)](https://github.com/TheCodeDevLab/thecode-cli/actions/workflows/tests.yml)
[![CodeQL](https://github.com/TheCodeDevLab/thecode-cli/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/TheCodeDevLab/thecode-cli/security/code-scanning)
[![Python](https://img.shields.io/badge/python-3.9%20%7C%203.10%20%7C%203.11%20%7C%203.12-blue)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](https://opensource.org/licenses/MIT)

Version ligne de commande de TheCode. Génère un mot de passe déterministe à partir d'une clef maître et d'un site, en utilisant la même logique que l'extension et le site web.

## Installation

```bash
cd thecode-cli
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
- `-l, --length` : longueur du mot de passe (défaut : 20)
- `--no-lower` : désactive les minuscules
- `--no-upper` : désactive les majuscules
- `--no-symbols` : désactive les symboles
- `--no-numbers` : désactive les chiffres

## Sans installation

```bash
python -m thecode.cli -p password google.com
```

## Tests

```bash
pip install -e .[test]
pytest
```
