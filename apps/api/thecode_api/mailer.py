"""Envoi des e-mails du service.

Un seul e-mail pour l'instant : le lien de vérification d'adresse.

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


def verification_url(settings: Settings, token: str, lang: str = "en") -> str:
    lang = lang if lang in ("en", "fr") else "en"
    return f"{settings.site_url.rstrip('/')}/{lang}/account/verify?token={quote(token)}"


def send_verification_email(settings: Settings, email: str, token: str, lang: str = "en") -> None:
    url = verification_url(settings, token, lang)
    if settings.mail_transport == "log":
        # Volontairement en clair : c'est le seul moyen de finir une
        # vérification tant qu'aucun envoi n'est branché, et ces journaux ne
        # sortent pas du cluster.
        logger.info("Lien de vérification pour %s : %s", email, url)
        return
    raise RuntimeError(f"Transport de courrier inconnu : {settings.mail_transport!r}")
