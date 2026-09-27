# TheCode API

Optional sync service for TheCode: accounts, and end-to-end encrypted storage of each account's
vault and default settings. FastAPI + SQLAlchemy + PostgreSQL, deployed on Kubernetes.

Production: https://thecode-api.julsql.fr

## Zero knowledge

The service never sees a master key, a generated password, or a readable vault entry.

- Each vault entry (and the default settings) is encrypted on the client with **AES-256-GCM**, with
  the entry id as associated data, so a block cannot be replayed under another id.
- The encryption key is derived on the client from the master key and a **per-account salt**
  (`kdf_salt`, 16 random bytes drawn by the server at account creation and returned with the
  tokens).
- The server stores opaque blocks, a revision number and timestamps, and merges nothing: merging
  happens on the clients (`shared/spec/vault-merge.md`).

What it does hold: the account email, the account password as an **Argon2id** hash (none for
Google- or Apple-only accounts), refresh tokens and the list of connected devices.

Full protocol: `shared/spec/vault-sync.md` and `shared/spec/default-settings.md`.

## Endpoints

| Route                                             | Purpose                                                |
| ------------------------------------------------- | ------------------------------------------------------ |
| `GET /health`, `GET /ready`                       | Liveness / readiness probes                            |
| `GET /v1/auth/registration`                       | Registration mode and public sign-in client ids        |
| `POST /v1/auth/register`, `/login`                | Email/password account                                 |
| `POST /v1/auth/google`, `/apple`                  | Sign in with Google / Apple (ID token)                 |
| `POST /v1/auth/refresh`, `/logout`                | Token rotation, sign-out                               |
| `GET /v1/auth/me`                                 | Account state, `kdf_salt`                              |
| `POST /v1/auth/verify`, `/verify/resend`          | Email address confirmation                             |
| `POST /v1/auth/password/forgot`, `/reset`         | Password reset                                         |
| `GET /v1/vault?since=`, `POST`, `DELETE`          | Pull, push, delete encrypted vault entries             |
| `GET /v1/settings`, `PUT`                         | Encrypted default settings                             |
| `GET /v1/account/devices`, `DELETE /devices/{id}` | Connected devices                                      |
| `POST /v1/account/password`, `/email`             | Change password / email                                |
| `DELETE /v1/account/google`, `/apple`             | Unlink a sign-in provider                              |
| `GET /v1/account/export`                          | Export of everything the account holds                 |
| `DELETE /v1/account`                              | Account deletion (Apple tokens are revoked on the way) |

The interactive OpenAPI documentation is served at `/docs`.

## Configuration

Everything comes from the environment, prefixed `THECODE_` (see `thecode_api/config.py` for the
full list and defaults). The main ones:

| Variable                                                      | Role                                                 |
| ------------------------------------------------------------- | ---------------------------------------------------- |
| `THECODE_ENVIRONMENT`                                         | `production` enforces a JWT secret                   |
| `THECODE_DATABASE_URL`                                        | PostgreSQL URL (`postgresql+psycopg://…`)            |
| `THECODE_JWT_SECRET`                                          | Token signing secret — required in production        |
| `THECODE_REGISTRATION_MODE`                                   | `open` (default), `quota`, `invite` or `closed`      |
| `THECODE_INVITE_CODE`                                         | Code required in `invite` mode                       |
| `THECODE_CORS_ORIGINS`                                        | Browser origins allowed (comma-separated)            |
| `THECODE_SITE_URL`                                            | Public website, for links in emails                  |
| `THECODE_GOOGLE_CLIENT_ID`, `THECODE_GOOGLE_EXTRA_CLIENT_IDS` | Accepted Google audiences; empty disables Google     |
| `THECODE_APPLE_CLIENT_IDS`, `THECODE_APPLE_WEB_CLIENT_ID`     | Accepted Apple audiences; empty disables Apple       |
| `THECODE_APPLE_TEAM_ID`, `_KEY_ID`, `_PRIVATE_KEY`            | Apple token revocation on account deletion           |
| `THECODE_MAIL_TRANSPORT`                                      | `log` (development) or `smtp`, with `THECODE_MAIL_*` |

The production instance runs with open registration.

## Development

```sh
cd apps/api
python -m venv .venv && . .venv/bin/activate
pip install -e '.[test]'
alembic upgrade head                 # against THECODE_DATABASE_URL
uvicorn thecode_api.main:app --reload
```

### Tests

```sh
ruff check .
python -m pytest
```

The tests start a throwaway PostgreSQL with testcontainers (Docker required), unless
`THECODE_TEST_DATABASE_URL` points to an existing database.

## Deployment

`.github/workflows/api.yml` runs the tests against PostgreSQL, builds the image from `Dockerfile`
(multi-stage, non-root user, uvicorn with two workers) and pushes it to
`ghcr.io/julsql/thecode/api`. It then calls the **Keel** webhook, which redeploys the Kubernetes
deployment on the new `latest` tag. Migrations are applied with `alembic upgrade head`.

## License

Apache License 2.0 — see the repository's `LICENSE`.
