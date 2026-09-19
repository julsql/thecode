"""Point d'entrée CLI pour `thecode`."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .canonical import canonical_site
from .core import generate_password, generate_password_v2
from .fingerprint import fingerprint, fingerprint_color
from .sync import (
    DEFAULT_ENDPOINT,
    Credentials,
    SyncError,
)
from .sync import (
    login as sync_login,
)
from .sync import (
    register as sync_register,
)
from .sync import (
    sync as sync_vault,
)
from .transfer import TransferError, export_vault, import_vault
from .variants import variants
from .vault import (
    DEFAULT_LENGTH,
    default_vault_path,
    find_all_by_domain,
    load,
    merge,
    new_entry,
    now_iso,
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
        "--algo",
        type=int,
        choices=(1, 2),
        default=2,
        help="Version de l'algorithme (défaut: 2). --algo 1 retrouve un mot de "
        "passe posé sur un site avant la v2",
    )
    parser.add_argument(
        "--migrate",
        action="store_true",
        help="Affiche l'ancien et le nouveau mot de passe d'une entrée, "
        "et la passe en v2 une fois le site mis à jour",
    )
    parser.add_argument(
        "--renew",
        action="store_true",
        help="Renouvelle le mot de passe d'une entrée : incrémente son compteur "
        "et affiche l'ancien et le nouveau côte à côte",
    )
    parser.add_argument(
        "--login",
        metavar="EMAIL",
        help="Se connecte au service de synchronisation (demande le mot de passe du compte)",
    )
    parser.add_argument(
        "--register",
        metavar="EMAIL",
        help="Crée un compte de synchronisation (demande un code d'invitation)",
    )
    parser.add_argument(
        "--logout",
        action="store_true",
        help="Oublie la session de synchronisation sur cet appareil",
    )
    parser.add_argument(
        "--sync",
        action="store_true",
        help="Synchronise le carnet : tire, fusionne, puis pousse",
    )
    parser.add_argument(
        "--endpoint",
        default=DEFAULT_ENDPOINT,
        help=f"Service de synchronisation (défaut: {DEFAULT_ENDPOINT})",
    )
    parser.add_argument(
        "--fingerprint",
        action="store_true",
        help="Affiche l'empreinte de la clef, pour vérifier qu'elle est bien saisie",
    )
    parser.add_argument(
        "--variants",
        action="store_true",
        help="Liste les mots de passe possibles quand on a oublié les réglages d'un site",
    )
    parser.add_argument(
        "--export",
        action="store_true",
        help="Exporte le carnet chiffré, à transférer vers un autre appareil",
    )
    parser.add_argument(
        "--import",
        dest="import_payload",
        metavar="PAYLOAD",
        help="Importe un carnet chiffré et le fusionne avec le carnet local",
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


def _derive(args, params, entry):
    """Dérive le mot de passe dans la version demandée par l'entrée."""
    version = entry["v"] if entry else args.algo
    if version >= 2:
        return generate_password_v2(
            params["site"],
            args.password,
            params["length"],
            params["lower"],
            params["upper"],
            params["symbols"],
            params["numbers"],
            login=(entry or {}).get("login") or args.account or "",
            counter=(entry or {}).get("counter", 1),
        )
    return generate_password(
        site=params["site"],
        key=args.password,
        length=params["length"],
        use_lower=params["lower"],
        use_upper=params["upper"],
        use_symbols=params["symbols"],
        use_numbers=params["numbers"],
    )


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

    if args.register or args.login:
        import getpass

        email = args.register or args.login
        prompt = "Mot de passe du compte de synchronisation : "
        account_password = getpass.getpass(prompt)
        try:
            if args.register:
                invite = getpass.getpass("Code d'invitation : ")
                sync_register(args.endpoint, email, account_password, invite)
                print(f"✓ Compte créé pour {email}.", file=sys.stderr)
                # L'offre, l'abonnement et les appareils se gèrent sur le
                # site, et nulle part ailleurs : le dire ici évite de chercher
                # une option qui n'existera pas.
                print(
                    "  Confirmez votre adresse et choisissez votre offre sur "
                    "https://thecode.julsql.fr/fr/account",
                    file=sys.stderr,
                )
            else:
                import socket

                sync_login(args.endpoint, email, account_password, socket.gethostname())
                print(f"✓ Connecté en tant que {email}.", file=sys.stderr)
        except SyncError as exc:
            print(f"Échec : {exc}", file=sys.stderr)
            return 1
        return 0

    if args.logout:
        Credentials.clear()
        print("✓ Session oubliée sur cet appareil.", file=sys.stderr)
        return 0

    if args.sync:
        creds = Credentials.load()
        if creds is None:
            print(
                "Aucune session : connectez-vous d'abord avec --login.", file=sys.stderr
            )
            return 1
        try:
            merged, conflicts, _ = sync_vault(vault_data, args.password, creds)
        except (SyncError, TransferError) as exc:
            print(f"Échec de synchronisation : {exc}", file=sys.stderr)
            return 1

        for conflict in conflicts:
            print(f"⚠ {conflict.kind} sur {conflict.entry_id} : {conflict.detail}", file=sys.stderr)

        save(merged, vault_path)
        kept = len([e for e in merged["entries"] if not e.get("deleted")])
        print(f"✓ Carnet synchronisé : {kept} entrée(s).", file=sys.stderr)
        return 0

    if args.fingerprint:
        fp = fingerprint(args.password)
        name, _ = fingerprint_color(args.password)
        # L'empreinte se mémorise à force d'être vue : une valeur différente
        # signale une faute de frappe avant qu'elle ne coûte un accès.
        print(f"{fp}  ({name})")
        return 0

    if args.variants:
        domain = canonical_site(args.site)
        # L'ancienne forme est incluse : un mot de passe créé avant
        # l'unification de la canonicalisation reste ainsi retrouvable.
        legacy = [args.site] if args.site != domain else []
        found = variants(domain, args.password, legacy_sites=legacy)
        print(f"{len(found)} possibilités pour {domain} :\n")
        for v in found:
            marker = "  " if v.site == domain else "* "
            print(f"{marker}{v.password}")
            print(f"    {v.describe()}" + ("" if v.site == domain else f"  [ancien site : {v.site}]"))
        print("\nUne fois la bonne reconnue, enregistrez-la avec --save.")
        return 0

    if args.export:
        # Le carnet ne contient aucun mot de passe, mais il révèle les sites et
        # les identifiants : il est chiffré avant de quitter l'appareil.
        print(export_vault(vault_data, args.password))
        return 0

    if args.import_payload:
        try:
            incoming = import_vault(args.import_payload, args.password)
        except TransferError as exc:
            print(f"Import impossible : {exc}", file=sys.stderr)
            return 1

        # On fusionne, jamais on n'écrase : un import qui remplace effacerait
        # les entrées créées sur cet appareil.
        merged, conflicts = merge(vault_data, incoming)
        for conflict in conflicts:
            print(f"⚠ {conflict.kind} sur {conflict.entry_id} : {conflict.detail}", file=sys.stderr)
        save(merged, vault_path)
        kept = len([e for e in merged["entries"] if not e.get("deleted")])
        print(f"✓ Carnet fusionné : {kept} entrée(s). ({vault_path})", file=sys.stderr)
        return 0

    entry, params = _resolve(args, vault_data)

    if args.migrate:
        if entry is None:
            print(f"Aucune entrée pour {canonical_site(args.site)} dans le carnet.", file=sys.stderr)
            return 1
        if entry["v"] >= 2:
            print(f"« {entry['label']} » est déjà en v{entry['v']}.", file=sys.stderr)
            return 0

        before = _derive(args, params, entry)
        after = generate_password_v2(
            entry["siteKey"], args.password, entry["length"],
            entry["charset"]["lower"], entry["charset"]["upper"],
            entry["charset"]["symbols"], entry["charset"]["numbers"],
            login=entry.get("login") or "", counter=entry.get("counter", 1),
        )
        # Les deux côte à côte : le nouveau ne sert à rien tant qu'il n'a pas
        # été posé sur le site, et l'ancien reste nécessaire pour s'y connecter.
        print(f"Migration de « {entry['label']} » vers la v2\n")
        print(f"  actuel   {before}")
        print(f"  nouveau  {after}\n")
        print("Changez le mot de passe sur le site, puis confirmez :")
        if input("  entrée migrée ? [o/N] ").strip().lower() not in ("o", "oui", "y", "yes"):
            print("Annulé, l'entrée reste en v1.", file=sys.stderr)
            return 0

        entry["v"] = 2
        entry["updatedAt"] = now_iso()
        save(vault_data, vault_path)
        print(f"✓ « {entry['label']} » est en v2.", file=sys.stderr)
        return 0

    if args.renew:
        if entry is None:
            print(f"Aucune entrée pour {canonical_site(args.site)} dans le carnet.", file=sys.stderr)
            return 1
        if entry["v"] < 2:
            # Le compteur n'entre pas dans la dérivation v1 : l'incrémenter ne
            # changerait rien, et le dire vaut mieux que de laisser croire que
            # le mot de passe a été renouvelé.
            print(
                f"« {entry['label']} » est en v1, où le compteur n'a aucun effet. "
                "Passez l'entrée en v2 avec --migrate pour pouvoir la renouveler.",
                file=sys.stderr,
            )
            return 1

        before = _derive(args, params, entry)
        after = generate_password_v2(
            entry["siteKey"], args.password, entry["length"],
            entry["charset"]["lower"], entry["charset"]["upper"],
            entry["charset"]["symbols"], entry["charset"]["numbers"],
            login=entry.get("login") or "", counter=entry["counter"] + 1,
        )
        # Les deux côte à côte : le nouveau ne sert à rien tant qu'il n'a pas
        # été posé sur le site, et l'ancien reste nécessaire pour s'y connecter.
        print(f"Renouvellement de « {entry['label']} » (compteur "
              f"{entry['counter']} → {entry['counter'] + 1})\n")
        print(f"  actuel   {before}")
        print(f"  nouveau  {after}\n")
        print("Changez le mot de passe sur le site, puis confirmez :")
        if input("  entrée renouvelée ? [o/N] ").strip().lower() not in ("o", "oui", "y", "yes"):
            print("Annulé, le compteur reste à "
                  f"{entry['counter']}.", file=sys.stderr)
            return 0

        entry["counter"] += 1
        entry["updatedAt"] = now_iso()
        save(vault_data, vault_path)
        print(f"✓ « {entry['label']} » renouvelée, compteur {entry['counter']}.", file=sys.stderr)
        return 0


    # La version de l'algorithme est portée par l'entrée : c'est ce qui permet
    # à la v1 et à la v2 de coexister, et donc de migrer site par site sans
    # changer d'un coup tous les mots de passe.
    pwd = _derive(args, params, entry)

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
                version=args.algo,
            )
            vault_data["entries"].append(entry)
            action = "ajoutée au"
            if entry["siteKey"] != params["site"]:
                # Le mot de passe affiché doit être celui de la nouvelle entrée,
                # dans sa version à elle. Dériver en v1 en dur ici rendait un
                # mot de passe que la lecture suivante ne retrouvait pas.
                pwd = _derive(args, {**params, "site": entry["siteKey"]}, entry)
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
