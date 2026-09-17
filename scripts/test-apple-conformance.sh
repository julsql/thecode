#!/usr/bin/env bash
# Conformance des apps Apple.
#
# Isole dans un script parce qu'il faut creer un simulateur iOS : les tests
# unitaires avec host app ne tournent pas sur "My Mac (Designed for iPad)".
# Le simulateur est supprime a la sortie, meme en cas d'echec.
#
# La paire (device, runtime) vient de pick-ios-simulator.py : simctl accepte
# n'importe quelle combinaison puis echoue avec "Incompatible device" si le
# device n'est pas dans les supportedDeviceTypes du runtime.
set -euo pipefail
cd "$(dirname "$0")/.."

read -r DT RT < <(./scripts/pick-ios-simulator.py)
SIM=$(xcrun simctl create "tc-conformance-local" "$DT" "$RT")
trap 'xcrun simctl delete "$SIM" >/dev/null 2>&1 || true' EXIT

echo "── apple (swift testing) ──"
echo "   simulateur : ${DT##*.} / ${RT##*.}"
( cd apps/apple && xcodebuild test \
    -scheme thecode-iosTests \
    -destination "platform=iOS Simulator,id=$SIM" \
    -only-testing:thecode-iosTests/ConformanceTests \
    -quiet )
