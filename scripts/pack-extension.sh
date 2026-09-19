#!/usr/bin/env bash
#
# Prepare l'extension pour chaque navigateur.
#
# Les trois manifestes cohabitent dans le depot : Chrome veut un service
# worker, Firefox et Safari des scripts de fond. On ne peut donc pas charger
# apps/extension/ tel quel — il faut choisir le bon manifeste, et le nommer
# manifest.json.
#
# Produit dist/extension/chrome/ et dist/extension/firefox/, plus un .zip de
# chacun pour les magasins.
#
# Usage : ./scripts/pack-extension.sh [dossier-de-sortie]

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="${1:-$root/dist/extension}"
src="$root/apps/extension"

rm -rf "$out"
mkdir -p "$out"

for target in chrome firefox; do
    dir="$out/$target"
    mkdir -p "$dir"

    # Tout sauf ce qui ne sert qu'au developpement.
    rsync -a \
        --exclude 'js-test' \
        --exclude 'manifest-*.json' \
        --exclude 'CHANGELOG.md' \
        --exclude 'README.md' \
        "$src/" "$dir/"

    case "$target" in
        chrome)  cp "$src/manifest-chrome-brave-edge.json" "$dir/manifest.json" ;;
        firefox) cp "$src/manifest-safari-firefox.json"    "$dir/manifest.json" ;;
    esac

    # Le zip se fait depuis le dossier : un magasin refuse une archive dont le
    # manifeste est dans un sous-dossier.
    (cd "$dir" && zip -qr "../$target.zip" .)

    version=$(python3 -c "import json,sys; print(json.load(open('$dir/manifest.json'))['version'])")
    printf '%-8s v%-8s %s\n' "$target" "$version" "$dir"
done

echo
echo "Chrome, Brave, Edge : chrome://extensions → mode developpeur → « Charger l'extension non empaquetee » → $out/chrome"
echo "Firefox             : about:debugging → « Charger un module temporaire » → $out/firefox/manifest.json"
echo "Magasins            : $out/chrome.zip et $out/firefox.zip"
