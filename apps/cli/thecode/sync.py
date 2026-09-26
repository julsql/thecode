"""Client de synchronisation.

Le carnet est chiffré **avant** de quitter l'appareil, avec une clef dérivée
de la clef maîtresse et du sel propre au compte (shared/spec/vault-sync.md). Le serveur ne reçoit que des blocs
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

from . import settings as settings_module
from .transfer import TransferError, _b64d, _b64e, pbkdf2
from .vault import Conflict, merge, select_for_push

DEFAULT_ENDPOINT = "https://thecode-api.julsql.fr"

#: Préfixe du sel PBKDF2 de la clef de synchronisation ; le sel du compte
#: (``kdf_salt``, 16 octets tirés par le serveur) lui est concaténé.
SYNC_KDF_LABEL = b"thecode-sync/v2"
KDF_SALT_BYTES = 16
#: Données associées AES-GCM d'une entrée, suivies de son ``entry_id``.
ENTRY_AAD_PREFIX = "thecode/entry/v2|"
#: Données associées AES-GCM des réglages par défaut.
SETTINGS_AAD = b"thecode/settings/v2"


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
    #: Sel de dérivation du compte, en base64url, tel que le service l'a
    #: rendu à la connexion. Public : il ne sert qu'à rendre la clef propre au
    #: compte, et le serveur le connaît de toute façon.
    kdf_salt: str = ""

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
    creds = Credentials(
        endpoint, body["access_token"], body["refresh_token"], kdf_salt=body.get("kdf_salt", "")
    )
    creds.save()
    return account_plan(creds)


def login(endpoint: str, email: str, password: str, device_label: str = "") -> Credentials:
    body = _request(
        f"{endpoint}/v1/auth/login",
        {"email": email, "password": password, "device_label": device_label},
    )
    creds = Credentials(
        endpoint, body["access_token"], body["refresh_token"], kdf_salt=body.get("kdf_salt", "")
    )
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
        creds.endpoint,
        creds.access_token,
        creds.refresh_token,
        body.get("plan", PLAN_FREE),
        body.get("kdf_salt") or creds.kdf_salt,
    )
    updated.save()
    return updated


def _refresh(creds: Credentials) -> Credentials:
    body = _request(f"{creds.endpoint}/v1/auth/refresh", {"refresh_token": creds.refresh_token})
    refreshed = Credentials(
        creds.endpoint,
        body["access_token"],
        body["refresh_token"],
        creds.plan,
        body.get("kdf_salt") or creds.kdf_salt,
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


def _account_salt(creds: Credentials) -> tuple[bytes, Credentials]:
    """Le sel de dérivation du compte, relu auprès du service s'il manque."""
    if not creds.kdf_salt:
        creds = account_plan(creds)
    try:
        salt = _b64d(creds.kdf_salt)
    except ValueError:
        salt = b""
    if len(salt) != KDF_SALT_BYTES:
        raise SyncError(
            "Le service n'a pas rendu le sel de dérivation du compte : reconnectez-vous."
        )
    return salt, creds


def derive_sync_key(master_key: str, kdf_salt: bytes) -> bytes:
    """Clef de synchronisation : propre à la clef maîtresse **et** au compte.

    Le sel du compte empêche de précalculer une table valable pour tous les
    comptes : qui vole la base doit s'attaquer à chacun séparément.
    """
    return pbkdf2(master_key, SYNC_KDF_LABEL + kdf_salt)


def entry_aad(entry_id: str) -> bytes:
    """Données associées d'une entrée : la lient à son identifiant en clair.

    Sans elles, le serveur pourrait échanger les blobs de deux entrées — ou
    rejouer un vieux blob sous un autre identifiant — sans que rien ne le
    trahisse au déchiffrement.
    """
    return (ENTRY_AAD_PREFIX + entry_id).encode("utf-8")


def _seal(value: dict[str, Any], key: bytes, aad: bytes) -> dict[str, str]:
    """Chiffre une valeur JSON : AES-256-GCM, nonce de 12 octets, base64url."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    nonce = os.urandom(12)
    plain = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()
    return {"nonce": _b64e(nonce), "blob": _b64e(AESGCM(key).encrypt(nonce, plain, aad))}


def _open(sealed: dict[str, str], key: bytes, aad: bytes) -> Any:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    try:
        plain = AESGCM(key).decrypt(_b64d(sealed["nonce"]), _b64d(sealed["blob"]), aad)
    except Exception as exc:
        raise TransferError(
            "Déchiffrement impossible : la clef maîtresse n'est pas celle qui a "
            "servi à synchroniser ce carnet, ou le bloc a été altéré."
        ) from exc
    return json.loads(plain)


def _encrypt_entry(entry: dict[str, Any], key: bytes) -> dict[str, str]:
    return {
        "entry_id": entry["id"],
        **_seal(entry, key, entry_aad(entry["id"])),
        "deleted": bool(entry.get("deleted")),
    }


#: Message d'une ligne dont l'entrée ne porte pas son ``entry_id`` (vault-sync.md).
TAMPERED_FR = (
    "Le carnet reçu du serveur a été modifié : synchronisation interrompue, "
    "rien n'a été écrit."
)
TAMPERED_EN = (
    "The vault received from the server was tampered with: sync stopped, nothing was written."
)


class VaultTamperedError(TransferError):
    """Une ligne déchiffrée ne porte pas l'identifiant sous lequel elle est rangée.

    Seule une altération côté serveur y mène : toute la synchronisation échoue,
    comme pour un tag GCM invalide, plutôt que d'écarter l'entrée en silence.
    """

    def __init__(self) -> None:
        super().__init__(TAMPERED_FR)


def _decrypt_entry(row: dict[str, str], key: bytes) -> dict[str, Any]:
    entry = _open(row, key, entry_aad(row["entry_id"]))
    # Les données associées lient déjà le blob à l'identifiant ; l'entrée doit
    # en plus dire la même chose d'elle-même, pour ne jamais être fusionnée
    # sous un autre identifiant que le sien.
    if not isinstance(entry, dict) or entry.get("id") != row["entry_id"]:
        raise VaultTamperedError()
    return entry


def seal_settings(value: dict[str, Any], key: bytes) -> dict[str, str]:
    return _seal(value, key, SETTINGS_AAD)


def open_settings(sealed: dict[str, str], key: bytes) -> Any:
    return _open(sealed, key, SETTINGS_AAD)


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
    salt, creds = _account_salt(creds)
    key = derive_sync_key(master_key, salt)

    pulled, creds = _authorised(
        creds, lambda token: _request(f"{creds.endpoint}/v1/vault", token=token)
    )

    remote = {"schema": 1, "updatedAt": vault.get("updatedAt", ""), "entries": []}
    for row in pulled["entries"]:
        entry = _decrypt_entry(row, key)
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


#: Issues de :func:`sync_settings`.
SETTINGS_PULLED = "pulled"
SETTINGS_PUSHED = "pushed"
SETTINGS_UNCHANGED = "unchanged"
SETTINGS_IGNORED = "ignored"


def sync_settings(
    local: dict[str, Any], master_key: str, creds: Credentials
) -> tuple[dict[str, Any], str, Credentials]:
    """Partage les réglages par défaut avec le compte (shared/spec/default-settings.md).

    À appeler après la synchronisation du carnet. Tire, garde le plus récent
    (à égalité, le distant), puis pousse si le local l'emportait. Rend les
    réglages à appliquer localement, l'issue, et la session.

    Un blob illisible (autre clef maîtresse, contenu incohérent) est ignoré :
    ni les réglages locaux ni ceux du compte ne sont écrasés.
    """
    salt, creds = _account_salt(creds)
    key = derive_sync_key(master_key, salt)
    url = f"{creds.endpoint}/v1/settings"

    pulled, creds = _authorised(creds, lambda token: _request(url, token=token))

    remote = None
    if pulled:
        try:
            remote = open_settings(pulled, key)
        except (TransferError, KeyError, ValueError):
            return local, SETTINGS_IGNORED, creds
        if not settings_module.is_valid(remote):
            return local, SETTINGS_IGNORED, creds
        remote = settings_module.normalise(remote)

    if remote is not None and settings_module.instant(remote) >= settings_module.instant(local):
        return remote, SETTINGS_UNCHANGED if remote == local else SETTINGS_PULLED, creds

    # Des réglages jamais modifiés sur cet appareil n'ont rien à apprendre au
    # compte : les pousser ferait passer les valeurs d'usine pour un choix.
    if not local["updatedAt"]:
        return local, SETTINGS_UNCHANGED, creds

    payload = seal_settings(settings_module.normalise(local), key)
    _, creds = _authorised(creds, lambda token: _request(url, payload, token=token, method="PUT"))
    return local, SETTINGS_PUSHED, creds
