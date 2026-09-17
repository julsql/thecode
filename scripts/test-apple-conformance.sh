#!/usr/bin/env bash
# Conformance des apps Apple.
#
# Isole dans un script parce qu'il faut creer un simulateur iOS : les tests
# unitaires avec host app ne tournent pas sur "My Mac (Designed for iPad)".
# Le simulateur est supprime a la sortie, meme en cas d'echec.
set -euo pipefail
cd "$(dirname "$0")/.."

RT=$(xcrun simctl list runtimes --json \
  | python3 -c "import json,sys;print(max((r['identifier'] for r in json.load(sys.stdin)['runtimes'] if r['isAvailable'] and 'iOS' in r['name'])))")
DT=$(xcrun simctl list devicetypes --json \
  | python3 -c "import json,sys;print([d['identifier'] for d in json.load(sys.stdin)['devicetypes'] if 'iPhone' in d['name']][-1])")

SIM=$(xcrun simctl create "tc-conformance-local" "$DT" "$RT")
trap 'xcrun simctl delete "$SIM" >/dev/null 2>&1 || true' EXIT

echo "── apple (swift testing) ──"
( cd apps/apple && xcodebuild test \
    -scheme thecode-iosTests \
    -destination "platform=iOS Simulator,id=$SIM" \
    -only-testing:thecode-iosTests/ConformanceTests \
    -quiet )
