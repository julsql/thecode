//
//  CredentialProviderViewController.swift
//  thecode-autofill
//
//  Cycle de vie de l'extension AutoFill :
//    1. iOS instancie ce ViewController et appelle prepareCredentialList(...)
//       ou prepareInterfaceToProvideCredential(...) avec le domaine cible.
//    2. La vue SwiftUI montre « mot de passe disponible pour {domaine} »
//       — JAMAIS le mot de passe ni la clé.
//    3. AutofillModel déclenche Face ID / Touch ID. Le mot de passe n'est
//       calculé puis transmis à iOS qu'après authentification réussie.
//

import AuthenticationServices
import SwiftUI

let appGroupID = "group.fr.julsql.thecode.params"

final class CredentialProviderViewController: ASCredentialProviderViewController {

    private let model = AutofillModel()

    override func viewDidLoad() {
        super.viewDidLoad()
        model.controller = self

        let host = UIHostingController(rootView: ContentView(model: model))
        addChild(host)
        host.view.frame = view.bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(host.view)
        host.didMove(toParent: self)
    }

    // MARK: – iOS lifecycle

    /// On refuse systématiquement le remplissage sans interaction : la clé
    /// ne peut servir qu'après authentification biométrique de l'utilisateur.
    override func provideCredentialWithoutUserInteraction(
        for credentialIdentity: ASPasswordCredentialIdentity
    ) {
        extensionContext.cancelRequest(withError: NSError(
            domain: ASExtensionErrorDomain,
            code: ASExtensionError.userInteractionRequired.rawValue
        ))
    }

    /// L'utilisateur a demandé à voir nos suggestions. On extrait le domaine
    /// de la première identité de service et on déclenche la biométrie.
    override func prepareCredentialList(
        for serviceIdentifiers: [ASCredentialServiceIdentifier]
    ) {
        guard let first = serviceIdentifiers.first else { return }
        let domain = DomainNormalizer.normalize(first)
        Task { @MainActor in
            model.domain = domain
            model.startBiometricIfNeeded()
        }
    }

    /// L'utilisateur a déjà choisi notre proposition (chemin direct depuis
    /// la barre QuickType). Même flux que ci-dessus : auth puis remplissage.
    override func prepareInterfaceToProvideCredential(
        for credentialIdentity: ASPasswordCredentialIdentity
    ) {
        let domain = DomainNormalizer.normalize(credentialIdentity.serviceIdentifier)
        Task { @MainActor in
            model.domain = domain
            model.startBiometricIfNeeded()
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
