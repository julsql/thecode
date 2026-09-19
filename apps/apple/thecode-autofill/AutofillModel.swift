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

    /// Les comptes que le carnet connaît pour ce domaine.
    ///
    /// Plusieurs entrées, c'est plusieurs comptes sur le même site : on les
    /// propose tous plutôt que d'en choisir un au hasard — c'était le premier
    /// des problèmes d'usage. Une seule entrée, ou aucune, et il n'y a rien à
    /// choisir.
    @Published var accounts: [SiteResolution] = []
    @Published var chosen: SiteResolution? = nil

    /// Vrai quand le carnet ne connaît pas encore ce site : c'est le seul cas
    /// où proposer de l'enregistrer apporte quelque chose.
    @Published var canSave = false
    /// Réponse de l'utilisatrice. iOS n'a pas d'équivalent au dialogue que le
    /// système Android pose après coup : on demande donc avant de remplir.
    @Published var saveToVault = false

    var mustChoose: Bool { accounts.count > 1 && chosen == nil }

    /// Le ViewController s'enregistre ici pour recevoir les ordres d'achever
    /// ou d'annuler la requête.
    weak var controller: CredentialProviderViewController?

    /// On évite de relancer plusieurs fois la biométrie de manière automatique.
    private var didAutoStart = false

    /// Appelé quand le domaine est connu : on lance immédiatement Face ID /
    /// Touch ID pour éviter une étape inutile.
    ///
    /// Sauf s'il y a un choix à faire : demander la biométrie avant de savoir
    /// quel compte remplir obligerait à la redemander après.
    func startBiometricIfNeeded() {
        guard !didAutoStart, !domain.isEmpty, !mustChoose else { return }
        didAutoStart = true
        startBiometric()
    }

    func choose(_ account: SiteResolution) {
        chosen = account
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
        // .deviceOwnerAuthentication accepte biométrie ET code de
        // déverrouillage en fallback : équivalent UX au Face ID seul.
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
                    // Seul moment où la clé est consommée : à l'intérieur
                    // de completeFill, dans l'extension, après auth.
                    self.controller?.completeFill(
                        domain: self.domain,
                        resolution: self.chosen ?? self.accounts.first,
                        saveToVault: self.canSave && self.saveToVault)
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

