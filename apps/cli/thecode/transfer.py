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

from .vault import keep_supported

PREFIX = "TC1"
NONCE_BYTES = 12
KDF_SALT = b"thecode-transfer/v1"
KDF_ITERATIONS = 600_000


class TransferError(Exception):
    """Payload illisible : version inconnue, format cassé, ou mauvaise clef."""


def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _b64d(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def derive_transfer_key(master_key: str) -> bytes:
    """Dérive la clef de transfert.

    Le sel diffère de celui des mots de passe : sans cela la même valeur
    servirait à deux usages, et une faiblesse sur l'un exposerait l'autre.
    """
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=KDF_SALT,
        iterations=KDF_ITERATIONS,
    )
    return kdf.derive(master_key.encode("utf-8"))


def export_vault(vault: dict[str, Any], master_key: str) -> str:
    """Chiffre un carnet en un payload transportable."""
    plain = zlib.compress(
        json.dumps(vault, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), 9
    )
    nonce = os.urandom(NONCE_BYTES)
    cipher = AESGCM(derive_transfer_key(master_key)).encrypt(nonce, plain, None)
    return f"{PREFIX}.{_b64e(nonce)}.{_b64e(cipher)}"


def import_vault(payload: str, master_key: str) -> dict[str, Any]:
    """Déchiffre un payload. Lève TransferError si illisible."""
    parts = payload.strip().split(".")
    if len(parts) != 3:
        raise TransferError("Format inattendu : TC1.<nonce>.<donnees> attendu.")

    version, nonce_b64, cipher_b64 = parts
    if version != PREFIX:
        # Interpréter un format inconnu au hasard serait pire que refuser.
        raise TransferError(f"Version « {version} » inconnue, ce client lit {PREFIX}.")

    try:
        plain = AESGCM(derive_transfer_key(master_key)).decrypt(
            _b64d(nonce_b64), _b64d(cipher_b64), None
        )
    except Exception as exc:
        raise TransferError(
            "Déchiffrement impossible : clef maîtresse différente, ou données altérées."
        ) from exc

    # Le carnet n'accepte que la v2 : le reste est écarté dès la lecture.
    return keep_supported(json.loads(zlib.decompress(plain)))
