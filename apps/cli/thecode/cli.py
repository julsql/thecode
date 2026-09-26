"""Point d'entrée CLI pour `thecode`."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from . import settings as default_settings
from .canonical import canonical_site
from .core import generate_password, generate_password_v2
from .fingerprint import fingerprint, fingerprint_color
from .sync import (
    DEFAULT_ENDPOINT,
    SETTINGS_IGNORED,
    SETTINGS_PULLED,
    SETTINGS_PUSHED,
    Credentials,
    SyncError,
    is_paid_plan,
    sync_settings,
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
    Conflict,
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
    parser.add_argument("-p", "--password", help="Mot de passe maître (clef)")
    parser.add_argument(
        "site", nargs="?", help="Site pour lequel générer le mot de passe (ex: google.com)"
    )
    parser.add_argument(
        "-l",
        "--length",
        type=int,
        default=None,
        help="Longueur du mot de passe (défaut: celle de l'entrée du carnet, sinon le "
        "réglage par défaut, 20 d'usine)",
    )
    # --lower/--no-lower… : l'absence d'option reprend l'entrée du carnet ou le
    # réglage par défaut, la forme positive sert à réactiver un jeu éteint.
    for name, label in (
        ("lower", "les minuscules"),
        ("upper", "les majuscules"),
        ("symbols", "les symboles"),
        ("numbers", "les chiffres"),
    ):
        parser.add_argument(
            f"--{name}",
            action=argparse.BooleanOptionalAction,
            default=None,
            help=f"Active (--{name}) ou désactive (--no-{name}) {label}",
        )
    parser.add_argument(
        "--save-defaults",
        action="store_true",
        help="Retient --length et --[no-]lower/upper/symbols/numbers comme réglages par "
        "défaut des sites absents du carnet, puis sort (partagés avec le compte au --sync)",
    )
    parser.add_argument(
        "--defaults",
        action="store_true",
        help="Affiche les réglages par défaut retenus et sort",
    )
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
        "passe posé sur un site avant la v2, sans passer par le carnet",
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


def _explicit_charset(args) -> dict[str, bool | None]:
    """Les jeux de caractères donnés en option ; None pour ceux laissés libres."""
    return {k: getattr(args, k) for k in default_settings.CHARSET_KEYS}


def _resolve(args, vault_data, defaults=None):
    """Choisit l'entrée du carnet à utiliser, et les paramètres qui vont avec.

    Le carnet prime sur les réglages par défaut : c'est tout son intérêt, ne
    plus avoir à se souvenir qu'un site avait été réglé sans symboles. Un
    argument explicite reste prioritaire sur les deux.
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

    base = entry or defaults or default_settings.factory()
    charset = {
        k: base["charset"][k] if v is None else v for k, v in _explicit_charset(args).items()
    }
    params = {
        "site": entry["siteKey"] if entry else domain,
        "length": args.length or base["length"],
        **charset,
    }

    return entry, params


def _derive(args, params, entry):
    """Dérive le mot de passe : en v2 dès qu'une entrée du carnet est en jeu."""
    if entry or args.algo == 2:
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


def _t(fr: str, en: str) -> str:
    """Le message dans la langue du terminal.

    Français par défaut, comme le reste de la CLI : l'anglais seulement quand
    la locale le demande explicitement.
    """
    for var in ("LC_ALL", "LC_MESSAGES", "LANG"):
        value = os.environ.get(var, "")
        if value and value not in ("C", "POSIX") and not value.startswith("C."):
            return fr if value.lower().startswith("fr") else en
    return fr


def _describe_conflict(conflict: Conflict) -> str:
    """Une ligne lisible par conflit signalé à la fusion."""
    if conflict.kind == "doublon":
        # Rien n'est fusionné : c'est à l'utilisateur de supprimer l'entrée
        # qu'il ne veut pas.
        return _t(
            f"⚠ doublon : {conflict.entry_id} et {conflict.detail} semblent être le "
            "même compte (même identifiant, domaine commun)",
            f"⚠ duplicate: {conflict.entry_id} and {conflict.detail} look like the same "
            "account (same login, shared domain)",
        )
    return _t(
        f"⚠ {conflict.kind} sur {conflict.entry_id} : {conflict.detail}",
        f"⚠ {conflict.kind} on {conflict.entry_id}: {conflict.detail}",
    )


def _describe_defaults(chosen) -> str:
    return default_settings.describe(chosen, _t("caractères", "characters"))


def _sync_default_settings(master_key: str, creds) -> None:
    """Partage les réglages par défaut, après le carnet.

    Un échec ne défait pas la synchronisation du carnet, déjà enregistrée : on
    le signale et on garde les réglages locaux.
    """
    try:
        chosen, outcome, _ = sync_settings(default_settings.load(), master_key, creds)
    except (SyncError, TransferError) as exc:
        print(
            _t(
                f"⚠ Réglages par défaut non synchronisés : {exc}",
                f"⚠ Default settings not synced: {exc}",
            ),
            file=sys.stderr,
        )
        return
    if outcome == SETTINGS_PULLED:
        default_settings.save(chosen)
        print(
            _t(
                f"✓ Réglages par défaut repris du compte : {_describe_defaults(chosen)}.",
                f"✓ Default settings taken from the account: "
                f"{_describe_defaults(chosen)}.",
            ),
            file=sys.stderr,
        )
    elif outcome == SETTINGS_PUSHED:
        print(
            _t("✓ Réglages par défaut envoyés au compte.", "✓ Default settings sent to the account."),
            file=sys.stderr,
        )
    elif outcome == SETTINGS_IGNORED:
        print(
            _t(
                "⚠ Réglages par défaut du compte illisibles (autre clef maîtresse ?) : ignorés.",
                "⚠ The account's default settings are unreadable (another master key?): ignored.",
            ),
            file=sys.stderr,
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
        print(f"  reglages  {e['length']} caracteres, {charset}  (compteur {e['counter']})")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.defaults:
        current = default_settings.load()
        origin = (
            _t(f"retenus le {current['updatedAt']}", f"saved on {current['updatedAt']}")
            if current["updatedAt"]
            else _t("valeurs d'usine", "factory values")
        )
        print(f"{_describe_defaults(current)}  ({origin})")
        return 0

    if args.save_defaults:
        try:
            chosen = default_settings.updated(
                default_settings.load(), args.length, _explicit_charset(args)
            )
        except ValueError as exc:
            print(exc, file=sys.stderr)
            return 1
        default_settings.save(chosen)
        print(
            _t(
                f"✓ Réglages par défaut : {_describe_defaults(chosen)} "
                f"({default_settings.settings_path()}).",
                f"✓ Default settings: {_describe_defaults(chosen)} "
                f"({default_settings.settings_path()}).",
            ),
            file=sys.stderr,
        )
        return 0

    offline = args.list or args.logout or args.login or args.register
    if not offline and not args.password:
        parser.error("l'option -p/--password est requise")
    needs_site = not (
        offline or args.sync or args.fingerprint or args.export or args.import_payload
    )
    if needs_site and not args.site:
        parser.error("le site est requis (ex: google.com)")

    if args.save and args.algo != 2:
        # Le carnet n'accepte que la v2 : la v1 ne sert plus qu'à retrouver
        # ponctuellement un ancien mot de passe, sans rien enregistrer.
        print(
            "Le carnet n'accepte que la v2 : --save est incompatible avec --algo 1. "
            "Retirez --algo 1 pour enregistrer l'entrée en v2.",
            file=sys.stderr,
        )
        return 1

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
            merged, conflicts, local_only, creds = sync_vault(vault_data, args.password, creds)
        except (SyncError, TransferError) as exc:
            print(
                _t(f"Échec de synchronisation : {exc}", f"Sync failed: {exc}"), file=sys.stderr
            )
            return 1

        for conflict in conflicts:
            print(_describe_conflict(conflict), file=sys.stderr)

        save(merged, vault_path)
        kept = len([e for e in merged["entries"] if not e.get("deleted")]) - local_only
        # Au-delà du plafond, le reste ne part pas : le dire, sinon on croit
        # retrouver sur l'autre appareil ce qui n'y est jamais allé.
        local = (
            _t(
                f", {local_only} restée(s) sur cet appareil (plafond de l'offre gratuite)",
                f", {local_only} kept on this device (free plan limit)",
            )
            if local_only
            else ""
        )
        print(
            _t(
                f"✓ Carnet synchronisé : {kept} entrée(s){local}.",
                f"✓ Vault synced: {kept} entries{local}.",
            ),
            file=sys.stderr,
        )
        _sync_default_settings(args.password, creds)
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
            print(_t(f"Import impossible : {exc}", f"Import failed: {exc}"), file=sys.stderr)
            return 1

        # On fusionne, jamais on n'écrase : un import qui remplace effacerait
        # les entrées créées sur cet appareil.
        merged, conflicts = merge(vault_data, incoming)
        for conflict in conflicts:
            print(_describe_conflict(conflict), file=sys.stderr)
        save(merged, vault_path)
        kept = len([e for e in merged["entries"] if not e.get("deleted")])
        print(
            _t(
                f"✓ Carnet fusionné : {kept} entrée(s). ({vault_path})",
                f"✓ Vault merged: {kept} entries. ({vault_path})",
            ),
            file=sys.stderr,
        )
        return 0

    entry, params = _resolve(args, vault_data, default_settings.load())

    if args.renew:
        if entry is None:
            print(f"Aucune entrée pour {canonical_site(args.site)} dans le carnet.", file=sys.stderr)
            return 1

        # Le compteur — changer de mot de passe sans changer de clef — fait
        # partie de l'offre complète. Décidé ici, sur l'appareil : le compteur
        # voyage dans le bloc chiffré, le serveur ne le voit pas et ne peut
        # donc rien en dire.
        stored = Credentials.load()
        if not is_paid_plan(stored.plan if stored else None):
            print(
                "Renouveler un mot de passe sans changer de clef maîtresse fait partie "
                "de l'offre complète.\n"
                "  Votre offre : https://thecode.julsql.fr/fr/account",
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

    # Une entrée du carnet est toujours en v2 ; --algo 1 ne vaut que hors
    # carnet, pour retrouver un mot de passe posé avant la v2.
    pwd = _derive(args, params, entry)

    if pwd is None:
        print("Erreur : aucune base de caractères sélectionnée ou entrées vides.", file=sys.stderr)
        return 1

    if args.save:
        if entry is None:
            # Un deuxième compte sur un site déjà connu reçoit un siteKey
            # distinct, hérité de la v1 où le login n'entrait pas dans la
            # dérivation. Le suffixe est figé dans l'entrée, donc invisible à
            # l'usage.
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
                # Le mot de passe affiché doit être celui de la nouvelle entrée,
                # sinon la lecture suivante ne le retrouverait pas.
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
