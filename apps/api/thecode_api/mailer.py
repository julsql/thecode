"""Envoi des e-mails du service.

Trois courriers : confirmer une adresse, confirmer un changement d'adresse,
reprendre la main sur un compte dont le mot de passe est oublié.

Le transport est une couture explicite. Aujourd'hui le lien part dans les
journaux du service (`mail_transport = "log"`), ce qui suffit pour développer
et pour tester, et ne prétend rien envoyer. Brancher un vrai envoi revient à
écrire une seconde fonction ici et à l'ajouter au tableau : le reste du code
ne connaît que `send_verification_email`.

Le lien n'est jamais reconstruit ailleurs : il part d'ici, avec l'URL publique
du site, parce qu'un lien de vérification qui pointe vers l'API plutôt que
vers le site est un lien mort.
"""

from __future__ import annotations

import logging
from urllib.parse import quote

from .config import Settings

logger = logging.getLogger("thecode.mail")


def _url(settings: Settings, page: str, token: str, lang: str) -> str:
    lang = lang if lang in ("en", "fr") else "en"
    return f"{settings.site_url.rstrip('/')}/{lang}/account/{page}?token={quote(token)}"


def verification_url(settings: Settings, token: str, lang: str = "en") -> str:
    return _url(settings, "verify", token, lang)


def reset_url(settings: Settings, token: str, lang: str = "en") -> str:
    return _url(settings, "reset", token, lang)


def _send(settings: Settings, what: str, email: str, url: str) -> None:
    if settings.mail_transport == "log":
        # Volontairement en clair : c'est le seul moyen de finir une
        # vérification tant qu'aucun envoi n'est branché, et ces journaux ne
        # sortent pas du cluster.
        logger.info("%s pour %s : %s", what, email, url)
        return
    raise RuntimeError(f"Transport de courrier inconnu : {settings.mail_transport!r}")


def send_verification_email(settings: Settings, email: str, token: str, lang: str = "en") -> None:
    _send(settings, "Lien de vérification", email, verification_url(settings, token, lang))


def send_email_change_email(settings: Settings, email: str, token: str, lang: str = "en") -> None:
    """Part vers la **nouvelle** adresse, jamais vers l'ancienne.

    C'est la nouvelle qu'il s'agit de prouver : l'envoyer à l'ancienne
    laisserait changer l'adresse du compte vers une boîte qu'on ne possède pas.
    """
    _send(settings, "Confirmation de changement d'adresse", email,
          verification_url(settings, token, lang))


def send_password_reset_email(settings: Settings, email: str, token: str, lang: str = "en") -> None:
    _send(settings, "Lien de réinitialisation", email, reset_url(settings, token, lang))
