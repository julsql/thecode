//
//  AppleAuth.swift
//  « Se connecter avec Apple » : la partie sans effet de bord.
//
//  Le système montre la feuille d'Apple et rend un jeton d'identité (JWT)
//  que l'API vérifie elle-même. Le nonce brut reste sur l'appareil jusqu'à
//  l'appel à l'API : Apple n'en voit que l'empreinte, l'API la recalcule et
//  la compare à celle du jeton, ce qui empêche de rejouer un jeton volé.
//  La feuille d'Apple vit dans AppleSignIn.swift, côté app.
//
//  Source unique : shared/apple/AppleAuth.swift
//

import CryptoKit
import Foundation

/// Ce qui peut faire échouer la connexion Apple avant l'appel à l'API.
public enum AppleAuthError: Error, Equatable {
    /// Feuille fermée : rien à signaler à l'utilisateur.
    case cancelled
    /// Autorisation sans jeton d'identité lisible.
    case missingIdentityToken
    /// Échec rapporté par le système.
    case provider(String)
}

public enum AppleAuth {

    /// Nonce brut : 32 octets aléatoires, 43 caractères base64url.
    public static func makeRawNonce() -> String {
        var generator = SystemRandomNumberGenerator()
        let bytes = (0..<32).map { _ in UInt8.random(in: .min ... .max, using: &generator) }
        return Base64URL.encode(Data(bytes))
    }

    /// Ce qu'on confie à Apple (`request.nonce`) : le SHA-256 du nonce brut,
    /// en hexadécimal minuscule. Apple le recopie tel quel dans le jeton.
    public static func hashedNonce(_ rawNonce: String) -> String {
        SHA256.hash(data: Data(rawNonce.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    /// Le jeton d'identité, rendu par le système en octets UTF-8.
    public static func identityToken(from data: Data?) throws -> String {
        guard let data, let token = String(data: data, encoding: .utf8), !token.isEmpty else {
            throw AppleAuthError.missingIdentityToken
        }
        return token
    }

    /// Corps de POST /v1/auth/apple : le nonce part *brut*, l'API le hache.
    public static func apiBody(
        identityToken: String, rawNonce: String, lang: String, deviceLabel: String = ""
    ) -> [String: Any] {
        var body: [String: Any] = [
            "identity_token": identityToken, "nonce": rawNonce, "lang": lang,
        ]
        if !deviceLabel.isEmpty { body["device_label"] = deviceLabel }
        return body
    }

    /// Vrai seulement si GET /v1/auth/registration dit `appleEnabled: true`.
    /// Absent, nombre, chaîne ou corps illisible : bouton caché.
    public static func isEnabled(registration body: [String: Any]) -> Bool {
        guard let value = body["appleEnabled"] as? NSNumber,
            CFGetTypeID(value) == CFBooleanGetTypeID()
        else { return false }
        return value.boolValue
    }
}
