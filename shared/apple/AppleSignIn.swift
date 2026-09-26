//
//  AppleSignIn.swift
//  « Se connecter avec Apple » : le bouton du système et sa réponse.
//
//  Le bouton est celui d'AuthenticationServices (exigé par Apple, au moins
//  aussi visible que « Continuer avec Google »). Le calcul pur (nonce, corps
//  de l'appel, lecture de /v1/auth/registration) est dans AppleAuth.swift.
//
//  Copié dans les deux apps et non dans Shared : l'extension de remplissage,
//  qui compile Shared, n'a ni fenêtre à présenter ni compte à ouvrir.
//
//  Source unique : shared/apple/AppleSignIn.swift
//

import AuthenticationServices
import SwiftUI

/// Ce que la feuille d'Apple rend, à envoyer tel quel à l'API.
struct AppleSignInResult {
    let identityToken: String
    let rawNonce: String
    /// Vide quand Apple n'en rend pas : la connexion n'en dépend pas.
    let authorizationCode: String
}

/// Le bouton « Se connecter avec Apple », qui rend le jeton d'identité, le
/// nonce brut et le code d'autorisation à envoyer à l'API. Une annulation ne
/// rend rien.
struct AppleSignInButton: View {

    /// Appelé avec ce que la feuille a rendu, ou avec l'erreur.
    let onCompletion: (Result<AppleSignInResult, Error>) -> Void

    @Environment(\.colorScheme) private var colorScheme
    /// Tiré à chaque demande : un nonce ne sert qu'une fois.
    @State private var rawNonce = ""

    var body: some View {
        SignInWithAppleButton(
            .continue,
            onRequest: { request in
                rawNonce = AppleAuth.makeRawNonce()
                request.requestedScopes = [.email]
                request.nonce = AppleAuth.hashedNonce(rawNonce)
            },
            onCompletion: { result in
                let nonce = rawNonce
                rawNonce = ""
                onCompletion(
                    Result {
                        AppleSignInResult(
                            identityToken: try AppleSignIn.identityToken(from: result),
                            rawNonce: nonce,
                            authorizationCode: AppleSignIn.authorizationCode(from: result))
                    })
            }
        )
        .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
        // Recréé au changement de thème : le style n'est lu qu'à la création.
        .id(colorScheme)
    }
}

enum AppleSignIn {

    /// Le jeton d'identité porté par l'autorisation.
    static func identityToken(from result: Result<ASAuthorization, Error>) throws -> String {
        switch result {
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential
            else { throw AppleAuthError.missingIdentityToken }
            return try AppleAuth.identityToken(from: credential.identityToken)
        case .failure(let error as ASAuthorizationError) where error.code == .canceled:
            throw AppleAuthError.cancelled
        case .failure(let error as ASAuthorizationError):
            throw AppleAuthError.provider(error.localizedDescription)
        case .failure(let error):
            throw error
        }
    }

    /// Le code d'autorisation porté par l'autorisation, vide sinon.
    static func authorizationCode(from result: Result<ASAuthorization, Error>) -> String {
        guard case .success(let authorization) = result,
            let credential = authorization.credential as? ASAuthorizationAppleIDCredential
        else { return "" }
        return AppleAuth.authorizationCode(from: credential.authorizationCode)
    }

    /// Le message à montrer pour un échec ; `nil` pour une annulation, qui
    /// n'en mérite pas.
    static func message(for error: Error) -> String? {
        switch error as? AppleAuthError {
        case .cancelled:
            return nil
        case .missingIdentityToken:
            return L10n.t(
                "Connexion Apple échouée : réponse inattendue d'Apple.",
                "Apple sign-in failed: unexpected response from Apple.")
        case .provider(let detail):
            return L10n.t(
                "Connexion Apple refusée : \(detail)", "Apple sign-in refused: \(detail)")
        case nil:
            return L10n.t(
                "Connexion Apple impossible : \(error.localizedDescription)",
                "Apple sign-in unavailable: \(error.localizedDescription)")
        }
    }
}
