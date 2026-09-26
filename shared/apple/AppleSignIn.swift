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

/// Le bouton « Se connecter avec Apple », qui rend le jeton d'identité et le
/// nonce brut à envoyer à l'API. Une annulation ne rend rien.
struct AppleSignInButton: View {

    /// Appelé avec le jeton et le nonce brut, ou avec l'erreur.
    let onCompletion: (Result<(identityToken: String, rawNonce: String), Error>) -> Void

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
                        (identityToken: try AppleSignIn.identityToken(from: result), rawNonce: nonce)
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
