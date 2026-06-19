//
//  AutofillModel.swift
//  thecode-macos-autofill
//
//  État partagé entre la vue SwiftUI et le NSViewController. La clé n'est
//  jamais exposée à l'UI : le modèle déclenche l'auth Touch ID, puis prévient
//  le ViewController d'aller chercher la clé et de remplir le credential.
//
//  Règle clé : toute voie qui ne mène pas à `completeFill` doit annuler la
//  requête (`controller?.cancel()`). Sinon l'extension ne répond jamais et le
//  navigateur reste figé — notamment si l'utilisateur annule le prompt Touch ID.
//

import Foundation
import LocalAuthentication
import Combine

@MainActor
final class AutofillModel: ObservableObject {

    @Published var domain: String = ""
    @Published var busy: Bool = false

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
            controller?.cancel()
            return
        }

        busy = true

        let ctx = LAContext()
        var nsError: NSError?
        // .deviceOwnerAuthentication accepte Touch ID ET le mot de passe de
        // session en fallback.
        guard ctx.canEvaluatePolicy(.deviceOwnerAuthentication, error: &nsError) else {
            busy = false
            controller?.cancel()
            return
        }

        ctx.evaluatePolicy(
            .deviceOwnerAuthentication,
            localizedReason: L10n.t("Confirmez pour autoriser TheCode à utiliser votre clé",
                                    "Confirm to allow TheCode to use your key")
        ) { [weak self] success, _ in
            DispatchQueue.main.async {
                guard let self else { return }
                self.busy = false
                if success {
                    // Seul moment où la clé est consommée : à l'intérieur de
                    // completeFill, dans l'extension, après auth.
                    self.controller?.completeFill(domain: self.domain)
                } else {
                    // Annulation / échec de l'auth : on annule la requête pour
                    // ne pas laisser le navigateur en attente.
                    self.controller?.cancel()
                }
            }
        }
    }

    func cancel() {
        controller?.cancel()
    }
}
