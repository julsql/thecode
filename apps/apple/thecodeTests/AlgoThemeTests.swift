//
//  AlgoThemeTests.swift
//  Accent selon l'algorithme : bleu en v2, rose en v1.
//

import SwiftUI
import Testing
import UIKit

@testable import TheCode

@Suite("Thème selon l'algorithme")
struct AlgoThemeTests {

    @Test("v2 garde l'accent de l'app, v1 passe en rose")
    func tintFollowsAlgorithm() {
        #expect(AlgoTheme.tint(usesV1: false) == AlgoTheme.v2Blue)
        #expect(AlgoTheme.tint(usesV1: true) == AlgoTheme.v1Pink)
        #expect(AlgoTheme.v1Pink != AlgoTheme.v2Blue)
    }

    @Test("Rose v1 : #D6336C en clair, #F06595 en sombre")
    func pinkPerAppearance() {
        let pink = UIColor(AlgoTheme.v1Pink)
        #expect(hex(pink, .light) == 0xD6336C)
        #expect(hex(pink, .dark) == 0xF06595)
    }

    private func hex(_ color: UIColor, _ style: UIUserInterfaceStyle) -> UInt32 {
        let resolved = color.resolvedColor(with: UITraitCollection(userInterfaceStyle: style))
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        resolved.getRed(&r, green: &g, blue: &b, alpha: &a)
        return UInt32((r * 255).rounded()) << 16 | UInt32((g * 255).rounded()) << 8
            | UInt32((b * 255).rounded())
    }
}
