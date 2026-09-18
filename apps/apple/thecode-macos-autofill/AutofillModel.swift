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

    /// Les comptes que le carnet connaît pour ce domaine.
    ///
    /// Plusieurs entrées, c'est plusieurs comptes sur le même site : on les
    /// propose tous plutôt que d'en choisir un au hasard.
    @Published var accounts: [SiteResolution] = []
    @Published var chosen: SiteResolution? = nil

    var mustChoose: Bool { accounts.count > 1 && chosen == nil }
    @Published var busy: Bool = false

    /// Le ViewController s'enregistre ici pour recevoir les ordres d'achever
    /// ou d'annuler la requête.
    weak var controller: CredentialProviderViewController?

    /// On évite de relancer plusieurs fois la biométrie de manière automatique.
    private var didAutoStart = false

    func choose(_ account: SiteResolution) {
        chosen = account
        startBiometric()
    }

    /// Appelé quand le domaine est connu : on lance immédiatement Touch ID
    /// pour éviter une étape inutile.
    ///
    /// Sauf s'il y a un choix à faire : demander la biométrie avant de savoir
    /// quel compte remplir obligerait à la redemander après.
    func startBiometricIfNeeded() {
        guard !didAutoStart, !domain.isEmpty, !mustChoose else { return }
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
                    self.controller?.completeFill(
                        domain: self.domain,
                        resolution: self.chosen ?? self.accounts.first)
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
