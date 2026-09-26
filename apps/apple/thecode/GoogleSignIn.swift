//
//  GoogleSignIn.swift
//  « Continuer avec Google » : la session web et l'échange du code.
//
//  ASWebAuthenticationSession plutôt qu'un SDK : le navigateur système montre
//  la page de Google (l'app ne voit jamais le mot de passe) et rend la
//  redirection sur le schéma de l'identifiant client inversé. Le calcul pur
//  (PKCE, adresses, lecture des réponses) est dans GoogleAuth.swift.
//
//  Copié dans les deux apps et non dans Shared : l'extension de remplissage,
//  qui compile Shared, n'a ni fenêtre à présenter ni compte à ouvrir.
//
//  Source unique : shared/apple/GoogleSignIn.swift
//

import AuthenticationServices
import Foundation

#if os(iOS)
    import UIKit
#else
    import AppKit
#endif

@MainActor
final class GoogleSignIn: NSObject, ASWebAuthenticationPresentationContextProviding {

    /// Gardée le temps de l'échange : relâchée, la session se fermerait.
    private var session: ASWebAuthenticationSession?

    /// Le jeton d'identité Google de l'utilisateur, ou `GoogleAuthError.cancelled`
    /// s'il a fermé la fenêtre.
    static func idToken(using auth: GoogleAuth) async throws -> String {
        try await GoogleSignIn().run(auth)
    }

    /// Le message à montrer pour un échec ; `nil` pour une annulation, qui
    /// n'en mérite pas.
    static func message(for error: Error) -> String? {
        switch error as? GoogleAuthError {
        case .cancelled:
            return nil
        case .stateMismatch, .missingCode, .missingIdToken:
            return L10n.t(
                "Connexion Google échouée : réponse inattendue de Google.",
                "Google sign-in failed: unexpected response from Google.")
        case .provider(let detail):
            return L10n.t(
                "Connexion Google refusée : \(detail)", "Google sign-in refused: \(detail)")
        case nil:
            return L10n.t(
                "Connexion Google impossible : \(error.localizedDescription)",
                "Google sign-in unavailable: \(error.localizedDescription)")
        }
    }

    private func run(_ auth: GoogleAuth) async throws -> String {
        let state = GoogleAuth.makeState()
        let verifier = GoogleAuth.makeVerifier()
        let url = auth.authorizationURL(state: state, verifier: verifier)

        let callback: URL = try await withCheckedThrowingContinuation {
            (continuation: CheckedContinuation<URL, Error>) in
            let session = ASWebAuthenticationSession(
                url: url, callbackURLScheme: auth.callbackScheme
            ) { @Sendable callback, error in
                if let callback {
                    continuation.resume(returning: callback)
                } else if let error = error as? ASWebAuthenticationSessionError,
                    error.code == .canceledLogin
                {
                    continuation.resume(throwing: GoogleAuthError.cancelled)
                } else {
                    continuation.resume(throwing: error ?? GoogleAuthError.missingCode)
                }
            }
            session.presentationContextProvider = self
            self.session = session
            if !session.start() {
                continuation.resume(
                    throwing: GoogleAuthError.provider(
                        L10n.t("fenêtre de connexion indisponible", "sign-in window unavailable")))
            }
        }
        session = nil

        let code = try GoogleAuth.code(from: callback, expectedState: state)

        var request = URLRequest(url: URL(string: GoogleAuth.tokenURL)!)
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = auth.tokenRequestBody(code: code, verifier: verifier)

        let (data, _) = try await URLSession.shared.data(for: request)
        // Le corps dit l'erreur, même sur un 400 : on le lit dans tous les cas.
        return try GoogleAuth.idToken(fromTokenResponse: data)
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        #if os(iOS)
            let windows = UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap(\.windows)
            return windows.first(where: \.isKeyWindow) ?? windows.first ?? ASPresentationAnchor()
        #else
            return NSApp.keyWindow ?? NSApp.windows.first ?? ASPresentationAnchor()
        #endif
    }
}
