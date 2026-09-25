"""Carnet de métadonnées TheCode.

Le carnet ne contient **jamais** de mot de passe ni de clef maîtresse : seulement
de quoi rejouer une dérivation. Une fuite révèle les sites et les identifiants,
pas les mots de passe.

Il résout trois choses que l'algorithme seul ne peut pas :

- plusieurs comptes sur un même site, via des ``siteKey`` distincts ;
- les paramètres qu'on oublie, puisqu'ils sont stockés par entrée et non
  globalement ;
- un même compte sur plusieurs domaines, via ``domains``.

Le schéma est décrit dans ``shared/vault.schema.json`` et les règles de fusion
dans ``shared/spec/vault-merge.md``.
"""

from __future__ import annotations

import json
import os
import uuid
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCHEMA_VERSION = 1

#: Seule version d'algorithme admise dans le carnet. La v1 ne subsiste qu'en
#: génération ponctuelle, hors carnet (shared/spec/vault-merge.md).
ENTRY_VERSION = 2

#: Champs jamais fusionnés automatiquement : ils déterminent le mot de passe.
_NEVER_MERGED = ("siteKey",)

#: Valeurs par défaut d'une entrée neuve, alignées sur celles des applications.
DEFAULT_CHARSET = {"lower": True, "upper": True, "symbols": True, "numbers": True}
DEFAULT_LENGTH = 20


def _canonical(entry: dict[str, Any]) -> str:
    """Forme canonique d'une entrée, pour départager de façon déterministe.

    Compacte, clés triées à tous les niveaux, ``deleted`` faux retiré. La forme
    est fixée par ``shared/spec/vault-merge.md`` et non laissée au sérialiseur
    de chaque plateforme : deux appareils qui n'écrivent pas la même chaîne
    désignent un gagnant différent et ne convergent jamais.
    """
    normalised = {k: v for k, v in entry.items() if not (k == "deleted" and not v)}
    return json.dumps(
        normalised, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    )


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@dataclass
class Conflict:
    """Un désaccord que la fusion refuse de trancher toute seule."""

    kind: str
    entry_id: str
    detail: str = ""


def new_entry(
    site_key: str,
    *,
    label: str = "",
    domains: Iterable[str] | None = None,
    login: str = "",
    length: int = DEFAULT_LENGTH,
    charset: dict[str, bool] | None = None,
    version: int = 2,
) -> dict[str, Any]:
    """Crée une entrée.

    ``site_key`` est figé ici pour toujours : il ne suit pas les évolutions de
    la canonicalisation, sinon une mise à jour de la PSL changerait des mots de
    passe existants.

    Le carnet n'accepte que la v2 : toute autre version est refusée.
    """
    if version != ENTRY_VERSION:
        raise ValueError(
            f"Le carnet n'accepte que des entrées v{ENTRY_VERSION}, pas v{version}."
        )
    return {
        "id": str(uuid.uuid4()),
        "label": label or site_key,
        "siteKey": site_key,
        "domains": sorted(set(domains or [site_key])),
        "login": login,
        "counter": 1,
        "length": length,
        "charset": dict(charset or DEFAULT_CHARSET),
        "v": version,
        "updatedAt": now_iso(),
    }


def keep_supported(vault: dict[str, Any]) -> dict[str, Any]:
    """Écarte, sans erreur, toute entrée dont ``v`` n'est pas 2.

    Appliqué à chaque lecture (chargement, import, synchronisation) : une
    entrée v1 ou d'une version future disparaît ainsi du carnet local à la
    prochaine écriture.
    """
    entries = [e for e in vault.get("entries", []) if e.get("v") == ENTRY_VERSION]
    return {**vault, "entries": entries}


def default_vault_path() -> Path:
    """Emplacement du carnet, suivant la convention XDG.

    Le carnet n'est pas un secret, mais il révèle les sites et identifiants :
    il mérite le dossier de configuration de l'utilisateur, pas /tmp.
    """
    base = os.environ.get("XDG_CONFIG_HOME")
    root = Path(base) if base else Path.home() / ".config"
    return root / "thecode" / "vault.json"


def empty_vault() -> dict[str, Any]:
    return {"schema": SCHEMA_VERSION, "updatedAt": now_iso(), "entries": []}


def find_by_domain(vault: dict[str, Any], domain: str) -> dict[str, Any] | None:
    """Retrouve l'entrée qui couvre ce domaine.

    C'est ce qui permet à google.com, google.fr et youtube.com de partager un
    mot de passe : ils pointent tous vers la même entrée.
    """
    target = domain.lower()
    for entry in vault.get("entries", []):
        if entry.get("deleted"):
            continue
        if target in (d.lower() for d in entry.get("domains", [])):
            return entry
    return None


def find_all_by_domain(vault: dict[str, Any], domain: str) -> list[dict[str, Any]]:
    """Toutes les entrées couvrant ce domaine : plusieurs comptes sur un site."""
    target = domain.lower()
    return [
        e
        for e in vault.get("entries", [])
        if not e.get("deleted") and target in (d.lower() for d in e.get("domains", []))
    ]


def _merge_entry(
    left: dict[str, Any], right: dict[str, Any], conflicts: list[Conflict]
) -> dict[str, Any]:
    """Fusionne deux versions d'une même entrée. Voir shared/spec/vault-merge.md."""
    # Égalité d'horodatage : on départage sur la représentation canonique, la
    # plus petite l'emportant. Départager sur la position ne serait pas
    # commutatif — chaque appareil garderait le sien — et l'id ne peut pas
    # servir puisque les deux entrées portent la même.
    if left["updatedAt"] != right["updatedAt"]:
        winner = left if left["updatedAt"] > right["updatedAt"] else right
    else:
        winner = min(left, right, key=_canonical)

    loser = right if winner is left else left

    merged = dict(winner)

    # siteKey produit le mot de passe : on ne choisit jamais à la place de
    # l'utilisateur. On garde celui de gauche et on signale.
    for key in _NEVER_MERGED:
        if left.get(key) != right.get(key):
            conflicts.append(
                Conflict(
                    "sitekey-divergent",
                    left["id"],
                    f"{left.get(key)!r} vs {right.get(key)!r}",
                )
            )
            merged[key] = left[key]

    # Union : une addition de chaque côté ne doit pas en effacer une autre.
    merged["domains"] = sorted(set(left.get("domains", [])) | set(right.get("domains", [])))

    # Un compteur ne recule pas : une valeur haute signifie déjà renouvelé.
    high, low = max(left["counter"], right["counter"]), min(left["counter"], right["counter"])
    merged["counter"] = high
    if high != low and winner["counter"] == low:
        conflicts.append(
            Conflict(
                "counter-recul",
                left["id"],
                f"le plus recent porte {low}, on garde {high}",
            )
        )

    # Une suppression se propage, sinon l'autre carnet ressusciterait l'entrée.
    if left.get("deleted") or right.get("deleted"):
        merged["deleted"] = True

    merged["updatedAt"] = max(left["updatedAt"], right["updatedAt"])
    _ = loser
    return merged


def merge(
    left: dict[str, Any], right: dict[str, Any]
) -> tuple[dict[str, Any], list[Conflict]]:
    """Fusionne deux carnets.

    Commutative et idempotente : l'ordre de synchronisation des appareils ne
    doit pas changer le résultat, sinon ils ne convergent jamais.
    """
    conflicts: list[Conflict] = []
    left, right = keep_supported(left), keep_supported(right)
    by_id: dict[str, dict[str, Any]] = {e["id"]: e for e in left.get("entries", [])}

    for entry in right.get("entries", []):
        existing = by_id.get(entry["id"])
        by_id[entry["id"]] = (
            _merge_entry(existing, entry, conflicts) if existing else dict(entry)
        )

    entries = sorted(by_id.values(), key=lambda e: e["id"])
    updated = max(
        [left.get("updatedAt", ""), right.get("updatedAt", "")]
        + [e["updatedAt"] for e in entries],
        default=now_iso(),
    )
    return {"schema": SCHEMA_VERSION, "updatedAt": updated, "entries": entries}, conflicts


def load(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return empty_vault()
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schema") != SCHEMA_VERSION:
        raise ValueError(
            f"Carnet en version {data.get('schema')}, attendu {SCHEMA_VERSION}"
        )
    return keep_supported(data)


def save(vault: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    vault["updatedAt"] = now_iso()
    # Écriture atomique : une interruption ne doit pas laisser un carnet
    # tronqué, qui ferait perdre toutes les entrées.
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(vault, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(path)
