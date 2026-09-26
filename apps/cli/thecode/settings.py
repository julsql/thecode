"""Réglages par défaut : longueur et jeux de caractères d'un site hors carnet.

Voir shared/spec/default-settings.md. Une entrée du carnet garde toujours ses
propres réglages ; ceux-ci ne servent qu'aux sites qu'il ne connaît pas.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .vault import DEFAULT_CHARSET, DEFAULT_LENGTH, now_iso

MIN_LENGTH = 4
MAX_LENGTH = 40
CHARSET_KEYS = ("lower", "upper", "symbols", "numbers")


def factory() -> dict[str, Any]:
    """Valeurs d'usine. ``updatedAt`` vide : jamais modifiés sur cet appareil."""
    return {"length": DEFAULT_LENGTH, "charset": dict(DEFAULT_CHARSET), "updatedAt": ""}


def settings_path() -> Path:
    """À côté du carnet et de la session, suivant la convention XDG."""
    base = os.environ.get("XDG_CONFIG_HOME")
    root = Path(base) if base else Path.home() / ".config"
    return root / "thecode" / "settings.json"


def instant(settings: dict[str, Any]) -> datetime:
    """Le moment de la dernière modification, comparable d'un client à l'autre.

    Comparer les chaînes se tromperait dès qu'un client écrit des millisecondes
    (« 10:30:00.5Z » précède « 10:30:00Z » dans l'ordre lexical). Illisible ou
    vide : le plus ancien possible.
    """
    value = settings.get("updatedAt") or ""
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def is_valid(settings: Any) -> bool:
    """Vrai pour des réglages utilisables tels quels.

    Vérifié aussi sur ce qui vient du compte : un blob déchiffrable mais
    incohérent ne doit pas remplacer des réglages qui marchent.
    """
    if not isinstance(settings, dict):
        return False
    length = settings.get("length")
    charset = settings.get("charset")
    if not isinstance(length, int) or isinstance(length, bool):
        return False
    if not MIN_LENGTH <= length <= MAX_LENGTH or not isinstance(charset, dict):
        return False
    if any(not isinstance(charset.get(k), bool) for k in CHARSET_KEYS):
        return False
    return any(charset[k] for k in CHARSET_KEYS) and isinstance(settings.get("updatedAt"), str)


def normalise(settings: dict[str, Any]) -> dict[str, Any]:
    """Ne garde que les champs de la spec, dans leur forme canonique."""
    return {
        "length": settings["length"],
        "charset": {k: settings["charset"][k] for k in CHARSET_KEYS},
        "updatedAt": settings["updatedAt"],
    }


def load() -> dict[str, Any]:
    """Les réglages retenus, ou ceux d'usine si rien d'utilisable n'est retenu."""
    path = settings_path()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return factory()
    return normalise(data) if is_valid(data) else factory()


def save(settings: dict[str, Any]) -> None:
    path = settings_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(normalise(settings), indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def updated(
    current: dict[str, Any], length: int | None, charset: dict[str, bool | None]
) -> dict[str, Any]:
    """Les réglages modifiés par les options explicites, datés de maintenant.

    Lève ``ValueError`` si le résultat sort des bornes.
    """
    result = {
        "length": current["length"] if length is None else length,
        "charset": {
            k: current["charset"][k] if charset.get(k) is None else bool(charset[k])
            for k in CHARSET_KEYS
        },
        "updatedAt": now_iso(),
    }
    if not MIN_LENGTH <= result["length"] <= MAX_LENGTH:
        raise ValueError(f"La longueur doit être comprise entre {MIN_LENGTH} et {MAX_LENGTH}.")
    if not any(result["charset"].values()):
        raise ValueError("Au moins un jeu de caractères doit rester actif.")
    return result


def describe(settings: dict[str, Any], unit: str = "caractères") -> str:
    """Une ligne lisible, dans la notation de ``--list`` (aA#1)."""
    marks = (("lower", "a"), ("upper", "A"), ("symbols", "#"), ("numbers", "1"))
    charset = "".join(m for k, m in marks if settings["charset"][k])
    return f"{settings['length']} {unit}, {charset}"
