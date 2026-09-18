//
//  CoreV2.swift
//  Algorithme v2.
//
//  La v1 hache SHA-256(site + clef). Sans KDF, un seul mot de passe qui fuite
//  permet de retrouver la clef maîtresse hors ligne, et cette clef ouvre tous
//  les comptes. La v2 passe la clef dans PBKDF2 avant toute dérivation, et
//  sépare les champs par un octet nul — en v1, la simple concaténation faisait
//  collisionner ("google.com", "abc") et ("google.co", "mabc").
//
//  Le rendu est identique à la v1 : c'est la partie qui a été mesurée saine.
//  Seule la graine change.
//
//  Source unique : shared/apple/CoreV2.swift
//  Spécification : shared/spec/algo-v2.md
//

import CommonCrypto
import CryptoKit
import Foundation
import SwiftUI

public enum CoreV2 {

    private static let masterSalt = "thecode-master/v2"
    private static let iterations: UInt32 = 600_000
    private static let keyBytes = 32

    private static let prefix = "thecode/v2"
    private static let separator: UInt8 = 0x00

    public enum CoreV2Error: Error, Equatable {
        case derivationFailed
    }

    /// Passe la clef maîtresse dans un KDF coûteux.
    ///
    /// Le résultat se réutilise d'un site à l'autre : la dérivation coûte
    /// volontairement cher, on ne la repaie pas à chaque mot de passe.
    public static func deriveMasterKey(_ masterKey: String) throws -> Data {
        var output = [UInt8](repeating: 0, count: keyBytes)
        let saltBytes = Array(masterSalt.utf8)

        let status = masterKey.withCString { keyPointer in
            CCKeyDerivationPBKDF(
                CCPBKDFAlgorithm(kCCPBKDF2),
                keyPointer,
                strlen(keyPointer),
                saltBytes,
                saltBytes.count,
                CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
                iterations,
                &output,
                keyBytes
            )
        }

        guard status == kCCSuccess else { throw CoreV2Error.derivationFailed }
        return Data(output)
    }

    /// Graine de la v2, en entier non signé.
    static func seed(master: Data, siteKey: String, login: String, counter: Int) -> BInt {
        var message = Data(prefix.utf8)
        message.append(separator)
        message.append(Data(siteKey.utf8))
        message.append(separator)
        message.append(Data(login.utf8))
        message.append(separator)
        message.append(Data(String(counter).utf8))

        let digest = HMAC<SHA256>.authenticationCode(
            for: message, using: SymmetricKey(data: master))
        let hex = digest.map { String(format: "%02x", $0) }.joined()
        return BInt(hex, radix: 16) ?? 0
    }
}

extension PasswordUtils {

    /// Génère un mot de passe en v2.
    ///
    /// `master` évite de repayer le KDF quand on dérive plusieurs mots de passe
    /// d'affilée. Le laisser à `nil` le dérive à la volée.
    public func generatePasswordV2(
        masterKey: String, siteKey: String, login: String = "", counter: Int = 1,
        master: Data? = nil
    ) -> PasswordResult {
        let charsetGroups = buildCharset()
        guard !charsetGroups.isEmpty, !(siteKey.isEmpty && masterKey.isEmpty) else {
            return PasswordResult(code: "", label: "Aucune", bits: 0, color: .red)
        }

        guard let derived = master ?? (try? CoreV2.deriveMasterKey(masterKey)) else {
            return PasswordResult(code: "", label: "Erreur", bits: 0, color: .red)
        }

        var newLength = longueur
        if newLength > 40 { newLength = 40 }

        let entropyBits = calculateEntropyBits(charsetGroups: charsetGroups, length: newLength)
        let security = getSecurityLevel(bits: entropyBits)

        let passwordSeed = CoreV2.seed(
            master: derived, siteKey: siteKey, login: login, counter: counter)
        let rawPassword = convertToBase(passwordSeed, charsetGroups: charsetGroups)
        let prefix = String(rawPassword.prefix(newLength))

        guard
            let finalPassword = try? applyCharsetReplacement(
                seed: passwordSeed, password: prefix, charsetGroups: charsetGroups)
        else {
            return PasswordResult(code: "", label: "Erreur", bits: 0, color: .red)
        }

        return PasswordResult(
            code: finalPassword, label: security.label, bits: entropyBits, color: security.color)
    }
}
