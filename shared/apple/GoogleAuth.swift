//
//  GoogleAuth.swift
//  « Continuer avec Google » : la partie sans effet de bord.
//
//  Flux d'application installée (OAuth 2.0, code d'autorisation + PKCE), sans
//  secret client et sans SDK tiers : le navigateur système montre la page de
//  Google, rend un code, échangé ici contre un jeton d'identité que l'API
//  vérifie elle-même. Tout ce qui se calcule sans réseau ni fenêtre vit ici
//  pour être testé ; la session web vit dans GoogleSignIn.swift, côté app.
//
//  Source unique : shared/apple/GoogleAuth.swift
//

import CryptoKit
import Foundation

/// Ce qui peut faire échouer la connexion Google avant l'appel à l'API.
public enum GoogleAuthError: Error, Equatable {
    /// Fenêtre fermée ou accès refusé : rien à signaler à l'utilisateur.
    case cancelled
    /// Le `state` rendu n'est pas celui envoyé : réponse forgée ou croisée.
    case stateMismatch
    /// Redirection sans code ni erreur lisible.
    case missingCode
    /// Erreur rapportée par Google (paramètre `error` ou corps de l'échange).
    case provider(String)
    /// Réponse de l'échange sans jeton d'identité.
    case missingIdToken
}

public struct GoogleAuth {

    public static let authorizeURL = "https://accounts.google.com/o/oauth2/v2/auth"
    public static let tokenURL = "https://oauth2.googleapis.com/token"
    public static let scope = "openid email"
    /// Clef d'Info.plist qui porte l'identifiant client de type iOS.
    public static let infoPlistKey = "GoogleIOSClientID"

    public let clientID: String

    public init(clientID: String) {
        self.clientID = clientID
    }

    /// L'identifiant client lu dans l'Info.plist ; `nil` s'il n'est pas
    /// configuré, auquel cas le bouton ne s'affiche pas.
    ///
    /// Une variable de build non résolue (« $(…) ») compte comme absente.
    public static func configured(in bundle: Bundle = .main) -> GoogleAuth? {
        let raw = (bundle.object(forInfoDictionaryKey: infoPlistKey) as? String ?? "")
            .trimmingCharacters(in: .whitespaces)
        guard !raw.isEmpty, !raw.hasPrefix("$(") else { return nil }
        return GoogleAuth(clientID: raw)
    }

    // MARK: - Redirection

    /// L'identifiant client à l'envers : le schéma que Google accepte pour un
    /// client iOS (« 123-abc.apps.googleusercontent.com » donne
    /// « com.googleusercontent.apps.123-abc »).
    public var callbackScheme: String {
        clientID.split(separator: ".").reversed().joined(separator: ".")
    }

    public var redirectURI: String { "\(callbackScheme):/oauth2redirect" }

    // MARK: - PKCE

    /// Vérificateur PKCE : 32 octets aléatoires, 43 caractères base64url.
    public static func makeVerifier() -> String { randomToken(bytes: 32) }

    /// Jeton opaque pour `state`.
    public static func makeState() -> String { randomToken(bytes: 16) }

    /// Défi S256 : base64url, sans remplissage, du SHA-256 du vérificateur.
    public static func challenge(for verifier: String) -> String {
        Base64URL.encode(Data(SHA256.hash(data: Data(verifier.utf8))))
    }

    private static func randomToken(bytes count: Int) -> String {
        var generator = SystemRandomNumberGenerator()
        let bytes = (0..<count).map { _ in UInt8.random(in: .min ... .max, using: &generator) }
        return Base64URL.encode(Data(bytes))
    }

    // MARK: - Étapes

    /// L'adresse de la page de consentement.
    public func authorizationURL(state: String, verifier: String) -> URL {
        var components = URLComponents(string: Self.authorizeURL)!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: clientID),
            URLQueryItem(name: "redirect_uri", value: redirectURI),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: Self.scope),
            URLQueryItem(name: "code_challenge", value: Self.challenge(for: verifier)),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "state", value: state),
            // Sans cela, un compte déjà ouvert dans le navigateur est pris
            // d'office : impossible de choisir celui du carnet.
            URLQueryItem(name: "prompt", value: "select_account"),
        ]
        return components.url!
    }

    /// Le code d'autorisation porté par la redirection, après contrôle du
    /// `state`.
    public static func code(from callback: URL, expectedState: String) throws -> String {
        let items = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems ?? []
        func value(_ name: String) -> String? {
            items.first { $0.name == name }?.value
        }

        // Le state d'abord : une erreur non sollicitée ne doit pas passer
        // pour une annulation.
        guard value("state") == expectedState else { throw GoogleAuthError.stateMismatch }
        if let error = value("error") {
            throw error == "access_denied"
                ? GoogleAuthError.cancelled : GoogleAuthError.provider(error)
        }
        guard let code = value("code"), !code.isEmpty else { throw GoogleAuthError.missingCode }
        return code
    }

    /// Corps (x-www-form-urlencoded) de l'échange du code. Pas de secret
    /// client : un client iOS n'en a pas, PKCE en tient lieu.
    public func tokenRequestBody(code: String, verifier: String) -> Data {
        let fields = [
            ("client_id", clientID),
            ("code", code),
            ("code_verifier", verifier),
            ("grant_type", "authorization_code"),
            ("redirect_uri", redirectURI),
        ]
        return Data(fields.map { "\($0)=\(Self.formEncode($1))" }.joined(separator: "&").utf8)
    }

    /// Le jeton d'identité rendu par l'échange.
    public static func idToken(fromTokenResponse data: Data) throws -> String {
        let body = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        if let token = body["id_token"] as? String, !token.isEmpty { return token }
        if let error = body["error"] as? String {
            let detail = body["error_description"] as? String
            throw GoogleAuthError.provider(detail.map { "\(error): \($0)" } ?? error)
        }
        throw GoogleAuthError.missingIdToken
    }

    /// Corps de POST /v1/auth/google. Le code d'invitation n'est envoyé que
    /// s'il y en a un : l'API le demande seulement à la création d'un compte.
    public static func apiBody(
        idToken: String, lang: String, deviceLabel: String = "", inviteCode: String = ""
    ) -> [String: Any] {
        var body: [String: Any] = ["id_token": idToken, "lang": lang]
        if !deviceLabel.isEmpty { body["device_label"] = deviceLabel }
        if !inviteCode.isEmpty { body["invite_code"] = inviteCode }
        return body
    }

    private static func formEncode(_ value: String) -> String {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }
}
