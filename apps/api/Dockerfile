# Image du service de synchronisation.
#
# Multi-stage : les outils de compilation de psycopg ne doivent pas se
# retrouver dans l'image finale.

FROM python:3.13-slim AS builder

WORKDIR /build
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY pyproject.toml ./
COPY thecode_api ./thecode_api
RUN pip install --no-cache-dir .

FROM python:3.13-slim

# Utilisateur non privilégié : un service exposé sur Internet n'a aucune raison
# de tourner en root.
RUN useradd --create-home --uid 10001 thecode

COPY --from=builder /opt/venv /opt/venv
COPY --chown=thecode:thecode migrations /app/migrations
COPY --chown=thecode:thecode alembic.ini /app/alembic.ini

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app
USER thecode
EXPOSE 8000

# Une seule instance, donc plusieurs workers pour tenir la charge sans
# multiplier les connexions à la base.
CMD ["uvicorn", "thecode_api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
