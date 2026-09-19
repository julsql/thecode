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
        let accounts = resolutions(for: domain)
        Task { @MainActor in
            model.domain = domain
            model.accounts = accounts
            // Une entrée sans identifiant est un repli, pas une entrée connue.
            model.canSave = accounts.first?.entryId.isEmpty ?? false
            model.startBiometricIfNeeded()
        }
    }

    /// L'utilisateur a déjà choisi notre proposition (chemin direct depuis
    /// la barre QuickType). Même flux que ci-dessus : auth puis remplissage.
    override func prepareInterfaceToProvideCredential(
        for credentialIdentity: ASPasswordCredentialIdentity
    ) {
        let domain = DomainNormalizer.normalize(credentialIdentity.serviceIdentifier)
        let accounts = resolutions(for: domain)
        Task { @MainActor in
            model.domain = domain
            model.accounts = accounts
            // Une entrée sans identifiant est un repli, pas une entrée connue.
            model.canSave = accounts.first?.entryId.isEmpty ?? false
            model.startBiometricIfNeeded()
        }
    }

    // MARK: – Appelé par AutofillModel après auth

    func completeFill(domain: String, resolution: SiteResolution?, saveToVault: Bool) {
        let password = generatePassword(domainName: domain, resolution: resolution)

        // Le mot de passe n'est pas stocké — il se recalcule. Ce qu'on retient,
        // ce sont les réglages qui ont servi et le domaine : sans eux, un autre
        // appareil ne saurait pas les rejouer.
        if saveToVault, !password.isEmpty {
            rememberSite(domain)
        }
        guard !password.isEmpty else {
            // Cas pathologique : clé absente ou aucun charset coché dans l'app.
            extensionContext.cancelRequest(withError: NSError(
                domain: ASExtensionErrorDomain,
                code: ASExtensionError.failed.rawValue
            ))
            return
        }
        // Le login est rendu au site quand le carnet le connaît : il fait
        // partie de ce qu'on ne devait plus avoir à retenir.
        let credential = ASPasswordCredential(
            user: resolution?.login ?? "", password: password)
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

    /// Enregistre le site avec les réglages en vigueur.
    private func rememberSite(_ domain: String) {
        let settings = PasswordSettings.load(from: UserDefaults(suiteName: appGroupID))
        var vault = VaultStore.load()
        vault.upsert(
            site: domain, length: settings.length,
            charset: Charset(
                lower: settings.minState, upper: settings.majState,
                symbols: settings.symState, numbers: settings.chiState))
        try? VaultStore.save(vault)
    }

    /// Ce que le carnet sait de ce domaine, réglages généraux en repli.
    private func resolutions(for domain: String) -> [SiteResolution] {
        let settings = PasswordSettings.load(from: UserDefaults(suiteName: appGroupID))
        return SiteResolution.forDomain(
            domain, in: VaultStore.load(), length: settings.length,
            charset: Charset(
                lower: settings.minState, upper: settings.majState,
                symbols: settings.symState, numbers: settings.chiState))
    }

    private func generatePassword(domainName: String, resolution: SiteResolution?) -> String {
        let defaults = UserDefaults(suiteName: appGroupID)
        // Lecture centralisée (cf. PasswordSettings) : une clé jamais écrite
        // prend sa valeur par défaut. Avant, `integer(forKey:)` renvoyait 0
        // pour une longueur absente — et `?? 20` ne s'appliquait jamais, car
        // `integer(forKey:)` ne renvoie pas nil.
        let settings = PasswordSettings.load(from: defaults)
        // Trousseau et non UserDefaults : la clef ouvre tous les comptes, et
        // le conteneur de l'app group la gardait en clair.
        let encodingKey = SecureKeyStore.read()

        if domainName.isEmpty || encodingKey.isEmpty || !settings.hasCharset {
            return ""
        }

        // Le carnet dit sous quelle clef dériver, avec quels réglages et en
        // quelle version. Sans lui, on prenait le domaine tel quel avec les
        // réglages généraux, et les trois problèmes d'usage restaient entiers
        // dans ce chemin-là.
        let chosen =
            resolution
            ?? SiteResolution(
                fallbackFor: domainName, length: settings.length,
                charset: Charset(
                    lower: settings.minState, upper: settings.majState,
                    symbols: settings.symState, numbers: settings.chiState))

        return PasswordUtils().generatePassword(for: chosen, masterKey: encodingKey).code
    }
}
