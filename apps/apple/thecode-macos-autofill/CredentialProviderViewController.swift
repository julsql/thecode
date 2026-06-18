//
//  CredentialProviderViewController.swift
//  thecode-macos-autofill
//
//  Pendant macOS de l'extension AutoFill iOS (`thecode-autofill`).
//  Cycle de vie :
//    1. macOS instancie ce NSViewController et appelle prepareCredentialList(...)
//       ou prepareInterfaceToProvideCredential(...) avec le domaine cible.
//    2. La vue SwiftUI montre « mot de passe disponible pour {domaine} » —
//       JAMAIS le mot de passe ni la clé. Si aucune clé n'est définie dans
//       l'app, elle affiche un message invitant à la définir.
//    3. AutofillModel déclenche Touch ID. Le mot de passe n'est calculé puis
//       transmis à macOS qu'après authentification réussie.
//

import AuthenticationServices
import AppKit
import SwiftUI

let appGroupID = "group.fr.julsql.thecode.params"

final class CredentialProviderViewController: ASCredentialProviderViewController {

    private let model = AutofillModel()

    override func loadView() {
        // Pas de nib : on fournit une vue conteneur, la vue SwiftUI est
        // ajoutée dans viewDidLoad.
        view = NSView(frame: NSRect(x: 0, y: 0, width: 360, height: 420))
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        model.controller = self

        let host = NSHostingController(rootView: ContentView(model: model))
        addChild(host)
        host.view.frame = view.bounds
        host.view.autoresizingMask = [.width, .height]
        view.addSubview(host.view)
    }

    // MARK: – macOS lifecycle

    /// On refuse systématiquement le remplissage sans interaction : la clé ne
    /// peut servir qu'après authentification de l'utilisateur.
    override func provideCredentialWithoutUserInteraction(
        for credentialIdentity: ASPasswordCredentialIdentity
    ) {
        extensionContext.cancelRequest(withError: NSError(
            domain: ASExtensionErrorDomain,
            code: ASExtensionError.userInteractionRequired.rawValue
        ))
    }

    override func prepareCredentialList(
        for serviceIdentifiers: [ASCredentialServiceIdentifier]
    ) {
        guard let first = serviceIdentifiers.first else { return }
        let domain = DomainNormalizer.normalize(first)
        Task { @MainActor in self.present(domain: domain) }
    }

    override func prepareInterfaceToProvideCredential(
        for credentialIdentity: ASPasswordCredentialIdentity
    ) {
        let domain = DomainNormalizer.normalize(credentialIdentity.serviceIdentifier)
        Task { @MainActor in self.present(domain: domain) }
    }

    /// Décide quoi afficher selon que la clé est définie ou non. Si elle l'est,
    /// on lance directement Touch ID pour éviter une étape inutile ; sinon on
    /// montre un message plutôt que d'enchaîner sur une auth qui ne pourrait
    /// rien remplir.
    @MainActor
    private func present(domain: String) {
        model.domain = domain
        if isKeyDefined() {
            model.startBiometricIfNeeded()
        } else {
            model.keyMissing = true
        }
    }

    // MARK: – Appelé par AutofillModel après auth

    func completeFill(domain: String) {
        let password = generatePassword(domainName: domain)
        guard !password.isEmpty else {
            // Cas pathologique : clé absente ou aucun charset coché dans l'app.
            extensionContext.cancelRequest(withError: NSError(
                domain: ASExtensionErrorDomain,
                code: ASExtensionError.failed.rawValue
            ))
            return
        }
        let credential = ASPasswordCredential(user: "", password: password)
        extensionContext.completeRequest(
            withSelectedCredential: credential,
            completionHandler: nil
        )
    }

    func cancel() {
        extensionContext.cancelRequest(withError: NSError(
            domain: ASExtensionErrorDomain,
            code: ASExtensionError.userCanceled.rawValue
        ))
    }

    // MARK: – Clé partagée

    /// Vrai si une clé a été définie dans l'app (lue depuis l'app group).
    func isKeyDefined() -> Bool {
        let defaults = UserDefaults(suiteName: appGroupID)
        let key = defaults?.string(forKey: "encodingKey") ?? ""
        return !key.isEmpty
    }

    // MARK: – Génération

    private func generatePassword(domainName: String) -> String {
        let defaults = UserDefaults(suiteName: appGroupID)
        let minState     = defaults?.bool(forKey: "minState")     ?? true
        let majState     = defaults?.bool(forKey: "majState")     ?? true
        let symState     = defaults?.bool(forKey: "symState")     ?? true
        let chiState     = defaults?.bool(forKey: "chiState")     ?? true
        let lengthNumber = defaults?.integer(forKey: "lengthNumber") ?? 20
        let encodingKey  = defaults?.string(forKey: "encodingKey")   ?? ""

        if domainName.isEmpty
            || encodingKey.isEmpty
            || (!minState && !majState && !symState && !chiState) {
            return ""
        }

        let utils = PasswordUtils()
        utils.minState = minState
        utils.majState = majState
        utils.symState = symState
        utils.chiState = chiState
        utils.longueur = lengthNumber

        return utils.generatePassword(input: domainName + encodingKey).code
    }
}
