//
//  Fingerprint.swift
//  Empreinte de la clef maîtresse.
//
//  Une faute de frappe sur la clef ne se voit pas : elle produit simplement un
//  autre mot de passe, valide en apparence. On ne s'en aperçoit qu'au refus de
//  connexion, sans savoir si le tort vient de la clef, du site ou des réglages.
//
//  Source unique : shared/apple/Fingerprint.swift
//  Spécification : shared/spec/fingerprint.md
//

import CommonCrypto
import Foundation
import SwiftUI

public enum Fingerprint {

    private static let salt = "thecode-fingerprint/v1"
    private static let iterations: UInt32 = 600_000
    private static let keyBytes = 32

    /// Sans 0/O ni 1/I/L : une empreinte se lit parfois à voix haute, elle ne
    /// doit laisser aucune hésitation.
    private static let alphabet = Array("23456789ABCDEFGHJKMNPQRSTUVWXYZ")
    private static let length = 3

    /// Douze teintes distinctes, pour un repère visuel immédiat.
    private static let palette: [Color] = [
        Color(red: 0.898, green: 0.282, blue: 0.302),
        Color(red: 0.969, green: 0.420, blue: 0.082),
        Color(red: 1.000, green: 0.698, blue: 0.141),
        Color(red: 0.741, green: 0.933, blue: 0.388),
        Color(red: 0.275, green: 0.655, blue: 0.345),
        Color(red: 0.161, green: 0.639, blue: 0.514),
        Color(red: 0.000, green: 0.635, blue: 0.780),
        Color(red: 0.000, green: 0.565, blue: 1.000),
        Color(red: 0.243, green: 0.388, blue: 0.867),
        Color(red: 0.431, green: 0.337, blue: 0.812),
        Color(red: 0.839, green: 0.251, blue: 0.624),
        Color(red: 0.914, green: 0.239, blue: 0.510),
    ]

    public struct Result {
        public let text: String
        public let color: Color
    }

    private static func derive(_ masterKey: String) -> [UInt8]? {
        var output = [UInt8](repeating: 0, count: keyBytes)
        let saltBytes = Array(salt.utf8)

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

        // Plutôt qu'afficher une empreinte fausse, on n'en affiche aucune : un
        // repère erroné serait pire que pas de repère du tout.
        return status == kCCSuccess ? output : nil
    }

    /// Empreinte de la clef, ou `nil` si elle ne peut pas être calculée.
    public static func of(_ masterKey: String) -> Result? {
        guard !masterKey.isEmpty, let raw = derive(masterKey) else { return nil }

        let text = (0..<length)
            .map { alphabet[Int(raw[$0]) % alphabet.count] }
            .reduce(into: "") { $0.append($1) }

        return Result(text: text, color: palette[Int(raw[length]) % palette.count])
    }
}
