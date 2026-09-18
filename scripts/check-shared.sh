#!/usr/bin/env bash
# Verifie que chaque copie d'un fichier de shared/ est identique a sa source.
# Echoue si une copie a divergé : c'est le garde-fou qui empeche une
# implementation de partir avec des vecteurs de test ou une PSL differents.
set -uo pipefail
cd "$(dirname "$0")/.."

fail=0
while IFS='|' read -r src dest; do
  [[ -z "${src// }" || "$src" == \#* ]] && continue
  target="$dest/$(basename "$src")"
  if [[ ! -f "$target" ]]; then
    echo "MANQUANT  $target  (lancer: make sync-shared)" >&2
    fail=1
  elif ! cmp -s "shared/$src" "$target"; then
    echo "DIVERGENT $target  (lancer: make sync-shared)" >&2
    fail=1
  fi
done < shared/sync-map.txt

if [[ $fail -eq 0 ]]; then
  echo "shared/ : toutes les copies sont a jour."
else
  echo "" >&2
  echo "shared/ est la source de verite. Ne jamais editer une copie." >&2
fi
exit $fail
