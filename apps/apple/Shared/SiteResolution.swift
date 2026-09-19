//
//  SiteResolution.swift
//  Ce qu'il faut pour générer un mot de passe pour un domaine donné.
//
//  Le carnet répond à trois questions qu'un domaine seul ne suffit pas à
//  trancher : sous quelle clef dériver (un même compte peut couvrir google.com
//  et google.fr), avec quels réglages (on ne les retient pas de tête), et pour
//  lequel des comptes du site.
//
//  Quand le carnet ne connaît pas le domaine, on retombe sur les réglages
//  généraux et le domaine tel quel — c'est le comportement d'avant le carnet,
//  et il doit rester identique au caractère près.
//
//  Source unique : shared/apple/SiteResolution.swift
//

import Foundation

public struct SiteResolution: Equatable, Identifiable {

    /// Identifiant de l'entrée, vide quand le carnet ne connaît pas le site.
    public let entryId: String
    /// Ce qui s'affiche quand plusieurs comptes existent pour un même site.
    public let label: String

    public let siteKey: String
    public let login: String
    public let counter: Int
    public let v: Int

    public let length: Int
    public let charset: Charset

    public var id: String { entryId.isEmpty ? siteKey : entryId }

    public init(entry: VaultEntry) {
        var label = entry.label.flatMap { $0.isEmpty ? nil : $0 } ?? entry.siteKey
        if let login = entry.login, !login.isEmpty {
            label += " · \(login)"
        }

        self.entryId = entry.id
        self.label = label
        self.siteKey = entry.siteKey
        self.login = entry.login ?? ""
        self.counter = entry.counter
        self.v = entry.v
        self.length = entry.length
        self.charset = entry.charset
    }

    /// Le comportement d'avant le carnet, pour un site qu'il ne connaît pas.
    public init(fallbackFor domain: String, length: Int, charset: Charset) {
        self.entryId = ""
        self.label = domain
        self.siteKey = domain
        self.login = ""
        self.counter = 1
        self.v = 1
        self.length = length
        self.charset = charset
    }

    /// Toutes les façons de remplir ce domaine, dans l'ordre d'affichage.
    ///
    /// Plusieurs entrées pour un même domaine, c'est plusieurs comptes : on les
    /// propose toutes plutôt que d'en choisir une au hasard — c'était le
    /// premier des problèmes d'usage.
    public static func forDomain(
        _ domain: String, in vault: Vault, length: Int, charset: Charset
    ) -> [SiteResolution] {
        let matches = vault.findAll(domain: domain).map(SiteResolution.init(entry:))
        guard matches.isEmpty else { return matches }
        return [SiteResolution(fallbackFor: domain, length: length, charset: charset)]
    }

    /// Retrouve une résolution par identifiant d'entrée.
    ///
    /// Rend le repli quand l'identifiant est vide, ou quand l'entrée a disparu
    /// entre la suggestion et la validation — une synchronisation a pu passer
    /// entre les deux.
    public static func byId(
        _ entryId: String?, in vault: Vault, domain: String, length: Int, charset: Charset
    ) -> SiteResolution {
        if let entryId, !entryId.isEmpty,
            let entry = vault.entries.first(where: { $0.deleted != true && $0.id == entryId })
        {
            return SiteResolution(entry: entry)
        }
        return SiteResolution(fallbackFor: domain, length: length, charset: charset)
    }
}

extension PasswordUtils {

    /// Applique la bonne version de l'algorithme à une résolution du carnet.
    ///
    /// Les deux versions coexistent, entrée par entrée : une entrée existante
    /// reste en v1 et son mot de passe ne change pas, une entrée récente naît
    /// en v2. Appliquer la mauvaise rendrait un mot de passe faux sans rien
    /// signaler — le pire des échecs pour ce produit.
    ///
    /// - Parameter master: clef maîtresse déjà dérivée, ou `nil`. La dérivation
    ///   v2 coûte volontairement cher : la réutiliser évite de la repayer.
    /// - Parameter forcing: impose une version. Le remplissage automatique
    ///   dérive toujours en v2 : il ne propose aucun choix, il doit donc être
    ///   prévisible. L'écran de génération, lui, offre la v1 en secours pour
    ///   un site pas encore migré.
    public func generatePassword(
        for resolution: SiteResolution, masterKey: String, master: Data? = nil,
        forcing version: Int? = nil
    ) -> PasswordResult {
        longueur = resolution.length
        minState = resolution.charset.lower
        majState = resolution.charset.upper
        symState = resolution.charset.symbols
        chiState = resolution.charset.numbers

        if (version ?? resolution.v) >= 2 {
            return generatePasswordV2(
                masterKey: masterKey, siteKey: resolution.siteKey,
                login: resolution.login, counter: resolution.counter, master: master)
        }
        // v1 : ni login ni compteur n'entrent dans la dérivation. C'est
        // précisément ce que la v2 corrige, mais le mot de passe d'une entrée
        // existante ne doit pas changer.
        return generatePassword(input: resolution.siteKey + masterKey)
    }
}
