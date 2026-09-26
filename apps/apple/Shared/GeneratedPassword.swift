//
//  GeneratedPassword.swift
//  Affichage du mot de passe généré sur l'écran principal.
//

import Foundation

/// Le mot de passe généré est masqué par défaut.
///
/// Le masque a une longueur fixe : une rangée de points aussi longue que le
/// mot de passe en révélerait la longueur, donc une partie de la politique du
/// site, à qui regarde l'écran par-dessus l'épaule.
enum GeneratedPassword {

    /// Nombre de points du masque, quelle que soit la longueur réelle.
    static let maskLength = 12

    static let mask = String(repeating: "•", count: maskLength)

    /// Ce que l'écran montre : le mot de passe s'il est révélé, le masque sinon.
    static func display(_ value: String, revealed: Bool) -> String {
        guard !value.isEmpty else { return "" }
        return revealed ? value : mask
    }
}
