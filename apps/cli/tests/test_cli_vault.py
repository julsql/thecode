"""Parcours CLI avec carnet : les trois problèmes d'origine.

1. plusieurs comptes sur un même site donnaient le même mot de passe ;
2. changer un paramètre pour un site les changeait pour tous, et on ne savait
   plus lequel avait été utilisé ;
3. un même compte sur plusieurs domaines donnait des mots de passe différents.
"""

import json

import pytest

from thecode.cli import main
from thecode.core import generate_password_v2
from thecode.sync import Credentials
from thecode.vault import load, new_entry, save


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


# ---------------------------------------------------------------- renouvellement


def _v2_entry(tmp_path, counter=1):
    """Carnet d'un seul site, en v2, prêt à être renouvelé."""
    vault_path = tmp_path / "vault.json"
    entry = new_entry("google.com", domains=["google.com"], version=2)
    entry["counter"] = counter
    save({"schema": 1, "updatedAt": "2026-01-01T00:00:00Z", "entries": [entry]}, vault_path)
    return vault_path


@pytest.fixture
def paid_account(tmp_path, monkeypatch):
    """Une session dont l'offre donne droit au compteur.

    Le renouvellement — changer de mot de passe sans changer de clef — fait
    partie de l'offre complète, et l'offre connue vit avec les jetons : la
    génération se fait hors ligne, il n'y a personne à interroger au moment du
    renouvellement.
    """
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path / "config"))
    Credentials("https://exemple.test", "jeton", "renouvellement", "pro").save()
    return tmp_path


def test_renew_increments_the_counter_after_confirmation(tmp_path, monkeypatch, paid_account):
    vault_path = _v2_entry(tmp_path)
    monkeypatch.setattr("builtins.input", lambda _: "o")

    code = main(["-p", "clef", "google.com", "--renew", "--vault", str(vault_path)])

    assert code == 0
    assert load(vault_path)["entries"][0]["counter"] == 2


def test_renew_shows_both_passwords_before_confirming(
    tmp_path, monkeypatch, capsys, paid_account
):
    """Le nouveau ne sert à rien tant qu'il n'est pas posé sur le site.

    Et l'ancien reste nécessaire pour s'y connecter : les deux doivent être
    affichés côte à côte.
    """
    vault_path = _v2_entry(tmp_path)
    monkeypatch.setattr("builtins.input", lambda _: "o")

    main(["-p", "clef", "google.com", "--renew", "--vault", str(vault_path)])
    out = capsys.readouterr().out

    assert "actuel" in out
    assert "nouveau" in out
    before = generate_password_v2("google.com", "clef", counter=1)
    after = generate_password_v2("google.com", "clef", counter=2)
    assert before in out
    assert after in out
    assert before != after


def test_renew_leaves_the_counter_alone_when_refused(tmp_path, monkeypatch, paid_account):
    vault_path = _v2_entry(tmp_path)
    monkeypatch.setattr("builtins.input", lambda _: "n")

    main(["-p", "clef", "google.com", "--renew", "--vault", str(vault_path)])

    # Incrémenter sans confirmation rendrait le compte inaccessible : l'ancien
    # mot de passe est encore celui du site.
    assert load(vault_path)["entries"][0]["counter"] == 1


def _v1_entry(tmp_path):
    """Carnet contenant une entrée v1, écrit à la main : new_entry la refuse."""
    vault_path = tmp_path / "vault.json"
    entry = new_entry("google.com", domains=["google.com"])
    entry["v"] = 1
    save({"schema": 1, "updatedAt": "2026-01-01T00:00:00Z", "entries": [entry]}, vault_path)
    return vault_path


def test_renew_ignores_a_v1_entry(tmp_path, capsys):
    vault_path = _v1_entry(tmp_path)

    code = main(["-p", "clef", "google.com", "--renew", "--vault", str(vault_path)])

    # Le carnet n'accepte que la v2 : l'entrée v1 est écartée à la lecture.
    assert code == 1
    assert "Aucune entrée" in capsys.readouterr().err


def test_migrate_no_longer_exists(tmp_path):
    with pytest.raises(SystemExit):
        main(["-p", "clef", "google.com", "--migrate", "--vault", str(tmp_path / "v.json")])


def test_save_refuses_algo_1(tmp_path, capsys):
    vault_path = tmp_path / "vault.json"

    code = main(
        ["-p", "clef", "google.com", "--algo", "1", "--save", "--show", "--vault", str(vault_path)]
    )

    assert code == 1
    assert "v2" in capsys.readouterr().err
    assert not vault_path.exists()


def test_algo_1_without_save_still_generates(tmp_path):
    vault_path = tmp_path / "vault.json"

    code = main(["-p", "clef", "google.com", "--algo", "1", "--show", "--vault", str(vault_path)])

    assert code == 0
    assert not vault_path.exists()


def test_save_drops_v1_entries_and_writes_v2(tmp_path):
    vault_path = _v1_entry(tmp_path)

    code = main(["-p", "clef", "google.com", "--save", "--show", "--vault", str(vault_path)])

    assert code == 0
    # L'entrée v1 a disparu du fichier à la première écriture.
    raw = json.loads(vault_path.read_text(encoding="utf-8"))
    assert [e["v"] for e in raw["entries"]] == [2]


def test_renew_refuses_an_unknown_site(tmp_path, capsys):
    vault_path = tmp_path / "vault.json"
    save({"schema": 1, "updatedAt": "2026-01-01T00:00:00Z", "entries": []}, vault_path)

    assert main(["-p", "clef", "inconnu.fr", "--renew", "--vault", str(vault_path)]) == 1


def test_renew_restamps_the_entry(tmp_path, monkeypatch):
    vault_path = _v2_entry(tmp_path)
    monkeypatch.setattr("builtins.input", lambda _: "o")
    before = load(vault_path)["entries"][0]["updatedAt"]

    main(["-p", "clef", "google.com", "--renew", "--vault", str(vault_path)])

    # Sans réhorodatage, la fusion ferait gagner l'autre appareil et le
    # renouvellement serait perdu.
    assert load(vault_path)["entries"][0]["updatedAt"] >= before


def test_renew_needs_the_complete_plan(tmp_path, monkeypatch, capsys):
    """Sans compte payant, le compteur ne bouge pas.

    Vérifié sur l'appareil parce qu'il ne peut pas l'être ailleurs : le
    compteur voyage à l'intérieur du bloc chiffré, le serveur ne le voit pas.
    """
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path / "config"))
    vault_path = _v2_entry(tmp_path)

    code = main(["-p", "clef", "google.com", "--renew", "--vault", str(vault_path)])

    assert code == 1
    assert "offre complète" in capsys.readouterr().err
    assert load(vault_path)["entries"][0]["counter"] == 1


@pytest.mark.parametrize(
    ("env", "expected"),
    [
        ({"LANG": "en_US.UTF-8"}, "en"),
        ({"LANG": "fr_FR.UTF-8"}, "fr"),
        ({"LANG": "en_US.UTF-8", "LC_ALL": "fr_FR.UTF-8"}, "fr"),
        ({"LANG": "C"}, "fr"),
        ({}, "fr"),
    ],
)
def test_messages_follow_the_terminal_language(monkeypatch, env, expected):
    from thecode.cli import _t

    for var in ("LC_ALL", "LC_MESSAGES", "LANG"):
        monkeypatch.delenv(var, raising=False)
    for var, value in env.items():
        monkeypatch.setenv(var, value)
    assert _t("fr", "en") == expected
