"""Point d'entrée CLI pour `thecode`."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .canonical import canonical_site
from .core import generate_password
from .vault import (
    DEFAULT_LENGTH,
    default_vault_path,
    find_all_by_domain,
    load,
    new_entry,
    save,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="thecode",
        description="Génère un mot de passe déterministe à partir d'une clef et d'un site.",
    )
    parser.add_argument("-p", "--password", required=True, help="Mot de passe maître (clef)")
    parser.add_argument("site", help="Site pour lequel générer le mot de passe (ex: google.com)")
    parser.add_argument(
        "-l",
        "--length",
        type=int,
        default=None,
        help=f"Longueur du mot de passe (défaut: {DEFAULT_LENGTH}, ou celle de l'entrée du carnet)",
    )
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
    parser.add_argument(
        "--account",
        help="Identifiant du compte, quand plusieurs comptes existent pour ce site",
    )
    parser.add_argument(
        "--alias",
        action="append",
        default=[],
        metavar="DOMAINE",
        help="Rattache un domaine à l'entrée : google.fr et youtube.com "
        "partagent alors le mot de passe de google.com (répétable)",
    )
    parser.add_argument(
        "--save",
        action="store_true",
        help="Enregistre le site et ses paramètres dans le carnet, pour ne plus avoir à les retenir",
    )
    parser.add_argument(
        "--vault",
        type=Path,
        default=None,
        help=f"Emplacement du carnet (défaut: {default_vault_path()})",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="Liste les entrées du carnet et sort",
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


def _resolve(args, vault_data):
    """Choisit l'entrée du carnet à utiliser, et les paramètres qui vont avec.

    Le carnet prime sur les valeurs par défaut : c'est tout son intérêt, ne plus
    avoir à se souvenir qu'un site avait été réglé sans symboles. Un argument
    explicite reste prioritaire sur le carnet.
    """
    domain = canonical_site(args.site)
    matches = find_all_by_domain(vault_data, domain)

    if args.account:
        named = [e for e in matches if e.get("login") == args.account]
        if not named and not args.save:
            raise SystemExit(
                f"Aucun compte « {args.account} » pour {domain}. "
                "Utilisez --list pour voir les entrées connues, ou --save pour le créer."
            )
        matches = named

    if len(matches) > 1:
        logins = ", ".join(repr(e.get("login") or e.get("label", "")) for e in matches)
        raise SystemExit(
            f"Plusieurs comptes connus pour {domain} : {logins}. "
            "Précisez lequel avec --account."
        )

    entry = matches[0] if matches else None

    explicit = {
        "length": args.length,
        "lower": False if args.no_lower else None,
        "upper": False if args.no_upper else None,
        "symbols": False if args.no_symbols else None,
        "numbers": False if args.no_numbers else None,
    }

    if entry:
        charset = entry["charset"]
        params = {
            "site": entry["siteKey"],
            "length": explicit["length"] or entry["length"],
            "lower": charset["lower"] if explicit["lower"] is None else False,
            "upper": charset["upper"] if explicit["upper"] is None else False,
            "symbols": charset["symbols"] if explicit["symbols"] is None else False,
            "numbers": charset["numbers"] if explicit["numbers"] is None else False,
        }
    else:
        params = {
            "site": domain,
            "length": explicit["length"] or DEFAULT_LENGTH,
            "lower": not args.no_lower,
            "upper": not args.no_upper,
            "symbols": not args.no_symbols,
            "numbers": not args.no_numbers,
        }

    return entry, params


def _print_vault(vault_data) -> int:
    entries = [e for e in vault_data.get("entries", []) if not e.get("deleted")]
    if not entries:
        print("Carnet vide.")
        return 0
    for e in sorted(entries, key=lambda x: x.get("label", "")):
        charset = "".join(
            c for c, on in (("a", e["charset"]["lower"]), ("A", e["charset"]["upper"]),
                            ("#", e["charset"]["symbols"]), ("1", e["charset"]["numbers"])) if on
        )
        login = f" [{e['login']}]" if e.get("login") else ""
        print(f"{e.get('label', e['siteKey'])}{login}")
        print(f"  site      {e['siteKey']}")
        print(f"  domaines  {', '.join(e['domains'])}")
        print(f"  reglages  {e['length']} caracteres, {charset}  (v{e['v']}, compteur {e['counter']})")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    vault_path = args.vault or default_vault_path()
    vault_data = load(vault_path)

    if args.list:
        return _print_vault(vault_data)

    entry, params = _resolve(args, vault_data)

    pwd = generate_password(
        site=params["site"],
        key=args.password,
        length=params["length"],
        use_lower=params["lower"],
        use_upper=params["upper"],
        use_symbols=params["symbols"],
        use_numbers=params["numbers"],
    )

    if pwd is None:
        print("Erreur : aucune base de caractères sélectionnée ou entrées vides.", file=sys.stderr)
        return 1

    if args.save:
        if entry is None:
            # Un deuxième compte sur un site déjà connu a besoin d'un siteKey
            # distinct, sinon il produirait le même mot de passe : en v1 le
            # login n'entre pas dans la dérivation. Le suffixe est figé dans
            # l'entrée, donc invisible à l'usage.
            site_key = params["site"]
            if args.account and find_all_by_domain(vault_data, params["site"]):
                site_key = f"{params['site']}#{args.account}"

            entry = new_entry(
                site_key,
                label=f"{params['site']} ({args.account})" if args.account else params["site"],
                domains=[params["site"], *args.alias],
                login=args.account or "",
                length=params["length"],
                charset={
                    "lower": params["lower"],
                    "upper": params["upper"],
                    "symbols": params["symbols"],
                    "numbers": params["numbers"],
                },
            )
            vault_data["entries"].append(entry)
            action = "ajoutée au"
            if entry["siteKey"] != params["site"]:
                # Le mot de passe affiché doit être celui de la nouvelle entrée.
                pwd = generate_password(
                    site=entry["siteKey"],
                    key=args.password,
                    length=params["length"],
                    use_lower=params["lower"],
                    use_upper=params["upper"],
                    use_symbols=params["symbols"],
                    use_numbers=params["numbers"],
                )
        else:
            # siteKey n'est jamais réécrit : il produit le mot de passe, le
            # modifier en changerait un déjà en service.
            entry["length"] = params["length"]
            entry["charset"] = {
                "lower": params["lower"],
                "upper": params["upper"],
                "symbols": params["symbols"],
                "numbers": params["numbers"],
            }
            if args.alias:
                entry["domains"] = sorted({*entry["domains"], *args.alias})
            action = "mise à jour dans le"
        save(vault_data, vault_path)
        print(f"✓ Entrée « {entry['label']} » {action} carnet ({vault_path}).", file=sys.stderr)

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
