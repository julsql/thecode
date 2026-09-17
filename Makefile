# Point d'entree unique du monorepo. Chaque cible reste utilisable seule,
# pour que la CI et le poste de dev lancent exactement la meme chose.

.PHONY: help sync-shared check-shared test-conformance test-js test-py test lint

help:
	@grep -E '^[a-z-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

sync-shared:  ## Copie shared/ vers les arborescences des apps
	@./scripts/sync-shared.sh

check-shared:  ## Echoue si une copie de shared/ a diverge
	@./scripts/check-shared.sh

test-conformance: check-shared  ## Vecteurs partages sur toutes les implementations
	@echo "── extension (jest) ──"
	@cd apps/extension/js-test && npx jest conformance --silent
	@echo "── cli (pytest) ──"
	@cd apps/cli && PYTHONPATH=. python3 -m pytest tests/test_conformance.py -q

test-js:  ## Tests JS/TS
	@cd apps/extension/js-test && npx jest
	@cd apps/website && npm test --silent -- --run

test-py:  ## Tests Python
	@cd apps/cli && PYTHONPATH=. python3 -m pytest -q

test: check-shared test-js test-py  ## Toute la suite hors plateformes natives
