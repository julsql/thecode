"""Point d'entrée du service.

Le serveur est volontairement bête : il stocke des blobs chiffrés et rend un
delta. Il ne déchiffre rien, ne fusionne rien, ne résout aucun conflit — il ne
le pourrait pas, et c'est ce qui garantit qu'une compromission du service ne
livre aucun mot de passe.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings, get_settings
from .routes import auth, health, vault

# Settings() et non get_settings() : celui-ci refuse de rendre une
# configuration incohérente, et le faire à l'import empêcherait les tests de
# poser leurs variables d'environnement. Le contrôle a bien lieu, à la première
# requête, via la dépendance.
_settings = Settings()

app = FastAPI(
    title="TheCode Sync",
    # Vide : le service est à la racine de son sous-domaine. Réglable pour le
    # cas où il serait remonté derrière un préfixe, où la documentation
    # donnerait sinon des URL inutilisables.
    root_path=_settings.root_path,
    description=(
        "Synchronisation chiffrée des carnets TheCode. Le service ne voit "
        "jamais le contenu d'un carnet : tout est chiffré sur l'appareil, avec "
        "une clef dérivée de la clef maîtresse que le serveur ne connaît pas."
    ),
    version="0.1.0",
)

# Le site appelle une autre origine que la sienne. Les apps natives et les
# extensions ne passent pas par le CORS, et rien n'utilise de cookie : les
# jetons voyagent dans l'en-tête Authorization.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
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
