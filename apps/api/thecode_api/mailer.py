"""Envoi des courriers du service.

Trois courriers : confirmer une adresse, confirmer un changement d'adresse,
reprendre la main sur un compte dont le mot de passe est oublié.

Texte brut, sans HTML ni image : ces messages ne contiennent qu'un lien, un
message en texte simple passe mieux les filtres, et rien n'y suit qui l'ouvre.

Deux transports. `log` écrit le lien dans les journaux du service — c'est ce
qui permet de développer et de tester sans rien envoyer, et ça ne prétend pas
envoyer. `smtp` envoie pour de bon.

Le lien n'est jamais reconstruit ailleurs : il part d'ici, avec l'URL publique
du site, parce qu'un lien de vérification qui pointe vers l'API plutôt que vers
le site est un lien mort.
"""

from __future__ import annotations

import logging
import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formataddr, parseaddr
from urllib.parse import quote

from .config import Settings

logger = logging.getLogger("thecode.mail")

#: Au-delà, on abandonne. Un envoi se fait pendant une requête HTTP : laisser
#: pendre la connexion ferait attendre quelqu'un devant un formulaire.
TIMEOUT_SECONDS = 15


class MailError(Exception):
    """L'envoi a échoué. L'appelant décide si c'est bloquant."""


@dataclass(frozen=True)
class Mail:
    subject: str
    body: str


def _url(settings: Settings, page: str, token: str, lang: str) -> str:
    lang = lang if lang in ("en", "fr") else "en"
    return f"{settings.site_url.rstrip('/')}/{lang}/account/{page}?token={quote(token)}"


def verification_url(settings: Settings, token: str, lang: str = "en") -> str:
    return _url(settings, "verify", token, lang)


def reset_url(settings: Settings, token: str, lang: str = "en") -> str:
    return _url(settings, "reset", token, lang)


def _verification_mail(url: str, lang: str) -> Mail:
    if lang == "fr":
        return Mail(
            subject="Confirmez votre adresse — TheCode",
            body=(
                "Bonjour,\n\n"
                "Confirmez votre adresse pour finir la création de votre compte "
                "TheCode :\n\n"
                f"{url}\n\n"
                "Ce lien ne sert qu'une fois et expire dans 24 heures.\n\n"
                "Si vous n'avez pas créé de compte, ignorez ce message : sans ce "
                "lien, rien ne se passe.\n\n"
                "— TheCode"
            ),
        )
    return Mail(
        subject="Confirm your address — TheCode",
        body=(
            "Hello,\n\n"
            "Confirm your address to finish creating your TheCode account:\n\n"
            f"{url}\n\n"
            "This link works once and expires in 24 hours.\n\n"
            "If you did not create an account, ignore this message: without this "
            "link, nothing happens.\n\n"
            "— TheCode"
        ),
    )


def _change_mail(url: str, lang: str) -> Mail:
    if lang == "fr":
        return Mail(
            subject="Confirmez votre nouvelle adresse — TheCode",
            body=(
                "Bonjour,\n\n"
                "Vous avez demandé à utiliser cette adresse pour votre compte "
                "TheCode. Confirmez-la :\n\n"
                f"{url}\n\n"
                "Tant que ce lien n'est pas suivi, votre compte garde son adresse "
                "actuelle.\n\n"
                "Si cette demande ne vient pas de vous, ignorez ce message.\n\n"
                "— TheCode"
            ),
        )
    return Mail(
        subject="Confirm your new address — TheCode",
        body=(
            "Hello,\n\n"
            "You asked to use this address for your TheCode account. Confirm it:\n\n"
            f"{url}\n\n"
            "Until this link is followed, your account keeps its current address.\n\n"
            "If this request did not come from you, ignore this message.\n\n"
            "— TheCode"
        ),
    )


def _reset_mail(url: str, lang: str) -> Mail:
    if lang == "fr":
        return Mail(
            subject="Réinitialiser votre mot de passe — TheCode",
            body=(
                "Bonjour,\n\n"
                "Voici le lien pour choisir un nouveau mot de passe de compte :\n\n"
                f"{url}\n\n"
                "Il ne sert qu'une fois et expire dans 2 heures. Tous vos appareils "
                "seront déconnectés.\n\n"
                "Ce mot de passe ne protège que la synchronisation : votre clef "
                "maîtresse, elle, n'est connue de personne ici et n'est pas "
                "concernée.\n\n"
                "Si vous n'avez rien demandé, ignorez ce message : votre mot de "
                "passe actuel reste valable.\n\n"
                "— TheCode"
            ),
        )
    return Mail(
        subject="Reset your password — TheCode",
        body=(
            "Hello,\n\n"
            "Here is the link to choose a new account password:\n\n"
            f"{url}\n\n"
            "It works once and expires in 2 hours. All your devices will be signed "
            "out.\n\n"
            "This password only guards syncing: your master key is known to nobody "
            "here and is not affected.\n\n"
            "If you did not ask for this, ignore this message: your current password "
            "still works.\n\n"
            "— TheCode"
        ),
    )


def _send(settings: Settings, mail: Mail, to: str, url: str) -> None:
    if settings.mail_transport == "log":
        # Volontairement en clair : c'est le seul moyen de finir une
        # vérification tant qu'aucun envoi n'est branché, et ces journaux ne
        # sortent pas du cluster.
        logger.info("[%s] pour %s : %s", mail.subject, to, url)
        return

    message = EmailMessage()
    message["Subject"] = mail.subject
    name, address = parseaddr(settings.mail_from)
    message["From"] = formataddr((name or "TheCode", address or settings.mail_from))
    message["To"] = to
    if settings.mail_reply_to:
        message["Reply-To"] = settings.mail_reply_to
    # Un message automatique doit se déclarer comme tel : les répondeurs
    # d'absence ne doivent pas lui répondre, et les filtres le classent mieux.
    message["Auto-Submitted"] = "auto-generated"
    message.set_content(mail.body)

    try:
        with smtplib.SMTP(settings.mail_host, settings.mail_port, timeout=TIMEOUT_SECONDS) as smtp:
            if settings.mail_starttls:
                smtp.starttls(context=ssl.create_default_context())
            if settings.mail_user:
                # Les mots de passe d'application se copient avec des espaces :
                # les garder ferait échouer l'authentification sans rien dire
                # d'utile.
                smtp.login(settings.mail_user, settings.mail_password.replace(" ", ""))
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        logger.error("Envoi impossible vers %s : %s", to, exc)
        raise MailError(str(exc)) from exc


def send_verification_email(settings: Settings, email: str, token: str, lang: str = "en") -> None:
    url = verification_url(settings, token, lang)
    _send(settings, _verification_mail(url, lang), email, url)


def send_email_change_email(settings: Settings, email: str, token: str, lang: str = "en") -> None:
    """Part vers la **nouvelle** adresse, jamais vers l'ancienne.

    C'est la nouvelle qu'il s'agit de prouver : l'envoyer à l'ancienne
    laisserait changer l'adresse du compte vers une boîte qu'on ne possède pas.
    """
    url = verification_url(settings, token, lang)
    _send(settings, _change_mail(url, lang), email, url)


def send_password_reset_email(settings: Settings, email: str, token: str, lang: str = "en") -> None:
    url = reset_url(settings, token, lang)
    _send(settings, _reset_mail(url, lang), email, url)
