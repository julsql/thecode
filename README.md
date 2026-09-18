# TheCode

Deterministic password manager: one secret key plus a site name gives you the
same password every time, on every device. No password is ever stored — each one
is recomputed on demand.

A local vault remembers which settings apply to which site, and can be carried
between devices by QR code or, optionally, through an encrypted sync service
that never sees anything but opaque blocks.

Six implementations share one algorithm — which is exactly why this is a
monorepo.

## Layout

| Path              | What it is                                                            |
| ----------------- | --------------------------------------------------------------------- |
| `shared/`         | **Source of truth.** Test vectors, algorithm spec, public suffix list |
| `apps/extension/` | Browser extension (Chrome, Edge, Brave, Firefox, Safari)              |
| `apps/website/`   | Vue 3 + Vite web app — [thecode.julsql.fr](https://thecode.julsql.fr) |
| `apps/android/`   | Android app (Java) with Autofill service                              |
| `apps/apple/`     | iOS and macOS apps (Swift) with AutoFill extensions                   |
| `apps/cli/`       | Python CLI                                                            |
| `apps/api/`       | FastAPI sync service (zero-knowledge) — optional, self-hostable       |
| `scripts/`        | Shared-file sync and conformance helpers                              |

## Why a monorepo

The same password must come out of all six implementations, byte for byte. A
one-character divergence locks a user out of their accounts.

`shared/test-vectors.json` holds the frozen v1 vectors, and every
implementation is tested against that one file. Per-platform tests were not
enough: Android and Apple each had their own domain-normalisation tests, with
different cases, and the divergence between them survived precisely because
neither suite tested the other's cases.

`shared/` is copied into each toolchain rather than referenced in place, because
Xcode and Gradle handle out-of-project references poorly. `scripts/check-shared.sh`
fails the build if any copy drifts from the source.

## Getting started

```sh
make setup              # local dev environment
make test-conformance   # shared vectors across implementations
make test               # everything except the native platforms
make sync-shared        # after editing anything in shared/
```

Apple conformance needs an iOS simulator, so it lives in its own target:

```sh
make test-conformance-apple
```

## Contributing

Never edit a copy of a `shared/` file — edit the source and run `make sync-shared`.

The `v1` section of `shared/test-vectors.json` is **frozen**: those passwords are
in production. If conformance fails, fix the implementation, never the vector.

Commits follow [Conventional Commits](https://www.conventionalcommits.org).

## Licence

Apache 2.0 for the extension and Apple apps, MIT for the CLI. See each app's
`LICENSE`.
