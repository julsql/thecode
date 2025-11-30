//
//  PasswordUtils.swift
//  thecode-extension-ios
//
//  Created by Juliette Debono on 27/09/2025.
//

import Foundation
import SwiftUI
import CryptoKit

struct PasswordUtils {
    
    // MARK: - Base et paramètres
    var base: String = ""
    var minState: Bool = true
    var majState: Bool = true
    var symState: Bool = true
    var chiState: Bool = true
    var longueur: Int = 20
    
    // MARK: - Modifier la base selon les options
    mutating func modifBase() {
        base = ""
        if minState { base += "portezcviuxwhskyajgblndqfm" }
        if majState { base += "THEQUICKBROWNFXJMPSVLAZYDG" }
        if symState { base += "@#&!)-%;<:*$+=/?>(" }
        if chiState { base += "567438921" }
    }
    
    // MARK: - Convert hex string to BInt
    func hex2dec(_ hex: String) -> BInt {
        let baseHex = "0123456789ABCDEF"
        var result = BInt(0)
        for (i, char) in hex.uppercased().enumerated() {
            guard let idx = baseHex.firstIndex(of: char) else { continue }
            let c = BInt(baseHex.distance(from: baseHex.startIndex, to: idx))
            let powValue = power(a: BInt(16), b: hex.count - i - 1)
            result += c * powValue
        }
        return result
    }
    
    // MARK: - Convert BInt to string in custom base
    func dec2base(_ x: BInt, base: String) -> String {
        let b = BInt(base.count)
        
        // fonction pour accéder à un caractère par indice Int
        func charAt(_ s: String, _ i: Int) -> String {
            let index = s.index(s.startIndex, offsetBy: i)
            return String(s[index])
        }

        var result = charAt(base, Int(x % b))
        var inter = (x / b) - 1

        while inter != -1 {
            result = charAt(base, Int(inter % b)) + result
            inter = (inter / b) - 1
        }
        return result
    }

    
    // MARK: - Calcul de puissance (BInt)
    func power(a: BInt, b: Int) -> BInt {
        var result = BInt(1)
        for _ in 0..<b {
            result *= a
        }
        return result
    }
    
    // MARK: - Calcul sécurité en bits
    func securite(bits: Int) -> (label: String, color: Color) {
        switch bits {
        case 0:
            return ("Aucune", .red)
        case 1..<64:
            return ("Très Faible", .red)
        case 64..<80:
            return ("Faible", .red)
        case 80..<100:
            return ("Moyenne", .orange)
        case 100..<128:
            return ("Forte", .green)
        default:
            return ("Très Forte", .green)
        }
    }
    
    // MARK: Remplace certains caractères du mot de passe pour garantir qu'au moins un caractère de chaque groupe est présent.
    func applyCharsetReplacement(seed: BInt, password: String, charsetGroups: [String]) -> String {
        let length = password.count
        guard length >= charsetGroups.count else {
            fatalError("Password must have at least \(charsetGroups.count) characters")
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

        for i in 0..<charsetGroups.count {
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

    
    // MARK: - Complexifier un mot de passe
    func modification(_ mot: String) -> (code: String, label: String, bits: Int, color: Color) {
        guard let data = mot.data(using: .utf8) else {
            return ("", "Erreur", 0, .red)
        }
        
        if (mot == "" || (!minState && !majState && !symState && !chiState)) {
            return ("", "Erreur", 0, .red)
        }
        
        let digest = SHA256.hash(data: data)
        let hexDigest = digest.compactMap { String(format: "%02x", $0) }.joined()
        let chiffre = hex2dec(hexDigest)
        var code2 = String(dec2base(chiffre, base: base).prefix(longueur))
        
        // Appliquer charset replacement pour garantir un caractère de chaque groupe
        var charsetGroups: [String] = []
        if minState { charsetGroups.append("portezcviuxwhskyajgblndqfm") }
        if majState { charsetGroups.append("THEQUICKBROWNFXJMPSVLAZYDG") }
        if symState { charsetGroups.append("@#&!)-%;<:*$+=/?>(") }
        if chiState { charsetGroups.append("567438921") }

        if !charsetGroups.isEmpty {
            code2 = applyCharsetReplacement(seed: chiffre, password: code2, charsetGroups: charsetGroups)
        }
        
        let nb_carac = base.count + 1
        let bits = Int(round(log(pow(Double(nb_carac), Double(longueur))) / log(2.0)))
        let sec = securite(bits: bits)
        
        return (code2, sec.label, bits, sec.color)
    }
}
