//
//  PasswordUtils.swift
//  thecode (Shared)
//
//  Port direct de l'algorithme JavaScript de l'extension Safari
//  (`thecode Extension/Resources/background.js`). Toute modification ici
//  doit être faite en parallèle dans le JS pour conserver la propriété :
//  même clé + même site = même mot de passe, peu importe le client.
//
//  Étapes :
//    1. SHA-256(input) → BInt
//    2. convertToBase(seed, charsetGroups.join("")) → chaîne brute
//    3. troncature à `longueur`
//    4. applyCharsetReplacement → garantit qu'au moins un caractère de
//       chaque groupe (minuscules, majuscules, symboles, chiffres) est
//       présent à des positions déterministes dérivées du seed.
//

import Foundation
import SwiftUI
import CryptoKit

struct PasswordResult {
    let code: String
    let label: String
    let bits: Int
    let color: Color
}

enum PasswordError: Error, Equatable {
    case passwordTooShort(min: Int)
}

class PasswordUtils {

    // MARK: - Options publiques
    var minState: Bool = true
    var majState: Bool = true
    var symState: Bool = true
    var chiState: Bool = true
    var longueur: Int = 20

    // Mêmes alphabets et même ordre que le JS de l'extension.
    private let lower   = "portezcviuxwhskyajgblndqfm"
    private let upper   = "THEQUICKBROWNFXJMPSVLAZYDG"
    private let symbols = "@#&!)-%;<:*$+=/?>("
    private let numbers = "567438921"

    // MARK: - Génération principale (miroir de generatePassword)
    func generatePassword(input: String) -> PasswordResult {
        let charsetGroups = buildCharset()
        if charsetGroups.isEmpty || input.isEmpty {
            return PasswordResult(code: "", label: "Aucune", bits: 0,
                                  color: Color(hex: "#FE0101"))
        }

        // Bornes : on suit la borne haute du JS ; la borne basse n'est pas
        // appliquée silencieusement par le JS, on la respecte ici aussi.
        var newLength = longueur
        if newLength > 40 { newLength = 40 }

        let entropyBits = calculateEntropyBits(charsetGroups: charsetGroups,
                                               length: newLength)
        let security = getSecurityLevel(bits: entropyBits)

        let passwordSeed = hashToBInt(input)
        let rawPassword  = convertToBase(passwordSeed,
                                         charsetGroups: charsetGroups)

        let prefix = String(rawPassword.prefix(newLength))

        do {
            let finalPassword = try applyCharsetReplacement(
                seed: passwordSeed,
                password: prefix,
                charsetGroups: charsetGroups
            )
            return PasswordResult(code: finalPassword,
                                  label: security.label,
                                  bits: entropyBits,
                                  color: security.color)
        } catch PasswordError.passwordTooShort(let min) {
            print("Erreur PasswordError.passwordTooShort avec min = \(min)")
            return PasswordResult(code: "", label: "Erreur", bits: 0,
                                  color: Color(hex: "#FE0101"))
        } catch {
            return PasswordResult(code: "", label: "Erreur", bits: 0,
                                  color: Color(hex: "#FE0101"))
        }
    }

    // MARK: - Charset (miroir de buildCharset)
    func buildCharset() -> [String] {
        return [
            minState ? lower   : "",
            majState ? upper   : "",
            symState ? symbols : "",
            chiState ? numbers : ""
        ].filter { !$0.isEmpty }
    }

    // MARK: - Entropie (miroir de calculateEntropyBits)
    func calculateEntropyBits(charsetGroups: [String], length: Int) -> Int {
        let totalChars = charsetGroups.reduce(0) { $0 + $1.count }
        if totalChars == 0 { return 0 }
        return Int((Double(length) * log2(Double(totalChars))).rounded())
    }

    // MARK: - Niveau de sécurité (miroir de getSecurityLevel)
    func getSecurityLevel(bits: Int) -> (label: String, color: Color) {
        if bits == 0    { return ("Aucune",      Color(hex: "#FE0101")) }
        if bits < 64    { return ("Très Faible", Color(hex: "#FE0101")) }
        if bits < 80    { return ("Faible",      Color(hex: "#FE4501")) }
        if bits < 100   { return ("Moyenne",     Color(hex: "#FE7601")) }
        if bits < 126   { return ("Forte",       Color(hex: "#53FE38")) }
        return                ("Très Forte", Color(hex: "#1CD001"))
    }

    // MARK: - Conversion en base personnalisée (miroir de convertToBase)
    /// Joint les groupes en une seule alphabet (comme le JS), convertit le
    /// `seed` dans cette base et préfixe les chiffres au résultat.
    func convertToBase(_ x: BInt, charsetGroups: [String]) -> String {
        let charset = charsetGroups.joined()
        let chars = Array(charset)
        let base = BInt(chars.count)

        var value = x
        var result = ""
        while value >= 0 {
            let index = Int(value % base)
            result = String(chars[index]) + result
            value = (value / base) - 1
            if value < 0 { break }
        }
        return result
    }

    // MARK: - Garantie d'au moins un caractère de chaque groupe
    /// Miroir exact de `applyCharsetReplacement` du JS : on choisit N
    /// positions uniques dérivées du seed (N = nombre de groupes), puis on
    /// y écrit un caractère dérivé du même seed pour chaque groupe.
    func applyCharsetReplacement(
        seed: BInt,
        password: String,
        charsetGroups: [String]
    ) throws -> String {
        let length = password.count
        guard length >= charsetGroups.count else {
            throw PasswordError.passwordTooShort(min: charsetGroups.count)
        }

        // 1) Sélection des positions uniques
        var temp = seed
        var positions: [Int] = []
        for _ in 0..<charsetGroups.count {
            let pos = getUniquePosition(seed: temp,
                                        used: positions,
                                        length: length)
            positions.append(pos)
            temp = temp / BInt(length)
        }

        // 2) Remplacement des caractères
        var chars = Array(password)
        temp = seed
        for (i, pos) in positions.enumerated() {
            let groupChars = Array(charsetGroups[i])
            let index = Int(temp % BInt(groupChars.count))
            chars[pos] = groupChars[index]
            temp = temp / BInt(groupChars.count)
        }
        return String(chars)
    }

    // MARK: - Position unique (miroir de getUniquePosition)
    func getUniquePosition(seed: BInt, used: [Int], length: Int) -> Int {
        var pos = Int(seed % BInt(length))
        while used.contains(pos) {
            pos = (pos + 1) % length
        }
        return pos
    }

    // MARK: - SHA-256 → BInt (miroir de hashToBigInt)
    func hashToBInt(_ s: String) -> BInt {
        let data = Data(s.utf8)
        let hash = SHA256.hash(data: data)
        let hex = hash.map { String(format: "%02x", $0) }.joined()
        return BInt(hex, radix: 16) ?? 0
    }
}

// MARK: - Color hex helper
private extension Color {
    init(hex: String) {
        var s = hex
        if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6, let v = UInt32(s, radix: 16) else {
            self = .red
            return
        }
        let r = Double((v >> 16) & 0xFF) / 255.0
        let g = Double((v >>  8) & 0xFF) / 255.0
        let b = Double( v        & 0xFF) / 255.0
        self = Color(red: r, green: g, blue: b)
    }
}
