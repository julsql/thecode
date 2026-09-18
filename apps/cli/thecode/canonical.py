"""Canonicalisation d'une saisie en domaine enregistrable.

L'argument « site » est libre : on ne canonicalise que ce qui ressemble à un
hôte. Un libellé personnel (« serveur perso ») ressort tel quel, sinon on
changerait le mot de passe de quelqu'un qui s'en sert comme d'une étiquette.

Équivalent strict de registrableDomain côté extension, Swift et Java : c'est ce
qui garantit qu'un même compte donne le même mot de passe partout.
"""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

_PSL_FILENAME = "public_suffix_list.dat"

_SCHEME = re.compile(r"^[a-z][a-z0-9+.-]*://")
_USERINFO = re.compile(r"^[^/@]*@")


@lru_cache(maxsize=1)
def load_public_suffixes() -> frozenset[str]:
    """Charge la PSL livrée avec le paquet.

    Renvoie un ensemble vide si le fichier manque : dans ce cas on ne
    canonicalise pas, plutôt que de produire un domaine qui divergerait des
    autres plateformes.
    """
    path = Path(__file__).with_name(_PSL_FILENAME)
    if not path.is_file():
        return frozenset()
    return frozenset(
        line.strip()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("//")
    )


def extract_hostname(value: str) -> str:
    """Retire ce qui entoure l'hôte dans une URL saisie au clavier."""
    v = value.strip().lower()
    v = _SCHEME.sub("", v)
    v = _USERINFO.sub("", v)
    v = re.split(r"[/?#]", v, maxsplit=1)[0]
    v = v.split(":")[0]
    return v.removeprefix("www.")


def registrable_domain(hostname: str, suffixes: frozenset[str]) -> str:
    parts = hostname.lower().split(".")
    for i in range(len(parts)):
        if ".".join(parts[i:]) in suffixes:
            # i == 0 : l'hôte EST un suffixe public (github.io, co.uk). On ne
            # peut pas remonter d'un cran, on le rend tel quel.
            if i == 0:
                return ".".join(parts)
            return ".".join(parts[i - 1 :])
    return ".".join(parts)


def canonical_site(value: str) -> str:
    """Canonicalise une saisie libre.

    Une valeur sans point, ou une PSL absente, ressort inchangée : mieux vaut ne
    rien transformer que transformer mal.
    """
    if not value:
        return ""
    host = extract_hostname(value)
    if "." not in host:
        return host
    suffixes = load_public_suffixes()
    if not suffixes:
        return host
    return registrable_domain(host, suffixes)
