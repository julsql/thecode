#!/usr/bin/env bash
# Copie les fichiers de shared/ vers les emplacements attendus par chaque
# toolchain, d'apres shared/sync-map.txt.
#
# A lancer apres toute modification de shared/. La CI verifie via
# check-shared.sh qu'aucune copie n'a divergé.
set -euo pipefail
cd "$(dirname "$0")/.."

n=0
while IFS='|' read -r src dest; do
  [[ -z "${src// }" || "$src" == \#* ]] && continue
  [[ -f "shared/$src" ]] || { echo "ERREUR: shared/$src introuvable" >&2; exit 1; }
  mkdir -p "$dest"
  # La source peut vivre dans un sous-dossier de shared/ ; la destination ne
  # reprend que le nom de fichier.
  base="$(basename "$src")"
  cp "shared/$src" "$dest/$base"
  echo "  shared/$src -> $dest/$base"
  n=$((n + 1))
done < shared/sync-map.txt

echo "$n fichier(s) synchronise(s)."
