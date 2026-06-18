//
//  AutofillModel.swift
//  thecode-macos-autofill
//
//  État partagé entre la vue SwiftUI et le NSViewController. La clé n'est
//  jamais exposée à l'UI : la vue demande au modèle de déclencher l'auth
//  Touch ID, et le modèle prévient le ViewController d'aller chercher la clé
//  puis de remplir le credential.
//

import Foundation
import LocalAuthentication
import Combine

@MainActor
final class AutofillModel: ObservableObject {

    @Published var domain: String = ""
    @Published var busy: Bool = false
    @Published var errorMessage: String? = nil

    /// Vrai quand aucune clé n'a été définie dans l'app : la vue affiche alors
    /// un message d'invite au lieu du bouton d'authentification.
    @Published var keyMissing: Bool = false

    /// Le ViewController s'enregistre ici pour recevoir les ordres d'achever
    /// ou d'annuler la requête.
    weak var controller: CredentialProviderViewController?

    /// On évite de relancer plusieurs fois la biométrie de manière automatique.
    private var didAutoStart = false

    /// Appelé quand le domaine est connu : on lance immédiatement Touch ID
    /// pour éviter une étape inutile.
    func startBiometricIfNeeded() {
        guard !didAutoStart, !domain.isEmpty else { return }
        didAutoStart = true
        startBiometric()
    }

    func startBiometric() {
        guard !busy else { return }
        guard !domain.isEmpty else {
            errorMessage = L10n.t("Aucun domaine détecté pour cette requête.",
                                  "No domain detected for this request.")
            return
        }

        busy = true
        errorMessage = nil

        let ctx = LAContext()
        var nsError: NSError?
        // .deviceOwnerAuthentication accepte Touch ID ET le mot de passe de
        // session en fallback.
        guard ctx.canEvaluatePolicy(.deviceOwnerAuthentication, error: &nsError) else {
            busy = false
            errorMessage = L10n.t("Aucune méthode d'authentification n'est configurée sur l'appareil.",
                                  "No authentication method is set up on this device.")
            return
        }

        ctx.evaluatePolicy(
            .deviceOwnerAuthentication,
            localizedReason: L10n.t("Confirmez pour autoriser TheCode à utiliser votre clé",
                                    "Confirm to allow TheCode to use your key")
        ) { [weak self] success, evalError in
            DispatchQueue.main.async {
                guard let self else { return }
                self.busy = false
                if success {
                    // Seul moment où la clé est consommée : à l'intérieur de
                    // completeFill, dans l'extension, après auth.
                    self.controller?.completeFill(domain: self.domain)
                } else {
                    self.errorMessage = evalError?.localizedDescription
                        ?? L10n.t("Authentification annulée.", "Authentication cancelled.")
                }
            }
        }
    }

    func cancel() {
        controller?.cancel()
    }
}
