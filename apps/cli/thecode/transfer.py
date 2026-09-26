"""Export et import chiffrés d'un carnet.

Le carnet ne contient aucun mot de passe. Il révèle en revanche sur quels sites
vous avez un compte et sous quel identifiant — une photo d'écran suffit. Il est
donc chiffré avant de quitter l'appareil.

Format et choix cryptographiques : shared/spec/vault-transfer.md
"""

from __future__ import annotations

import base64
import json
import os
import zlib
from typing import Any

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

PREFIX = "TC2"
#: En-tête des fragments quand le payload est découpé en plusieurs QR codes.
MULTIPART_PREFIX = "TC2m"
NONCE_BYTES = 12
SALT_BYTES = 16
KDF_ITERATIONS = 600_000
#: Préfixe du sel PBKDF2 ; le sel aléatoire du payload lui est concaténé.
KDF_LABEL = b"thecode-transfer/v2"
#: Données associées AES-GCM : un bloc chiffré pour un autre usage (entrée
#: synchronisée, réglages) ne se lit pas comme un transfert.
AAD = b"thecode/transfer/v2"


class TransferError(Exception):
    """Payload illisible : version inconnue, format cassé, ou mauvaise clef."""


def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _b64d(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def pbkdf2(master_key: str, salt: bytes) -> bytes:
    """PBKDF2-HMAC-SHA256, 600 000 itérations, 32 octets.

    La seule fonction de dérivation disponible nativement sur les cinq
    plateformes. Chaque usage passe son propre sel, préfixé d'une étiquette
    versionnée : une même valeur dérivée ne sert jamais à deux usages.
    """
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=KDF_ITERATIONS)
    return kdf.derive(master_key.encode("utf-8"))


def derive_transfer_key(master_key: str, salt: bytes) -> bytes:
    """Dérive la clef d'un transfert à partir du sel aléatoire de son payload.

    Un sel propre à chaque export : un attaquant ne peut pas précalculer une
    table valable pour tous les carnets.
    """
    return pbkdf2(master_key, KDF_LABEL + salt)


def export_vault(vault: dict[str, Any], master_key: str) -> str:
    """Chiffre un carnet en un payload transportable."""
    plain = zlib.compress(
        json.dumps(vault, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), 9
    )
    salt = os.urandom(SALT_BYTES)
    nonce = os.urandom(NONCE_BYTES)
    cipher = AESGCM(derive_transfer_key(master_key, salt)).encrypt(nonce, plain, AAD)
    return f"{PREFIX}.{_b64e(salt)}.{_b64e(nonce)}.{_b64e(cipher)}"


def import_vault(payload: str, master_key: str) -> dict[str, Any]:
    """Déchiffre un payload. Lève TransferError si illisible."""
    parts = payload.strip().split(".")
    if len(parts) >= 3 and parts[0] != PREFIX:
        # Interpréter un format inconnu au hasard serait pire que refuser.
        raise TransferError(f"Version « {parts[0]} » inconnue, ce client lit {PREFIX}.")
    if len(parts) != 4:
        raise TransferError(f"Format inattendu : {PREFIX}.<sel>.<nonce>.<donnees> attendu.")

    _, salt_b64, nonce_b64, cipher_b64 = parts
    try:
        salt, nonce, cipher = _b64d(salt_b64), _b64d(nonce_b64), _b64d(cipher_b64)
    except ValueError as exc:
        raise TransferError("Format inattendu : base64url invalide.") from exc
    if len(salt) != SALT_BYTES or len(nonce) != NONCE_BYTES:
        raise TransferError(
            f"Format inattendu : sel de {SALT_BYTES} octets et nonce de {NONCE_BYTES} attendus."
        )

    try:
        plain = AESGCM(derive_transfer_key(master_key, salt)).decrypt(nonce, cipher, AAD)
    except Exception as exc:
        raise TransferError(
            "Déchiffrement impossible : clef maîtresse différente, ou données altérées."
        ) from exc

    return json.loads(zlib.decompress(plain))
