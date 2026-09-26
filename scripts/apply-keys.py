#!/usr/bin/env python3
"""Pose les identifiants de `keys.yml` là où le service les attend.

`keys.yml` vit à la racine, hors de git, et reste le seul endroit où ces
valeurs sont écrites à la main. Ce script les recopie — jamais l'inverse, et
jamais dans un fichier suivi par git :

    python3 scripts/apply-keys.py env    # -> apps/api/.env, pour tourner en local
    python3 scripts/apply-keys.py k8s    # -> secret du cluster, puis redémarrage
    python3 scripts/apply-keys.py check  # dit ce qui est présent, sans rien écrire

Aucune valeur n'est affichée : ce script tourne dans un terminal dont
l'historique reste, et un mot de passe d'application ouvre une boîte d'envoi.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KEYS = ROOT / "keys.yml"
ENV_FILE = ROOT / "apps" / "api" / ".env"

#: Ce que le service lit, et d'où ça vient dans `keys.yml`.
MAPPING = {
    "THECODE_GOOGLE_CLIENT_ID": "OAuth_Client.ID_client",
    # Client OAuth de type iOS, partagé par les apps iOS et macOS : leurs
    # jetons Google portent cet identifiant en audience. Public, comme tout
    # identifiant client ; c'est le code secret du client web qui ne l'est pas.
    "THECODE_GOOGLE_EXTRA_CLIENT_IDS": "OAuth_Client.ID_client_iOS",
    # « Se connecter avec Apple » : bundle id des apps iOS/macOS (audience de
    # leurs jetons) et Services ID du site. Publics, comme les précédents.
    "THECODE_APPLE_CLIENT_IDS": "Apple.Client_IDs",
    "THECODE_APPLE_WEB_CLIENT_ID": "Apple.Web_Client_ID",
    "THECODE_MAIL_USER": "Email.Host_User",
    "THECODE_MAIL_PASSWORD": "Email.Host_Password",
    # Facultatif : l'adresse affichée aux destinataires, quand elle diffère du
    # compte qui s'authentifie. Gmail ne l'accepte que si elle est déclarée
    # comme alias vérifié dans ses réglages — sinon il la réécrit en silence.
    "THECODE_MAIL_FROM": "Email.From",
    "THECODE_MAIL_HOST": "Email.Host",
    # Ne change rien à l'authentification : c'est là que partent les réponses
    # des humains, et cela garde l'adresse du domaine visible.
    "THECODE_MAIL_REPLY_TO": "Email.Reply_To",
}

#: Ce qui va avec, et qui n'est pas un secret. Ce que `keys.yml` précise
#: l'emporte : c'est lui que l'on modifie à la main.
FIXED = {
    "THECODE_MAIL_TRANSPORT": "smtp",
    "THECODE_MAIL_HOST": "smtp.gmail.com",
    "THECODE_MAIL_PORT": "587",
}


def read_keys() -> dict[str, str]:
    """Lit le fichier, deux niveaux, sans dépendance YAML.

    Le format est volontairement simple ; s'il devient plus riche, ce script
    doit le dire clairement plutôt que de deviner à moitié.
    """
    if not KEYS.is_file():
        sys.exit(f"{KEYS} est absent. Créez-le avec vos identifiants.")

    values: dict[str, str] = {}
    section = ""
    for number, line in enumerate(KEYS.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        match = re.match(r"^(\s*)([A-Za-z0-9_ -]+)\s*:\s*(.*)$", line)
        if not match:
            sys.exit(f"{KEYS}:{number} : ligne non comprise.")
        indent, key, value = match.groups()
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if not indent:
            section = key
            if value:
                values[key] = value
        else:
            values[f"{section}.{key}"] = value
    return values


def collect() -> dict[str, str]:
    values = read_keys()
    out = dict(FIXED)
    for target, source in MAPPING.items():
        found = values.get(source, "")
        if found:
            out[target] = found

    # Gmail réécrit l'expéditeur avec le compte authentifié : annoncer autre
    # chose ferait partir le courrier d'une adresse inattendue.
    if "THECODE_MAIL_USER" in out:
        out.setdefault("THECODE_MAIL_FROM", f"TheCode <{out['THECODE_MAIL_USER']}>")
    return out


def command_check() -> None:
    found = collect()
    for target in dict.fromkeys([*MAPPING, *FIXED]):
        state = "présent" if target in found else "MANQUANT"
        print(f"{target:<32} {state}")


def command_env() -> None:
    found = collect()
    lines = [
        "# Écrit par scripts/apply-keys.py depuis keys.yml. Ne pas commiter.",
        *(f"{key}={value}" for key, value in sorted(found.items())),
        "",
    ]
    ENV_FILE.write_text("\n".join(lines), encoding="utf-8")
    ENV_FILE.chmod(0o600)
    print(f"{ENV_FILE} écrit ({len(found)} variables).")


def command_k8s(host: str = "julsql-vps") -> None:
    found = collect()
    patch = json.dumps({"stringData": found})

    # Le contenu passe par l'entrée standard : en argument, il se retrouverait
    # dans la liste des processus de la machine distante et dans l'historique.
    remote = "sudo kubectl patch secret thecode-secrets -n thecode --type merge --patch-file /dev/stdin"
    result = subprocess.run(["ssh", host, remote], input=patch, text=True)
    if result.returncode != 0:
        sys.exit("Le secret n'a pas été modifié.")

    print("Secret mis à jour. Redémarrage du service…")
    subprocess.run(
        ["ssh", host, "sudo kubectl rollout restart deployment/thecode-api -n thecode"],
        check=False,
    )


def main(argv: list[str]) -> int:
    action = argv[1] if len(argv) > 1 else "check"
    if action == "check":
        command_check()
    elif action == "env":
        command_env()
    elif action == "k8s":
        command_k8s(*argv[2:3])
    else:
        sys.exit("Actions : check, env, k8s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
