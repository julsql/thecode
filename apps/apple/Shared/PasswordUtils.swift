//
//  PasswordUtils.swift
//  thecode-extension-ios
//
//  Created by Juliette Debono on 27/09/2025.
//

import Foundation
import SwiftUI
import CryptoKit
import Foundation
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
    
    // MARK: - Public options
    var minState: Bool = true
    var majState: Bool = true
    var symState: Bool = true
    var chiState: Bool = true
    var longueur: Int = 20
    
    private let lower = "portezcviuxwhskyajgblndqfm"
    private let upper = "THEQUICKBROWNFXJMPSVLAZYDG"
    private let symbols = "@#&!)-%;<:*$+=/?>("
    private let numbers = "567438921"
    
    // MARK: - Génération principale
    func generatePassword(input: String) -> PasswordResult {
        if (input == "") {
            return PasswordResult(code: "", label: "Aucune clé n'est définie.", bits: 0, color: .red)
        }
        // Vérifs équivalentes JavaScript
        if longueur < 4 {
            return PasswordResult(code: "", label: "La longueur doit être supérieur à 4", bits: 0, color: .red)
        }
        if longueur > 40 {
            return PasswordResult(code: "", label: "La longueur doit être inférieure à 40", bits: 0, color: .red)
        }
        if !minState && !majState && !symState && !chiState {
            return PasswordResult(code: "", label: "Il faut choisir des caractères", bits: 0, color: .red)
        }
        
        let groups = buildCharset()
        if groups.isEmpty {
            return PasswordResult(code: "", label: "Il faut choisir des caractères", bits: 0, color: .red)
        }
        
        let seedString = input
        let seed = hashToBInt(seedString)
        
        let totalBase = groups.joined()
        var rawPassword = convertToBase(seed: seed, charset: totalBase)
        
        if rawPassword.count > longueur {
            rawPassword = String(rawPassword.prefix(longueur))
        }
        
        do {
            let final = try applyCharsetReplacement(
                seed: seed,
                password: rawPassword,
                charsetGroups: groups
            )
            let bits = calculateEntropyBits(groups: groups, length: longueur)
            let (label, color) = getSecurityLevel(bits: bits)
            
            return PasswordResult(code: final, label: label, bits: bits, color: color)
       
        } catch PasswordError.passwordTooShort(let min) {
            print("Erreur PasswordError.passwordTooShort avec min = \(min)")
            return PasswordResult(code: "", label: "Erreur", bits: 0, color: .red)
        } catch {
            return PasswordResult(code: "", label: "Erreur", bits: 0, color: .red)
        }
    
         }
    
    // MARK: - Charset
    func buildCharset() -> [String] {
        [
            minState ? lower : "",
            majState ? upper : "",
            symState ? symbols : "",
            chiState ? numbers : ""
        ].filter { !$0.isEmpty }
    }
    
    // MARK: - Entropie
    func calculateEntropyBits(groups: [String], length: Int) -> Int {
        let totalChars = groups.map(\.count).reduce(0, +)
        if totalChars == 0 { return 0 }
        return Int(Double(length) * log2(Double(totalChars)))
    }
    
    // MARK: - Niveau de sécurité
    func getSecurityLevel(bits: Int) -> (String, Color) {
        switch bits {
        case 0:
            return ("Aucune", .red)
        case ..<64:
            return ("Très Faible", .red)
        case ..<80:
            return ("Faible", .red)
        case ..<100:
            return ("Moyenne", .orange)
        case ..<126:
            return ("Forte", .green)
        default:
            return ("Très Forte", .green)
        }
    }
    
    // MARK: - Conversion base personnalisée
    func convertToBase(seed: BInt, charset: String) -> String {
        let base = BInt(charset.count)
        var value = seed
        var result = ""
        
        while value >= 0 {
            let index = Int(value % base)
            let c = charset[charset.index(charset.startIndex, offsetBy: index)]
            result = String(c) + result
            value = (value / base) - 1
            if value < 0 { break }
        }
        return result
    }
    
    // MARK: - Remplacement obligatoire (garantir 1 char de chaque groupe)
    func applyCharsetReplacement(seed: BInt, password: String, charsetGroups: [String]) throws -> String {
        let length = password.count
        guard length >= charsetGroups.count else {
            throw PasswordError.passwordTooShort(min: charsetGroups.count)
        }
        
        var temp = seed
        var positions: [Int] = []
        
        // Sélection des positions uniques
        func getUniquePosition(_ temp: BInt, _ existing: [Int], _ maxLength: Int) -> Int {
            var pos = Int(temp % BInt(maxLength))
            while existing.contains(pos) {
                pos = (pos + 1) % maxLength
            }
            return pos
        }
        
        for _ in 0..<charsetGroups.count {
            let pos = getUniquePosition(temp, positions, length)
            positions.append(pos)
            temp /= BInt(length)
        }
        
        // Remplacement des caractères
        var result = password
        temp = seed
        for (i, pos) in positions.enumerated() {
            let group = charsetGroups[i]
            let idx = Int(temp % BInt(group.count))
            let charIndex = group.index(group.startIndex, offsetBy: idx)
            let replacementChar = group[charIndex]
            
            let strIndex = result.index(result.startIndex, offsetBy: pos)
            result.replaceSubrange(strIndex...strIndex, with: String(replacementChar))
            
            temp /= BInt(group.count)
        }
        
        return result
    }
    
    func getUniquePosition(seed: BInt, used: [Int], length: Int) -> Int {
        var pos = Int(seed % BInt(length))
        while used.contains(pos) {
            pos = (pos + 1) % length
        }
        return pos
    }
    
    // MARK: - SHA-256 → BInt
    func hashToBInt(_ s: String) -> BInt {
        let data = Data(s.utf8)
        let hash = SHA256.hash(data: data)
        let hex = hash.compactMap { String(format: "%02x", $0) }.joined()
        return BInt(hex, radix: 16) ?? 0
    }
}
