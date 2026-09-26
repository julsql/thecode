//
//  KeyStrength.swift
//  Robustesse de la clef maîtresse.
//
//  Toute la sécurité du carnet synchronisé repose sur cette clef : un attaquant
//  qui obtient la base peut essayer hors ligne les clefs courantes. Ce calcul ne
//  sert qu'à guider, il ne bloque jamais la définition de la clef. Purement
//  local : ni réseau, ni journal, ni stockage.
//
//  Spécification : shared/spec/key-strength.md
//

import Foundation

enum KeyStrength: Equatable {
    case none, weak, fair, strong

    static let weakBelow = 10
    static let strongFrom = 16
    static let strongWords = 4

    static func of(_ key: String) -> KeyStrength {
        // Points de code, pas caractères graphiques ni unités UTF-16 : même
        // compte que les autres plateformes.
        let scalars = key.unicodeScalars
        if scalars.isEmpty { return .none }
        if scalars.count < weakBelow { return .weak }
        let blanks: Set<Unicode.Scalar> = [" ", "\t", "\n", "\r"]
        let words = key.unicodeScalars
            .split(whereSeparator: { blanks.contains($0) })
            .count
        if scalars.count >= strongFrom || words >= strongWords { return .strong }
        let classes = Set(scalars.map { c -> Int in
            switch c {
            case "a"..."z": return 0
            case "A"..."Z": return 1
            case "0"..."9": return 2
            default: return 3
            }
        })
        return classes.count >= 2 ? .fair : .weak
    }
}
