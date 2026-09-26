//
//  CredentialProviderViewController.swift
//  thecode-macos-autofill
//
//  Pendant macOS de l'extension AutoFill iOS (`thecode-autofill`).
//  Cycle de vie :
//    1. macOS instancie ce NSViewController et appelle prepareCredentialList(...)
//       ou prepareInterfaceToProvideCredential(...) avec le domaine cible.
//    2. Si une clé est définie : la vue propose les comptes connus du site et
//       un champ identifiant (le système ne donne que l'adresse du site, jamais
//       l'identifiant du formulaire). Au choix, Touch ID, puis le mot de passe
//       est calculé et transmis à macOS avec un identifiant jamais vide.
//    3. Si aucune clé n'est définie : on annule la requête (pour ne jamais
//       laisser le navigateur en attente) et on ouvre l'app principale pour que
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
        preferredContentSize = view.frame.size
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

    /// Si la clé est définie, on laisse choisir le compte. Sinon, on annule la
    /// requête (pour libérer le navigateur) puis on ouvre l'app.
    @MainActor
    private func present(domain: String) {
        guard isKeyDefined() else {
            openHostAppForKeySetup()
            return
        }
        // Rien à dériver sans domaine : on libère le navigateur.
        guard !domain.isEmpty else {
            cancel()
            return
        }
        // Lus une fois : la résolution tourne à chaque frappe.
        let settings = PasswordSettings.load(from: UserDefaults(suiteName: appGroupID))
        let vault = VaultStore.load()
        let charset = Charset(
            lower: settings.minState, upper: settings.majState,
            symbols: settings.symState, numbers: settings.chiState)

        model.domain = domain
        model.accounts = vault.findAll(domain: domain).map(SiteResolution.init(entry:))
        model.resolveLogin = { login, pinned in
            AutofillLogin.resolve(
                login: login, domain: domain, vault: vault, pinned: pinned,
                length: settings.length, charset: charset)
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

    func completeFill(domain: String, fill: AutofillLogin.Fill, saveToVault: Bool) {
        let password = generatePassword(domainName: domain, resolution: fill.resolution)

        // Le mot de passe n'est pas stocké — il se recalcule. Ce qu'on retient,
        // ce sont les réglages qui ont servi, le domaine et l'identifiant : sans
        // eux, un autre appareil ne saurait pas les rejouer.
        if saveToVault, !password.isEmpty {
            rememberAccount(fill.resolution.siteKey, login: fill.user)
        }
        guard !password.isEmpty else {
            // Cas pathologique : clé absente, ou aucun charset coché dans l'app.
            extensionContext.cancelRequest(withError: NSError(
                domain: ASExtensionErrorDomain,
                code: ASExtensionError.failed.rawValue
            ))
            return
        }
        // L'identifiant est rendu au site : le système le remplit s'il trouve
        // un champ pour lui, et ne remplit que le mot de passe sinon.
        //
        // Compte sans identifiant : `user` vaut "". AuthenticationServices
        // n'offre pas de credential « mot de passe seul » pour une requête de
        // mot de passe (`completeRequest(withTextToInsert:)` ne sert qu'au
        // menu « insérer du texte »), d'où la chaîne vide plutôt qu'un
        // identifiant inventé qui serait écrit dans le formulaire. Compromis :
        // on soupçonnait (sans preuve) cet identifiant vide de faire planter
        // Safari sur une page de compte sans champ identifiant ; la feuille de
        // remplissage fonctionne avec, mais ce cas reste à retester.
        let credential = ASPasswordCredential(user: fill.user, password: password)
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

    /// Enregistre le compte (domaine + identifiant) avec les réglages en vigueur.
    private func rememberAccount(_ domain: String, login: String) {
        let settings = PasswordSettings.load(from: UserDefaults(suiteName: appGroupID))
        var vault = VaultStore.load()
        vault.upsert(
            site: domain, login: login, length: settings.length,
            charset: Charset(
                lower: settings.minState, upper: settings.majState,
                symbols: settings.symState, numbers: settings.chiState))
        try? VaultStore.save(vault)
    }

    private func generatePassword(domainName: String, resolution: SiteResolution) -> String {
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

        // Toujours en v2, quelle que soit la version notée dans le carnet : le
        // remplissage ne propose aucun choix, il doit être prévisible. Un site
        // encore en v1 se génère depuis l'application.
        return PasswordUtils()
            .generatePassword(for: resolution, masterKey: encodingKey, forcing: 2).code
    }
}
