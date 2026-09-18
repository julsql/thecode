"""Point d'entrée du service.

Le serveur est volontairement bête : il stocke des blobs chiffrés et rend un
delta. Il ne déchiffre rien, ne fusionne rien, ne résout aucun conflit — il ne
le pourrait pas, et c'est ce qui garantit qu'une compromission du service ne
livre aucun mot de passe.
"""

from __future__ import annotations

from fastapi import FastAPI

from .config import get_settings
from .routes import auth, health, vault

app = FastAPI(
    title="TheCode Sync",
    description=(
        "Synchronisation chiffrée des carnets TheCode. Le service ne voit "
        "jamais le contenu d'un carnet : tout est chiffré sur l'appareil, avec "
        "une clef dérivée de la clef maîtresse que le serveur ne connaît pas."
    ),
    version="0.1.0",
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(vault.router)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": "thecode-sync",
        "environment": get_settings().environment,
        "docs": "/docs",
    }
