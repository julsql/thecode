//
//  KeyStrengthTests.swift
//  Robustesse de la clef : mêmes seuils partout (shared/spec/key-strength.md).
//

import Testing

@testable import TheCode_for_Mac

@Suite("Robustesse de la clef")
struct KeyStrengthTests {

    @Test("Clef vide : rien à afficher")
    func emptyShowsNothing() {
        #expect(KeyStrength.of("") == .none)
    }

    @Test("Exemples partagés", arguments: [
        ("soleil", KeyStrength.weak),
        ("Abc 12!", .weak),
        ("soleilrouge", .weak),
        ("SOLEILROUGE", .weak),
        ("Soleil rouge", .fair),
        ("soleilrouge7", .fair),
        ("un chat va ici", .strong),
        ("unephrasesansespace", .strong),
    ])
    func sharedExamples(key: String, expected: KeyStrength) {
        #expect(KeyStrength.of(key) == expected)
    }

    @Test("Compte les points de code")
    func countsCodePoints() {
        #expect(KeyStrength.of(String(repeating: "🌙", count: 9)) == .weak)
        #expect(KeyStrength.of(String(repeating: "é", count: 10)) == .weak)
        #expect(KeyStrength.of(String(repeating: "é", count: 9) + "a") == .fair)
    }

    @Test("Seuils exacts")
    func exactThresholds() {
        #expect(KeyStrength.of(String(repeating: "a", count: 9)) == .weak)
        #expect(KeyStrength.of(String(repeating: "a", count: 15)) == .weak)
        #expect(KeyStrength.of(String(repeating: "a", count: 16)) == .strong)
        #expect(KeyStrength.of("ab cd ef gh") == .strong)
        #expect(KeyStrength.of("abc def ghi") == .fair)
        #expect(KeyStrength.of("ab\tcd\nef\rgh") == .strong)
    }
}
