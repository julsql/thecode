"""Génération déterministe d'un mot de passe à partir d'un site et d'une clef.

Port Python de la logique de `thecode-website/src/utils.ts`.
"""

from __future__ import annotations

import hashlib

LOWER = "portezcviuxwhskyajgblndqfm"
UPPER = "THEQUICKBROWNFXJMPSVLAZYDG"
SYMBOLS = "@#&!)-%;<:*$+=/?>("
NUMBERS = "567438921"


def build_charset(use_lower: bool, use_upper: bool, use_symbols: bool, use_numbers: bool) -> list[str]:
    groups = [
        LOWER if use_lower else "",
        UPPER if use_upper else "",
        SYMBOLS if use_symbols else "",
        NUMBERS if use_numbers else "",
    ]
    return [g for g in groups if g]


def hash_to_int(input_str: str) -> int:
    # SHA-256 est volontaire : c'est le cœur de l'algorithme déterministe, qui DOIT
    # rester identique au site (`crypto.subtle.digest("SHA-256")`) et à l'extension.
    # Il ne s'agit pas de stockage de mot de passe (pas de hash en base), donc un KDF
    # lent (PBKDF2/scrypt) n'est pas applicable et casserait tous les secrets existants.
    # codeql[py/weak-sensitive-data-hashing]
    digest = hashlib.sha256(input_str.encode("utf-8")).hexdigest()
    return int(digest, 16)


def convert_to_base(x: int, charset_groups: list[str]) -> str:
    charset = "".join(charset_groups)
    base = len(charset)
    value = x
    result = ""
    while value >= 0:
        index = value % base
        result = charset[index] + result
        value = value // base - 1
        if value < 0:
            break
    return result


def get_unique_position(seed: int, used_positions: list[int], length: int) -> int:
    pos = seed % length
    while pos in used_positions:
        pos = (pos + 1) % length
    return pos


def apply_charset_replacement(seed: int, password: str, charset_groups: list[str]) -> str:
    length = len(password)
    if length < len(charset_groups):
        raise ValueError(f"Password must have at least {len(charset_groups)} characters")

    temp = seed
    positions: list[int] = []
    for _ in range(len(charset_groups)):
        pos = get_unique_position(temp, positions, length)
        positions.append(pos)
        temp //= length

    chars = list(password)
    temp = seed
    for i, pos in enumerate(positions):
        group = charset_groups[i]
        if group:
            index = temp % len(group)
            chars[pos] = group[index]
            temp //= len(group)

    return "".join(chars)


def generate_password(
    site: str,
    key: str,
    length: int = 20,
    use_lower: bool = True,
    use_upper: bool = True,
    use_symbols: bool = True,
    use_numbers: bool = True,
) -> str | None:
    charset_groups = build_charset(use_lower, use_upper, use_symbols, use_numbers)
    if not charset_groups or (not site and not key):
        return None
    seed = hash_to_int(site + key)
    raw = convert_to_base(seed, charset_groups)
    return apply_charset_replacement(seed, raw[:length], charset_groups)
