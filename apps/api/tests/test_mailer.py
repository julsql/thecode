"""Envoi des courriers.

Aucun courrier ne part vraiment : ce qui est vérifié, c'est ce que le service
remet au serveur SMTP — le destinataire, l'expéditeur, le sujet, le lien — et
ce qu'il fait quand l'envoi échoue.

Le contenu compte autant que l'acheminement : un lien de réinitialisation qui
pointerait vers l'API, ou qui partirait à l'ancienne adresse lors d'un
changement, serait inutilisable sans qu'aucune erreur ne se voie.
"""

from __future__ import annotations

import smtplib
from email.message import EmailMessage

import pytest

from thecode_api import mailer
from thecode_api.config import Settings


@pytest.fixture
def smtp_settings():
    return Settings(
        jwt_secret="secret-de-test-uniquement",
        environment="test",
        mail_transport="smtp",
        mail_host="smtp.exemple.fr",
        mail_port=587,
        mail_user="expediteur@exemple.fr",
        mail_password="abcd efgh ijkl mnop",
        mail_from="TheCode <expediteur@exemple.fr>",
        mail_reply_to="contact@exemple.fr",
        site_url="https://thecode.julsql.fr",
    )


@pytest.fixture
def sent(monkeypatch):
    """Un serveur SMTP en carton qui note ce qu'on lui remet."""
    envois: list[dict] = []

    class FakeSMTP:
        def __init__(self, host, port, timeout=None):
            self.host, self.port = host, port

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def starttls(self, context=None):
            envois.append({"starttls": True})

        def login(self, user, password):
            envois.append({"login": user, "password": password})

        def send_message(self, message):
            envois.append({"message": message})

    monkeypatch.setattr(mailer.smtplib, "SMTP", FakeSMTP)
    return envois


def message_of(sent) -> EmailMessage:
    return next(e["message"] for e in sent if "message" in e)


class TestSmtp:
    def test_it_sends_the_verification_link(self, smtp_settings, sent):
        mailer.send_verification_email(smtp_settings, "julie@exemple.fr", "jeton", "fr")

        message = message_of(sent)
        assert message["To"] == "julie@exemple.fr"
        assert message["From"] == "TheCode <expediteur@exemple.fr>"
        assert "Confirmez votre adresse" in message["Subject"]
        # Le lien mène au site, pas à l'API : l'inverse serait un lien mort.
        assert "https://thecode.julsql.fr/fr/account/verify?token=jeton" in message.get_content()

    def test_the_reset_link_points_to_its_own_page(self, smtp_settings, sent):
        mailer.send_password_reset_email(smtp_settings, "julie@exemple.fr", "jeton", "fr")

        contenu = message_of(sent).get_content()
        assert "/fr/account/reset?token=jeton" in contenu
        # Ce que ce mot de passe protège, et ce qu'il ne protège pas : le dire
        # ici évite de croire que la clef maîtresse est en jeu.
        assert "clef" in contenu

    def test_it_speaks_the_language_asked_for(self, smtp_settings, sent):
        mailer.send_verification_email(smtp_settings, "julie@exemple.fr", "jeton", "en")

        assert "Confirm your address" in message_of(sent)["Subject"]
        assert "/en/account/verify" in message_of(sent).get_content()

    def test_the_application_password_loses_its_spaces(self, smtp_settings, sent):
        """Un mot de passe d'application se copie avec ses espaces.

        Les garder ferait échouer l'authentification sans rien dire d'utile.
        """
        mailer.send_verification_email(smtp_settings, "julie@exemple.fr", "jeton")

        login = next(e for e in sent if "login" in e)
        assert login["password"] == "abcdefghijklmnop"

    def test_replies_go_where_they_are_read(self, smtp_settings, sent):
        """L'adresse de réponse n'entre dans aucune vérification : elle ne sert
        qu'aux humains, dont certains répondent aux courriers automatiques."""
        mailer.send_verification_email(smtp_settings, "julie@exemple.fr", "jeton")

        assert message_of(sent)["Reply-To"] == "contact@exemple.fr"

    def test_it_announces_itself_as_automatic(self, smtp_settings, sent):
        mailer.send_verification_email(smtp_settings, "julie@exemple.fr", "jeton")

        # Les répondeurs d'absence n'ont pas à répondre à ça.
        assert message_of(sent)["Auto-Submitted"] == "auto-generated"

    def test_a_failure_is_reported(self, smtp_settings, monkeypatch):
        def refuse(*args, **kwargs):
            raise smtplib.SMTPAuthenticationError(535, b"refuse")

        monkeypatch.setattr(mailer.smtplib, "SMTP", refuse)

        with pytest.raises(mailer.MailError):
            mailer.send_verification_email(smtp_settings, "julie@exemple.fr", "jeton")


class TestLogTransport:
    def test_nothing_leaves_and_the_link_is_readable(self, caplog):
        settings = Settings(jwt_secret="x", environment="test", mail_transport="log")

        with caplog.at_level("INFO", logger="thecode.mail"):
            mailer.send_verification_email(settings, "julie@exemple.fr", "jeton", "fr")

        # C'est le seul moyen de finir une vérification tant qu'aucun envoi
        # n'est branché.
        assert "account/verify?token=jeton" in caplog.text
