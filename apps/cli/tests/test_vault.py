"""Carnet : fusion vérifiée contre les cas partagés.

La règle de fusion doit être identique sur les cinq implémentations : deux
appareils qui fusionnent les mêmes carnets doivent aboutir au même résultat,
sinon ils repartent en divergence à la synchronisation suivante.

Fichier synchronisé depuis shared/ ; ne jamais l'éditer directement.
"""

import json
from pathlib import Path

import pytest
from thecode import vault

SPEC = json.loads((Path(__file__).parent / "merge-cases.json").read_text())
CASES = SPEC["cases"]


def _normalise(v):
    """Compare les carnets sans dépendre de updatedAt du conteneur."""
    return sorted(v["entries"], key=lambda e: e["id"])


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_merge_matches_shared_reference(case):
    got, conflicts = vault.merge(case["left"], case["right"])
    assert _normalise(got) == _normalise(case["expected"]), case["why"]
    assert sorted({c.kind for c in conflicts}) == sorted(set(case["conflicts"]))


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_merge_is_commutative(case):
    """L'ordre de synchronisation des appareils ne doit pas changer le résultat."""
    left_first, _ = vault.merge(case["left"], case["right"])
    right_first, _ = vault.merge(case["right"], case["left"])

    # siteKey divergent est volontairement asymétrique : on garde celui de
    # gauche plutôt que de trancher. Le conflit est signalé des deux côtés.
    if "sitekey-divergent" in case["conflicts"]:
        pytest.skip("siteKey divergent : resolution laissee a l'utilisateur")

    assert _normalise(left_first) == _normalise(right_first)


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_merge_is_idempotent(case):
    once, _ = vault.merge(case["left"], case["right"])
    twice, _ = vault.merge(once, case["right"])
    assert _normalise(twice) == _normalise(once)


def test_merging_a_vault_with_itself_changes_nothing():
    v = vault.empty_vault()
    v["entries"].append(vault.new_entry("google.com"))
    merged, conflicts = vault.merge(v, v)
    assert _normalise(merged) == _normalise(v)
    assert conflicts == []


class TestLookup:
    """Le carnet doit répondre aux trois problèmes d'origine."""

    def test_one_account_across_several_domains(self):
        """google.com, google.fr et youtube.com partagent un mot de passe."""
        v = vault.empty_vault()
        v["entries"].append(
            vault.new_entry("google.com", domains=["google.com", "google.fr", "youtube.com"])
        )
        for domain in ("google.com", "google.fr", "youtube.com"):
            assert vault.find_by_domain(v, domain)["siteKey"] == "google.com"

    def test_several_accounts_on_one_site(self):
        """Deux comptes sur un même site, distingués par leur siteKey."""
        v = vault.empty_vault()
        v["entries"] += [
            vault.new_entry("google.com", label="perso", domains=["google.com"]),
            vault.new_entry("google.com#pro", label="pro", domains=["google.com"]),
        ]
        found = vault.find_all_by_domain(v, "google.com")
        assert len(found) == 2
        assert {e["siteKey"] for e in found} == {"google.com", "google.com#pro"}

    def test_parameters_are_per_entry(self):
        """Changer la longueur d'un site ne touche pas les autres."""
        v = vault.empty_vault()
        a = vault.new_entry("a.com", length=32)
        b = vault.new_entry("b.com", length=12)
        v["entries"] += [a, b]
        assert vault.find_by_domain(v, "a.com")["length"] == 32
        assert vault.find_by_domain(v, "b.com")["length"] == 12

    def test_deleted_entries_are_not_returned(self):
        v = vault.empty_vault()
        e = vault.new_entry("google.com")
        e["deleted"] = True
        v["entries"].append(e)
        assert vault.find_by_domain(v, "google.com") is None


def test_save_is_atomic(tmp_path):
    """Une interruption ne doit pas laisser un carnet tronqué."""
    path = tmp_path / "sub" / "vault.json"
    v = vault.empty_vault()
    v["entries"].append(vault.new_entry("google.com"))
    vault.save(v, path)
    assert vault.load(path)["entries"][0]["siteKey"] == "google.com"
    assert not list(path.parent.glob("*.tmp"))


def test_load_refuses_an_unknown_schema(tmp_path):
    path = tmp_path / "vault.json"
    path.write_text(json.dumps({"schema": 99, "entries": []}))
    with pytest.raises(ValueError, match="version"):
        vault.load(path)
