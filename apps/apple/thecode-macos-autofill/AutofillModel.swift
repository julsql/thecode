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

    /// Les comptes que le carnet connaît pour ce domaine (vide s'il n'en
    /// connaît aucun). Ceux qui ont un identifiant se remplissent en un geste.
    @Published var accounts: [SiteResolution] = []

    /// Entrée sans identifiant choisie dans la liste : l'identifiant saisi
    /// n'est alors rendu qu'au formulaire, le mot de passe reste le sien.
    @Published var pinned: SiteResolution? = nil

    /// Identifiant saisi, facultatif. Le système ne dit pas celui du
    /// formulaire ; vide, on remplit le compte sans identifiant du site.
    @Published var login: String = ""

    /// Réponse de l'utilisatrice. macOS n'a pas d'équivalent au dialogue que
    /// le système Android pose après coup : on demande avant de remplir.
    @Published var saveToVault = false
    @Published var busy: Bool = false

    /// Ce que le ViewController sait du carnet : de quoi résoudre un
    /// identifiant saisi.
    var resolveLogin: (_ login: String, _ pinned: String?) -> AutofillLogin.Fill? = { _, _ in nil }

    /// Le remplissage correspondant à la saisie (`nil` sans domaine).
    var typedFill: AutofillLogin.Fill? { resolveLogin(login, pinned?.entryId) }

    /// Le compte saisi est inconnu du carnet : on propose de l'enregistrer.
    var canSave: Bool { typedFill?.isNew ?? false }

    /// Le compte en attente d'authentification : gardé ici plutôt que capturé
    /// par le rappel de LocalAuthentication, qui n'est pas sur le fil principal.
    private var pending: (fill: AutofillLogin.Fill, save: Bool)?

    /// Le ViewController s'enregistre ici pour recevoir les ordres d'achever
    /// ou d'annuler la requête.
    weak var controller: CredentialProviderViewController?

    /// Un geste par compte connu : Touch ID puis remplissage. Une entrée sans
    /// identifiant demande d'abord de le saisir.
    func choose(_ account: SiteResolution) {
        if let fill = AutofillLogin.quickFill(account) {
            authenticate(then: fill, save: false)
        } else {
            pinned = account
        }
    }

    /// Remplit avec l'identifiant saisi.
    func fillTyped() {
        guard let fill = typedFill else { return }
        authenticate(then: fill, save: fill.isNew && saveToVault)
    }

    private func authenticate(then fill: AutofillLogin.Fill, save: Bool) {
        guard !busy else { return }
        guard !domain.isEmpty else {
            controller?.cancel()
            return
        }

        busy = true
        pending = (fill, save)

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
                    if let (fill, save) = self.pending {
                        self.controller?.completeFill(
                            domain: self.domain, fill: fill, saveToVault: save)
                    }
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
