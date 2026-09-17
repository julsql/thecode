#!/usr/bin/env python3
"""Choisit une paire (device type, runtime) iOS reellement compatible.

simctl accepte de creer n'importe quelle combinaison en apparence, mais
echoue avec "Incompatible device" (code 403) si le device type n'est pas
dans les supportedDeviceTypes du runtime. On lit donc cette liste plutot
que de croiser les deux inventaires au hasard.

Sortie : "<device_type_id> <runtime_id>" sur stdout.
"""
import json
import subprocess
import sys


def main() -> int:
    runtimes = json.loads(
        subprocess.run(
            ["xcrun", "simctl", "list", "runtimes", "--json"],
            capture_output=True, text=True, check=True,
        ).stdout
    )["runtimes"]

    ios = [r for r in runtimes if r.get("isAvailable") and r.get("platform") == "iOS"]
    if not ios:
        print("Aucun runtime iOS disponible.", file=sys.stderr)
        return 1

    # Runtime le plus recent d'abord, puis un iPhone qu'il declare supporter.
    ios.sort(key=lambda r: [int(p) for p in r["version"].split(".")], reverse=True)
    for rt in ios:
        iphones = [d for d in rt.get("supportedDeviceTypes", []) if "iPhone" in d.get("name", "")]
        if iphones:
            print(f"{iphones[-1]['identifier']} {rt['identifier']}")
            return 0

    print("Aucun runtime iOS ne supporte d'iPhone.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
