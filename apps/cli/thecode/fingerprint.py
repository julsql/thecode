"""Empreinte de la clef maîtresse.

Une faute de frappe sur la clef ne se voit pas : elle produit simplement un
autre mot de passe, valide en apparence. L'empreinte rend la clef
reconnaissable sans la révéler.

Spécification : shared/spec/fingerprint.md
"""

from __future__ import annotations

from functools import lru_cache

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

KDF_SALT = b"thecode-fingerprint/v1"
KDF_ITERATIONS = 600_000

#: Sans 0/O ni 1/I/L : une empreinte se lit parfois à voix haute, elle ne doit
#: laisser aucune hésitation. Il reste 31 caractères, ce qui introduit un biais
#: modulo minuscule (9/256 contre 8/256 pour les huit premiers) : sans
#: importance pour un repère visuel, qui n'a pas besoin d'être uniforme mais
#: d'être discriminant.
ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
LENGTH = 3

#: Douze teintes distinctes, pour un repère visuel immédiat.
COLORS = [
    ("rouge", "#e5484d"),
    ("orange", "#f76b15"),
    ("ambre", "#ffb224"),
    ("citron", "#bdee63"),
    ("vert", "#46a758"),
    ("emeraude", "#29a383"),
    ("cyan", "#00a2c7"),
    ("bleu", "#0090ff"),
    ("indigo", "#3e63dd"),
    ("violet", "#6e56cf"),
    ("magenta", "#d6409f"),
    ("rose", "#e93d82"),
]


@lru_cache(maxsize=8)
def _derive(master_key: str) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=KDF_SALT,
        iterations=KDF_ITERATIONS,
    )
    return kdf.derive(master_key.encode("utf-8"))


def fingerprint(master_key: str) -> str:
    """Trois caractères identifiant la clef, sans la révéler."""
    if not master_key:
        return ""
    raw = _derive(master_key)
    return "".join(ALPHABET[b % len(ALPHABET)] for b in raw[:LENGTH])


def fingerprint_color(master_key: str) -> tuple[str, str]:
    """Couleur associée : (nom, code hexadécimal)."""
    if not master_key:
        return ("", "")
    return COLORS[_derive(master_key)[LENGTH] % len(COLORS)]
