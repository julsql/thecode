"""Tests de la CLI."""

import pytest

from thecode.cli import main


def test_imprime_le_mot_de_passe(capsys):
    code = main(["-p", "clef", "site"])
    assert code == 0
    out = capsys.readouterr().out.strip()
    assert out == "u8YfpdVdK*#Bpy6(9f*5"


def test_longueur_personnalisee(capsys):
    code = main(["-p", "clef", "-l", "10", "site"])
    assert code == 0
    assert len(capsys.readouterr().out.strip()) == 10


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
