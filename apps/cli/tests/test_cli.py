"""Tests de la CLI."""

import pytest

from thecode import cli
from thecode.cli import main


def test_affiche_le_mot_de_passe_avec_show(capsys):
    # Valeur v2 : c'est la version par defaut depuis que la v1 n'est plus
    # qu'un secours explicite.
    code = main(["-p", "clef", "--show", "site"])
    assert code == 0
    out = capsys.readouterr().out.strip()
    assert out == "h4XOFa2UFJL*xB3f*bc:"


def test_longueur_personnalisee_avec_show(capsys):
    code = main(["-p", "clef", "-l", "10", "--show", "site"])
    assert code == 0
    assert len(capsys.readouterr().out.strip()) == 10


def test_copie_dans_le_presse_papiers_par_defaut(capsys, monkeypatch):
    copied = {}
    monkeypatch.setattr(cli, "_copy_to_clipboard", lambda v: copied.setdefault("value", v) or True)

    code = main(["-p", "clef", "site"])
    captured = capsys.readouterr()

    assert code == 0
    assert copied["value"] == "h4XOFa2UFJL*xB3f*bc:"
    # Le secret ne doit jamais fuiter sur stdout en mode par défaut.
    assert captured.out == ""
    assert "presse-papiers" in captured.err.lower()
    assert "h4XOFa2UFJL*xB3f*bc:" not in captured.err


def test_erreur_si_presse_papiers_indisponible(capsys, monkeypatch):
    monkeypatch.setattr(cli, "_copy_to_clipboard", lambda v: False)

    code = main(["-p", "clef", "site"])
    captured = capsys.readouterr()

    assert code == 2
    assert captured.out == ""
    assert "--show" in captured.err


def test_erreur_si_aucune_base(capsys):
    code = main([
        "-p", "clef", "site",
        "--no-lower", "--no-upper", "--no-symbols", "--no-numbers",
    ])
    assert code == 1
    err = capsys.readouterr().err
    assert "aucune base" in err.lower()


def test_password_obligatoire():
    with pytest.raises(SystemExit):
        main(["site"])


def test_algo_1_retrouve_lancien_mot_de_passe(capsys):
    """Le secours, pour un site dont le mot de passe n'a pas encore change."""
    code = main(["-p", "clef", "--algo", "1", "--show", "site"])
    assert code == 0
    assert capsys.readouterr().out.strip() == "u8YfpdVdK*#Bpy6(9f*5"
