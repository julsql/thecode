"""Tests pour la logique de génération (parallèle à thecode-extension/js-test/background.spec.js)."""

import pytest

from thecode.core import (
    LOWER,
    UPPER,
    SYMBOLS,
    NUMBERS,
    apply_charset_replacement,
    build_charset,
    convert_to_base,
    generate_password,
    get_unique_position,
    hash_to_int,
)

TOTAL_BASE = [LOWER, UPPER, SYMBOLS, NUMBERS]


# ===================== generate_password =====================

class TestGeneratePassword:
    def test_genere_un_mot_de_passe_avec_toutes_les_options_activees(self):
        result = generate_password("site", "clef", 20, True, True, True, True)

        assert len(result) == 20
        assert result == "u8YfpdVdK*#Bpy6(9f*5"

        # Au moins un caractère de chaque groupe est présent
        for group in TOTAL_BASE:
            assert any(c in result for c in group)

    def test_retourne_none_si_aucune_base(self):
        assert generate_password("site", "clef", 20, False, False, False, False) is None

    def test_retourne_none_si_entrees_vides(self):
        assert generate_password("", "", 20, True, True, True, True) is None

    def test_deterministe(self):
        a = generate_password("google.com", "password", 20, True, True, True, True)
        b = generate_password("google.com", "password", 20, True, True, True, True)
        assert a == b

    def test_change_avec_le_site(self):
        a = generate_password("google.com", "password", 20, True, True, True, True)
        b = generate_password("github.com", "password", 20, True, True, True, True)
        assert a != b


# ===================== build_charset =====================

class TestBuildCharset:
    @pytest.mark.parametrize(
        "use_lower,use_upper,use_symbols,use_numbers,expected",
        [
            (True, True, True, True, TOTAL_BASE),
            (True, False, True, False, [LOWER, SYMBOLS]),
            (False, False, False, False, []),
        ],
    )
    def test_base_attendue(self, use_lower, use_upper, use_symbols, use_numbers, expected):
        assert build_charset(use_lower, use_upper, use_symbols, use_numbers) == expected


# ===================== convert_to_base =====================

class TestConvertToBase:
    @pytest.mark.parametrize(
        "x,charset_groups,expected",
        [
            (1, ["abc"], "b"),
            (0, ["abc"], "a"),
            (2, ["01"], "00"),
        ],
    )
    def test_conversion(self, x, charset_groups, expected):
        assert convert_to_base(x, charset_groups) == expected


# ===================== apply_charset_replacement =====================

class TestApplyCharsetReplacement:
    def test_garantit_au_moins_un_caractere_de_chaque_groupe(self):
        seed = 123456789
        charset_groups = ["abc", "XYZ", "123"]
        password = "aaaaaaaaa"

        result = apply_charset_replacement(seed, password, charset_groups)
        assert len(result) == len(password)
        for group in charset_groups:
            assert any(c in result for c in group)

    def test_lance_une_erreur_si_le_mot_de_passe_est_trop_court(self):
        seed = 1
        charset_groups = ["abc", "XYZ", "123"]
        password = "ab"

        with pytest.raises(ValueError, match=r"Password must have at least"):
            apply_charset_replacement(seed, password, charset_groups)


# ===================== get_unique_position =====================

class TestGetUniquePosition:
    def test_retourne_une_position_unique_dans_la_longueur_donnee(self):
        seed = 5
        used_positions = [0, 1, 2]
        length = 5
        pos = get_unique_position(seed, used_positions, length)

        assert 0 <= pos < length
        assert pos not in used_positions

    def test_boucle_si_toutes_les_positions_inferieures_sont_utilisees(self):
        seed = 3
        used_positions = [0, 1, 2, 3]
        length = 5
        assert get_unique_position(seed, used_positions, length) == 4


# ===================== hash_to_int =====================

class TestHashToInt:
    def test_retourne_un_int_correct_pour_une_chaine_donnee(self):
        expected_hex = (
            "9f86d081884c7d659a2feaa0c55ad015"
            "a3bf4f1b2b0b822cd15d6c15b0f00a08"
        )
        expected_int = int(expected_hex, 16)

        result = hash_to_int("test")
        assert isinstance(result, int)
        assert result == expected_int

    def test_produit_des_valeurs_differentes_pour_des_entrees_differentes(self):
        assert hash_to_int("hello") != hash_to_int("world")
