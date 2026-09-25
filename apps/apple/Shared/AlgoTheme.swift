//
//  AlgoTheme.swift
//  Shared (TheCode iOS / TheCode for Mac)
//
//  Couleur d'accent selon l'algorithme : bleu en v2, rose en v1. La v1 est
//  une exception ; elle doit se voir sur tout l'écran, pas seulement dans un
//  badge, pour qu'on ne génère pas par mégarde un mot de passe avec l'ancien
//  algorithme.
//

import SwiftUI

#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

enum AlgoTheme {

    /// L'accent actuel de l'app : AccentColor est vide, c'est donc le bleu
    /// système sur iOS, et l'accent choisi dans les Réglages sur macOS.
    static let v2Blue = Color.accentColor

    /// Rose v1. Contrastes WCAG vérifiés :
    /// - clair #D6336C : 4,6:1 sur blanc, idem pour du texte blanc dessus ;
    /// - sombre #F06595 : 5,7:1 sur le fond sombre (#1C1C1E), 4,6:1 sur une
    ///   cellule sombre (#2C2C2E). Le texte blanc dessus (bouton plein) ne
    ///   tient que 3:1, le seuil des composants d'interface — le bleu système
    ///   sombre est dans le même cas (3,6:1).
    static let v1Pink = dynamic(light: 0xD6336C, dark: 0xF06595)

    static func tint(usesV1: Bool) -> Color {
        usesV1 ? v1Pink : v2Blue
    }

    private static func dynamic(light: UInt32, dark: UInt32) -> Color {
        #if canImport(UIKit)
        return Color(UIColor { traits in
            traits.userInterfaceStyle == .dark ? uiColor(dark) : uiColor(light)
        })
        #elseif canImport(AppKit)
        return Color(NSColor(name: nil) { appearance in
            appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
                ? nsColor(dark) : nsColor(light)
        })
        #endif
    }

    private static func components(_ hex: UInt32) -> (CGFloat, CGFloat, CGFloat) {
        (CGFloat((hex >> 16) & 0xFF) / 255,
         CGFloat((hex >> 8) & 0xFF) / 255,
         CGFloat(hex & 0xFF) / 255)
    }

    #if canImport(UIKit)
    private static func uiColor(_ hex: UInt32) -> UIColor {
        let (r, g, b) = components(hex)
        return UIColor(red: r, green: g, blue: b, alpha: 1)
    }
    #elseif canImport(AppKit)
    private static func nsColor(_ hex: UInt32) -> NSColor {
        let (r, g, b) = components(hex)
        return NSColor(srgbRed: r, green: g, blue: b, alpha: 1)
    }
    #endif
}
