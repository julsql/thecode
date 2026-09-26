import pytest


@pytest.fixture(autouse=True)
def isolated_config(tmp_path, monkeypatch):
    """Aucun test ne lit ni n'écrit la configuration réelle de l'utilisateur.

    Des réglages par défaut retenus sur la machine changeraient sinon les mots
    de passe attendus.
    """
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path / "xdg"))
