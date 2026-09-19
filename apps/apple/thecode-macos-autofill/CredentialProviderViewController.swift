//
//  CredentialProviderViewController.swift
//  thecode-macos-autofill
//
//  Pendant macOS de l'extension AutoFill iOS (`thecode-autofill`).
//  Cycle de vie :
//    1. macOS instancie ce NSViewController et appelle prepareCredentialList(...)
//       ou prepareInterfaceToProvideCredential(...) avec le domaine cible.
//    2. Si une clé est définie : AutofillModel déclenche Touch ID, puis le mot
//       de passe est calculé et transmis à macOS après authentification.
//    3. Si aucune clé n'est définie : contrairement à iOS, macOS ne présente
//       pas l'UI custom de l'extension dans le flux Safari (la requête resterait
//       sans réponse et figerait le navigateur). On annule donc la requête
//       (pour libérer le navigateur) et on ouvre l'app principale pour que
//       l'utilisateur y définisse sa clé.
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
        let domain: String
        if let first = serviceIdentifiers.first {
            domain = DomainNormalizer.normalize(first)
        } else {
            domain = ""
        }
        Task { @MainActor in self.present(domain: domain) }
    }

    override func prepareInterfaceToProvideCredential(
        for credentialIdentity: ASPasswordCredentialIdentity
    ) {
        let domain = DomainNormalizer.normalize(credentialIdentity.serviceIdentifier)
        Task { @MainActor in self.present(domain: domain) }
    }

    /// Si la clé est définie, on lance directement Touch ID. Sinon, on annule la
    /// requête (pour libérer le navigateur) puis on ouvre l'app.
    @MainActor
    private func present(domain: String) {
        model.domain = domain
        model.accounts = resolutions(for: domain)
        // Une entrée sans identifiant est un repli, pas une entrée connue.
        model.canSave = model.accounts.first?.entryId.isEmpty ?? false
        if isKeyDefined() {
            model.startBiometricIfNeeded()
        } else {
            openHostAppForKeySetup()
        }
    }

    /// Annule d'abord la requête — pour ne JAMAIS laisser le navigateur en
    /// attente, quelle que soit la suite — puis ouvre l'app (best-effort) afin
    /// que l'utilisateur définisse sa clé.
    private func openHostAppForKeySetup() {
        cancel()
        if let url = URL(string: "thecode://set-key") {
            NSWorkspace.shared.open(url)
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

    // MARK: – Clé partagée

    /// Vrai si une clé a été définie dans l'app.
    func isKeyDefined() -> Bool {
        !SecureKeyStore.read().isEmpty
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
