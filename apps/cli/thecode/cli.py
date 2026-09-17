"""Point d'entrée CLI pour `thecode`."""

from __future__ import annotations

import argparse
import sys

from .core import generate_password


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="thecode",
        description="Génère un mot de passe déterministe à partir d'une clef et d'un site.",
    )
    parser.add_argument("-p", "--password", required=True, help="Mot de passe maître (clef)")
    parser.add_argument("site", help="Site pour lequel générer le mot de passe (ex: google.com)")
    parser.add_argument("-l", "--length", type=int, default=20, help="Longueur du mot de passe (défaut: 20)")
    parser.add_argument("--no-lower", action="store_true", help="Désactive les minuscules")
    parser.add_argument("--no-upper", action="store_true", help="Désactive les majuscules")
    parser.add_argument("--no-symbols", action="store_true", help="Désactive les symboles")
    parser.add_argument("--no-numbers", action="store_true", help="Désactive les chiffres")
    parser.add_argument(
        "-s",
        "--show",
        action="store_true",
        help="Affiche le mot de passe sur stdout au lieu de le copier dans le presse-papiers",
    )
    return parser


def _copy_to_clipboard(value: str) -> bool:
    """Copie `value` dans le presse-papiers. Retourne False si indisponible."""
    try:
        import pyperclip  # import local : dépendance optionnelle à l'exécution
    except ImportError:
        return False
    try:
        pyperclip.copy(value)
        return True
    except pyperclip.PyperclipException:
        return False


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    pwd = generate_password(
        site=args.site,
        key=args.password,
        length=args.length,
        use_lower=not args.no_lower,
        use_upper=not args.no_upper,
        use_symbols=not args.no_symbols,
        use_numbers=not args.no_numbers,
    )

    if pwd is None:
        print("Erreur : aucune base de caractères sélectionnée ou entrées vides.", file=sys.stderr)
        return 1

    if args.show:
        # Sortie explicitement demandée par l'utilisateur (ex: pipe). Le secret
        # ne transite vers stdout que sur opt-in volontaire via --show.
        # codeql[py/clear-text-logging-sensitive-data]
        print(pwd)
        return 0

    if _copy_to_clipboard(pwd):
        print("✓ Mot de passe copié dans le presse-papiers.", file=sys.stderr)
        return 0

    print(
        "Presse-papiers indisponible. Relance avec --show pour afficher le mot de passe.",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
