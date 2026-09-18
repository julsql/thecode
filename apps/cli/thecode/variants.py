"""Grille de variantes : retrouver un mot de passe dont on a perdu les réglages.

Avant le carnet, rien ne mémorisait les paramètres utilisés pour un site. Un
compte créé avec « 16 caractères sans symboles » devenait irretrouvable dès
qu'on avait oublié ce détail.

La grille énumère les combinaisons plausibles pour que l'utilisateur reconnaisse
la bonne, plutôt que de tâtonner à l'aveugle.

Elle sert aussi à la migration : après un changement de canonicalisation, elle
propose l'ancienne forme du site à côté de la nouvelle.
"""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any

from .core import generate_password

#: Longueurs les plus courantes, par ordre de probabilité décroissante.
COMMON_LENGTHS = (20, 16, 12, 8, 32)

#: Combinaisons de jeux de caractères réellement utilisées. Inutile d'énumérer
#: les seize possibilités : personne ne génère un mot de passe de symboles seuls.
COMMON_CHARSETS = (
    ("tout", {"lower": True, "upper": True, "symbols": True, "numbers": True}),
    ("sans symboles", {"lower": True, "upper": True, "symbols": False, "numbers": True}),
    ("lettres seules", {"lower": True, "upper": True, "symbols": False, "numbers": False}),
    ("minuscules et chiffres", {"lower": True, "upper": False, "symbols": False, "numbers": True}),
)


@dataclass(frozen=True)
class Variant:
    """Un mot de passe candidat, avec les réglages qui l'ont produit."""

    password: str
    site: str
    length: int
    charset_label: str
    charset: dict[str, bool]

    def describe(self) -> str:
        return f"{self.length} caractères, {self.charset_label}"


def _sites(site: str, legacy_sites: list[str] | None) -> Iterator[tuple[str, bool]]:
    yield site, False
    for other in legacy_sites or []:
        if other != site:
            yield other, True


def variants(
    site: str,
    master_key: str,
    *,
    legacy_sites: list[str] | None = None,
    lengths: tuple[int, ...] = COMMON_LENGTHS,
) -> list[Variant]:
    """Énumère les candidats, du plus probable au moins probable.

    ``legacy_sites`` permet d'inclure d'anciennes formes du nom de site, pour
    retrouver un mot de passe créé avant un changement de canonicalisation.
    """
    out: list[Variant] = []
    seen: set[str] = set()

    for candidate_site, _is_legacy in _sites(site, legacy_sites):
        for length in lengths:
            for label, charset in COMMON_CHARSETS:
                password = generate_password(
                    site=candidate_site,
                    key=master_key,
                    length=length,
                    use_lower=charset["lower"],
                    use_upper=charset["upper"],
                    use_symbols=charset["symbols"],
                    use_numbers=charset["numbers"],
                )
                if password is None or password in seen:
                    continue
                seen.add(password)
                out.append(
                    Variant(
                        password=password,
                        site=candidate_site,
                        length=length,
                        charset_label=label,
                        charset=dict(charset),
                    )
                )
    return out


def entry_from_variant(variant: Variant, **kwargs: Any) -> dict[str, Any]:
    """Crée l'entrée de carnet correspondant à une variante reconnue.

    C'est la sortie naturelle de la grille : une fois le bon mot de passe
    identifié, on l'enregistre pour ne plus jamais avoir à le chercher.
    """
    from .vault import new_entry

    return new_entry(
        variant.site,
        length=variant.length,
        charset=variant.charset,
        **kwargs,
    )
