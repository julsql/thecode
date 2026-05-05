# thecode (CLI)

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
