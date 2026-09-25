"""Client de synchronisation.

Le carnet est chiffré **avant** de quitter l'appareil, avec la clef de
transfert dérivée de la clef maîtresse. Le serveur ne reçoit que des blocs
opaques : il ne peut ni lire les sites, ni les identifiants, ni rien déduire
au-delà du nombre d'entrées.

Les identifiants du compte de synchronisation sont volontairement distincts de
la clef maîtresse. S'authentifier avec celle-ci ferait qu'une faiblesse du
service exposerait les mots de passe eux-mêmes.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .transfer import derive_transfer_key
from .vault import Conflict, drop_version, merge, select_for_push

DEFAULT_ENDPOINT = "https://thecode-api.julsql.fr"


class SyncError(Exception):
    """Échec de synchronisation : réseau, authentification, ou conflit."""


PLAN_FREE = "free"
PLAN_PRO = "pro"


def is_paid_plan(plan: str | None) -> bool:
    """Vrai quand l'offre donne droit au compteur."""
    return plan == PLAN_PRO


@dataclass
class Credentials:
    """Jetons de session. Stockés à part du carnet, et jamais dans le carnet."""

    endpoint: str
    access_token: str
    refresh_token: str
    #: Offre du compte, telle que le service l'a dite la dernière fois.
    #:
    #: Gardée avec les jetons parce que la génération se fait hors ligne : sans
    #: cette trace, la commande ne saurait pas quoi autoriser tant que le
    #: service n'a pas répondu, et autoriserait donc tout.
    plan: str = PLAN_FREE

    @staticmethod
    def path() -> Path:
        base = os.environ.get("XDG_CONFIG_HOME")
        root = Path(base) if base else Path.home() / ".config"
        return root / "thecode" / "session.json"

    def save(self) -> None:
        path = self.path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.__dict__, indent=2) + "\n", encoding="utf-8")
        # Les jetons ouvrent le compte : personne d'autre n'a à les lire.
        path.chmod(0o600)

    @classmethod
    def load(cls) -> Credentials | None:
        path = cls.path()
        if not path.is_file():
            return None
        try:
            return cls(**json.loads(path.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, TypeError):
            return None

    @classmethod
    def clear(cls) -> None:
        cls.path().unlink(missing_ok=True)


def _request(url: str, payload: dict | None = None, token: str = "", method: str = "") -> Any:
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(
        url,
        data=data,
        method=method or ("POST" if data else "GET"),
        headers={
            "Content-Type": "application/json",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read()
            return json.loads(body) if body else None
    except urllib.error.HTTPError as exc:
        # Le corps porte souvent un message utile ; s'il est illisible on se
        # rabat sur le code HTTP plutôt que de masquer l'erreur d'origine.
        detail = ""
        try:
            detail = json.loads(exc.read()).get("detail", "")
        except (json.JSONDecodeError, OSError, AttributeError):
            detail = ""
        raise SyncError(f"{exc.code} : {detail or exc.reason}") from None
    except urllib.error.URLError as exc:
        raise SyncError(f"Service injoignable : {exc.reason}") from None


def register(endpoint: str, email: str, password: str, invite_code: str = "") -> Credentials:
    body = _request(
        f"{endpoint}/v1/auth/register",
        {"email": email, "password": password, "invite_code": invite_code},
    )
    creds = Credentials(endpoint, body["access_token"], body["refresh_token"])
    creds.save()
    return account_plan(creds)


def login(endpoint: str, email: str, password: str, device_label: str = "") -> Credentials:
    body = _request(
        f"{endpoint}/v1/auth/login",
        {"email": email, "password": password, "device_label": device_label},
    )
    creds = Credentials(endpoint, body["access_token"], body["refresh_token"])
    creds.save()
    return creds


def account_plan(creds: Credentials) -> Credentials:
    """Relit l'offre du compte et la garde avec les jetons.

    Silencieux en cas d'échec : le carnet local marche hors ligne, et un
    service injoignable ne doit pas empêcher de le lire. L'offre connue reste
    alors celle de la dernière fois.
    """
    try:
        body, creds = _authorised(
            creds, lambda token: _request(f"{creds.endpoint}/v1/auth/me", token=token)
        )
    except SyncError:
        return creds

    updated = Credentials(
        creds.endpoint, creds.access_token, creds.refresh_token, body.get("plan", PLAN_FREE)
    )
    updated.save()
    return updated


def _refresh(creds: Credentials) -> Credentials:
    body = _request(f"{creds.endpoint}/v1/auth/refresh", {"refresh_token": creds.refresh_token})
    refreshed = Credentials(
        creds.endpoint, body["access_token"], body["refresh_token"], creds.plan
    )
    refreshed.save()
    return refreshed


def _authorised(creds: Credentials, call) -> tuple[Any, Credentials]:
    """Exécute un appel, en renouvelant le jeton s'il a expiré.

    Le jeton d'accès dure quinze minutes : sur un usage normal, il expire entre
    deux synchronisations. Redemander les identifiants à chaque fois serait
    intenable.
    """
    try:
        return call(creds.access_token), creds
    except SyncError as exc:
        if not str(exc).startswith("401"):
            raise
        creds = _refresh(creds)
        return call(creds.access_token), creds


def _encrypt_entry(entry: dict[str, Any], key: bytes) -> dict[str, str]:
    import os as _os

    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    from .transfer import _b64e

    nonce = _os.urandom(12)
    plain = json.dumps(entry, ensure_ascii=False, separators=(",", ":")).encode()
    cipher = AESGCM(key).encrypt(nonce, plain, None)
    return {
        "entry_id": entry["id"],
        "nonce": _b64e(nonce),
        "blob": _b64e(cipher),
        "deleted": bool(entry.get("deleted")),
    }


def _decrypt_entry(row: dict[str, str], key: bytes) -> dict[str, Any]:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    from .transfer import TransferError, _b64d

    try:
        plain = AESGCM(key).decrypt(_b64d(row["nonce"]), _b64d(row["blob"]), None)
    except Exception as exc:
        raise TransferError(
            "Déchiffrement impossible : la clef maîtresse n'est pas celle qui a "
            "servi à synchroniser ce carnet."
        ) from exc
    return json.loads(plain)


def sync(
    vault: dict[str, Any], master_key: str, creds: Credentials
) -> tuple[dict[str, Any], list[Conflict], int, Credentials]:
    """Synchronise le carnet local avec le serveur.

    Rend le carnet fusionné, les conflits, le nombre d'entrées restées sur
    l'appareil faute de place sous le plafond du compte, et la session.

    Toujours dans cet ordre : on tire d'abord, on fusionne, puis on pousse.
    Pousser sans avoir tiré écraserait ce qu'un autre appareil a écrit entre
    temps — et le serveur le refuse, précisément pour cette raison.
    """
    key = derive_transfer_key(master_key)

    pulled, creds = _authorised(
        creds, lambda token: _request(f"{creds.endpoint}/v1/vault", token=token)
    )

    remote = {"schema": 1, "updatedAt": vault.get("updatedAt", ""), "entries": []}
    for row in pulled["entries"]:
        # Un « v » résiduel est ignoré : une entrée dérive toujours en v2.
        entry = drop_version(_decrypt_entry(row, key))
        # Absent quand faux, jamais « deleted: false ». La représentation
        # canonique départage les écritures simultanées : y laisser un champ
        # que les autres implémentations n'écrivent pas ferait désigner un
        # gagnant différent selon l'appareil, et les carnets ne convergeraient
        # jamais.
        if entry.get("deleted") or row["deleted"]:
            entry["deleted"] = True
        else:
            entry.pop("deleted", None)
        remote["entries"].append(entry)

    merged, conflicts = merge(vault, remote)

    # Au-delà du plafond, le reste du carnet ne part pas : il reste propre à
    # l'appareil. Un serveur qui ne dit pas son plafond reçoit tout.
    max_entries = pulled.get("max_entries")
    if isinstance(max_entries, int) and not isinstance(max_entries, bool):
        push, local_only = select_for_push(
            merged, [row["entry_id"] for row in pulled["entries"]], max_entries
        )
    else:
        push, local_only = merged["entries"], []

    payload = {
        "base_revision": pulled["revision"],
        "entries": [_encrypt_entry(e, key) for e in push],
    }
    _, creds = _authorised(
        creds,
        lambda token: _request(f"{creds.endpoint}/v1/vault", payload, token=token),
    )

    return merged, conflicts, len(local_only), creds
