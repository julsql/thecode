//
//  KeyGuideView.swift
//  Conseil et niveau de robustesse sous le champ de la clef maîtresse.
//
//  Discret et jamais bloquant (shared/spec/key-strength.md). Le niveau
//  n'apparaît que pendant la saisie ou clef affichée : clef masquée et champ
//  sans focus, il trahirait une indication de longueur que le champ cache
//  délibérément. La clef n'est ni journalisée ni stockée ici.
//

import SwiftUI

struct KeyGuideView: View {
    let key: String
    /// Champ focalisé ou clef affichée en clair.
    let active: Bool

    private static func t(_ fr: String, _ en: String) -> String {
        (Locale.preferredLanguages.first?.lowercased().hasPrefix("fr") ?? false) ? fr : en
    }

    var body: some View {
        let level = active ? KeyStrength.of(key) : .none
        VStack(alignment: .leading, spacing: 2) {
            if key.isEmpty || active {
                Text(Self.t(
                    "Choisissez une clef longue et unique, par exemple une phrase de plusieurs mots : elle protège tous vos mots de passe et votre carnet.",
                    "Choose a long, unique key, such as a phrase of several words: it protects all your passwords and your vault."
                ))
                .font(.caption)
                .foregroundColor(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            }
            if let label = Self.label(level) {
                Text(label)
                    .font(.caption.weight(.semibold))
                    .foregroundColor(Self.color(level))
                    .accessibilityLabel(label)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    static func label(_ level: KeyStrength) -> String? {
        switch level {
        case .none: return nil
        case .weak: return t("Robustesse : faible", "Strength: weak")
        case .fair: return t("Robustesse : moyenne", "Strength: fair")
        case .strong: return t("Robustesse : bonne", "Strength: strong")
        }
    }

    /// Mêmes teintes que l'indicateur de sécurité du mot de passe généré.
    private static func color(_ level: KeyStrength) -> Color {
        switch level {
        case .weak: return Color(red: 254 / 255, green: 69 / 255, blue: 1 / 255)  // #FE4501
        case .fair: return Color(red: 254 / 255, green: 118 / 255, blue: 1 / 255)  // #FE7601
        default: return Color(red: 28 / 255, green: 208 / 255, blue: 1 / 255)  // #1CD001
        }
    }
}
