//
//  AutofillModel.swift
//  thecode-autofill
//
//  État partagé entre la vue SwiftUI et le ViewController. La clé n'est
//  jamais exposée à l'UI : la vue demande au modèle de déclencher l'auth
//  biométrique, et le modèle prévient le ViewController d'aller chercher
//  la clé puis de remplir le credential.
//

import Foundation
import LocalAuthentication
import Combine

@MainActor
final class AutofillModel: ObservableObject {

    @Published var domain: String = ""
    @Published var busy: Bool = false
    @Published var errorMessage: String? = nil

    /// Le ViewController s'enregistre ici pour recevoir les ordres d'achever
    /// ou d'annuler la requête.
    weak var controller: CredentialProviderViewController?

    /// On évite de relancer plusieurs fois la biométrie de manière automatique.
    private var didAutoStart = false

    /// Appelé quand le domaine est connu : on lance immédiatement Face ID /
    /// Touch ID pour éviter une étape inutile.
    func startBiometricIfNeeded() {
        guard !didAutoStart, !domain.isEmpty else { return }
        didAutoStart = true
        startBiometric()
    }

    func startBiometric() {
        guard !busy else { return }
        guard !domain.isEmpty else {
            errorMessage = "Aucun domaine détecté pour cette requête."
            return
        }

        busy = true
        errorMessage = nil

        let ctx = LAContext()
        var nsError: NSError?
        // .deviceOwnerAuthentication accepte biométrie ET code de
        // déverrouillage en fallback : équivalent UX au Face ID seul.
        guard ctx.canEvaluatePolicy(.deviceOwnerAuthentication, error: &nsError) else {
            busy = false
            errorMessage = "Aucune méthode d'authentification n'est configurée sur l'appareil."
            return
        }

        ctx.evaluatePolicy(
            .deviceOwnerAuthentication,
            localizedReason: "Confirmez pour autoriser TheCode à utiliser votre clé"
        ) { [weak self] success, evalError in
            DispatchQueue.main.async {
                guard let self else { return }
                self.busy = false
                if success {
                    // Seul moment où la clé est consommée : à l'intérieur
                    // de completeFill, dans l'extension, après auth.
                    self.controller?.completeFill(domain: self.domain)
                } else {
                    self.errorMessage = evalError?.localizedDescription
                        ?? "Authentification annulée."
                }
            }
        }
    }

    func cancel() {
        controller?.cancel()
    }
}

