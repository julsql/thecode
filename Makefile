# Point d'entree unique du monorepo. Chaque cible reste utilisable seule,
# pour que la CI et le poste de dev lancent exactement la meme chose.

.PHONY: help sync-shared check-shared test-conformance test-conformance-apple test-js test-py test setup require-setup

# Environnement Python local : la CI installe le paquet dans le runner, mais en
# local on isole dans apps/cli/.venv pour ne pas dependre du python systeme.
CLI_VENV := $(CURDIR)/apps/cli/.venv
CLI_PY   := $(CLI_VENV)/bin/python

help:
	@grep -E '^[a-z-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

sync-shared:  ## Copie shared/ vers les arborescences des apps
	@./scripts/sync-shared.sh

check-shared:  ## Echoue si une copie de shared/ a diverge
	@./scripts/check-shared.sh

setup:  ## Prepare l'environnement de dev local (venv Python, deps npm)
	@test -x $(CLI_PY) || python3 -m venv $(CLI_VENV)
	@cd apps/cli && $(CLI_PY) -m pip install -q -e '.[test]'
	@test -d apps/extension/js-test/node_modules || (cd apps/extension/js-test && npm ci --silent)
	@test -d apps/website/node_modules || (cd apps/website && npm ci --silent)
	@echo "Environnement pret."

require-setup:
	@test -x $(CLI_PY) || { echo "Environnement absent. Lancer: make setup" >&2; exit 1; }
	@test -d apps/extension/js-test/node_modules || { echo "Deps npm absentes. Lancer: make setup" >&2; exit 1; }
	@test -d apps/website/node_modules || { echo "Deps npm absentes. Lancer: make setup" >&2; exit 1; }

test-conformance: check-shared require-setup  ## Vecteurs partages sur toutes les implementations
	@echo "── extension (jest) ──"
	@cd apps/extension/js-test && npx jest conformance --silent
	@echo "── website (vitest) ──"
	@cd apps/website && npx vitest run test/conformance.spec.ts
	@echo "── cli (pytest) ──"
	@cd apps/cli && PYTHONPATH=. $(CLI_PY) -m pytest tests/test_conformance.py -q
	@echo "── android (junit) ──"
	@cd apps/android && ./gradlew :app:testDebugUnitTest \
	  --tests 'fr.juliette.thecode.CodeConformanceTest' \
	  --tests 'fr.juliette.thecode.autofill.DomainCanonicalTest' --console=plain -q

test-conformance-apple: check-shared  ## Conformance Apple (cree un simulateur iOS temporaire)
	@./scripts/test-apple-conformance.sh

test-js:  ## Tests JS/TS
	@cd apps/extension/js-test && npx jest
	@cd apps/website && npm test --silent -- --run

test-py:  ## Tests Python
	@cd apps/cli && PYTHONPATH=. $(CLI_PY) -m pytest -q

test: check-shared test-js test-py  ## Toute la suite hors plateformes natives
