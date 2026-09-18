"""Parcours CLI avec carnet : les trois problèmes d'origine.

1. plusieurs comptes sur un même site donnaient le même mot de passe ;
2. changer un paramètre pour un site les changeait pour tous, et on ne savait
   plus lequel avait été utilisé ;
3. un même compte sur plusieurs domaines donnait des mots de passe différents.
"""

import pytest
from thecode.cli import main


@pytest.fixture
def vault(tmp_path):
    return tmp_path / "vault.json"


def run(capsys, *argv):
    assert main(list(argv)) == 0
    return capsys.readouterr().out.strip().splitlines()[-1]


class TestProblemOne:
    """Plusieurs comptes sur un même site."""

    def test_two_accounts_get_different_passwords(self, capsys, vault):
        first = run(capsys, "google.com", "-p", "clef", "--show", "--save", "--vault", str(vault))
        second = run(
            capsys, "google.com", "-p", "clef", "--account", "pro",
            "--save", "--show", "--vault", str(vault),
        )
        assert first != second

    def test_each_account_is_found_again(self, capsys, vault):
        run(capsys, "google.com", "-p", "clef", "--show", "--save", "--vault", str(vault))
        pro = run(
            capsys, "google.com", "-p", "clef", "--account", "pro",
            "--save", "--show", "--vault", str(vault),
        )
        again = run(
            capsys, "google.com", "-p", "clef", "--account", "pro",
            "--show", "--vault", str(vault),
        )
        assert again == pro

    def test_ambiguous_site_asks_which_account(self, capsys, vault):
        run(capsys, "google.com", "-p", "clef", "--show", "--save", "--vault", str(vault))
        run(
            capsys, "google.com", "-p", "clef", "--account", "pro",
            "--save", "--show", "--vault", str(vault),
        )
        # Deviner serait pire que demander : un mauvais choix donne un mot de
        # passe qui ne marche pas, sans rien expliquer.
        with pytest.raises(SystemExit, match="--account"):
            main(["google.com", "-p", "clef", "--show", "--vault", str(vault)])


class TestProblemTwo:
    """Les paramètres qu'on oublie."""

    def test_saved_parameters_are_reused(self, capsys, vault):
        saved = run(
            capsys, "google.com", "-p", "clef", "-l", "16", "--no-symbols",
            "--save", "--show", "--vault", str(vault),
        )
        # Plus besoin de se souvenir de -l 16 --no-symbols.
        assert run(capsys, "google.com", "-p", "clef", "--show", "--vault", str(vault)) == saved

    def test_parameters_are_per_site(self, capsys, vault):
        run(
            capsys, "a.com", "-p", "clef", "-l", "12",
            "--save", "--show", "--vault", str(vault),
        )
        b = run(
            capsys, "b.com", "-p", "clef", "-l", "32",
            "--save", "--show", "--vault", str(vault),
        )
        a = run(capsys, "a.com", "-p", "clef", "--show", "--vault", str(vault))
        assert len(a) == 12
        assert len(b) == 32


class TestProblemThree:
    """Un même compte sur plusieurs domaines."""

    def test_aliases_share_one_password(self, capsys, vault):
        expected = run(
            capsys, "google.com", "-p", "clef", "--alias", "google.fr",
            "--alias", "youtube.com", "--save", "--show", "--vault", str(vault),
        )
        for domain in ("google.fr", "youtube.com"):
            assert run(capsys, domain, "-p", "clef", "--show", "--vault", str(vault)) == expected

    def test_url_forms_converge(self, capsys, vault):
        """https://www.google.com/login et google.com sont le même site."""
        a = run(capsys, "https://www.google.com/login", "-p", "clef", "--show", "--vault", str(vault))
        b = run(capsys, "google.com", "-p", "clef", "--show", "--vault", str(vault))
        assert a == b


def test_list_reports_what_is_stored(capsys, vault):
    run(capsys, "google.com", "-p", "clef", "-l", "16", "--save", "--show", "--vault", str(vault))
    assert main(["--list", "-p", "x", "unused", "--vault", str(vault)]) == 0
    out = capsys.readouterr().out
    assert "google.com" in out
    assert "16 caracteres" in out
