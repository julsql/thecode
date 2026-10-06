//
//  AutofillLogin.swift
//  Quel compte remplir, et sous quel identifiant, depuis le remplissage
//  automatique.
//
//  Un fournisseur de remplissage ne voit pas le formulaire : le système ne lui
//  donne que l'adresse du site. L'identifiant vient donc du carnet, ou de ce
//  que l'utilisatrice tape dans l'écran de l'extension. Même règle que le menu
//  de l'extension navigateur dans la page :
//    - un identifiant qui correspond à une entrée du site → cette entrée ;
//    - une seule entrée, enregistrée sans identifiant → on la garde (son mot de
//      passe ne doit pas changer parce qu'on remplit enfin l'identifiant) ;
//    - sinon, c'est un nouveau compte, dérivé en v2 avec cet identifiant.
//
//  L'identifiant est facultatif : sans lui, on remplit (et enregistre) le
//  compte sans identifiant du site, dérivé en v2 avec un identifiant vide.
//  L'ajouter plus tard changerait le mot de passe : la vue le dit.
//
//  Logique pure, sans AuthenticationServices : vérifiable en test.
//

import Foundation

public enum AutofillLogin {

    /// Ce qu'il faut pour remplir : le compte à dériver et l'identifiant à
    /// rendre au système (vide pour un compte sans identifiant).
    public struct Fill: Equatable {
        public let resolution: SiteResolution
        public let user: String
        /// Vrai quand le carnet ne connaît pas ce compte : seul cas où
        /// proposer de l'enregistrer apporte quelque chose.
        public let isNew: Bool
    }

    /// Les espaces autour ne comptent pas, comme sur les autres clients.
    public static func normalize(_ login: String) -> String {
        login.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Remplissage en un geste d'une entrée connue.
    ///
    /// `nil` quand l'entrée n'a pas d'identifiant : la vue la retient pour
    /// laisser saisir, si on le souhaite, l'identifiant à rendre au formulaire
    /// (le mot de passe, lui, reste celui de l'entrée).
    public static func quickFill(_ account: SiteResolution) -> Fill? {
        let user = normalize(account.login)
        guard !user.isEmpty else { return nil }
        return Fill(resolution: account, user: user, isNew: false)
    }

    /// Le compte correspondant à un identifiant saisi.
    ///
    /// - Parameter pinned: entrée choisie dans la liste (une entrée sans
    ///   identifiant) ; elle l'emporte, l'identifiant saisi ne sert alors qu'à
    ///   être rendu au formulaire.
    /// - Parameter separate: l'identifiant saisi désigne un autre compte que
    ///   l'unique entrée sans identifiant du site : on ne la réutilise pas.
    /// - Returns: `nil` sans domaine. Un identifiant vide désigne le compte
    ///   sans identifiant du site (existant, ou nouveau).
    public static func resolve(
        login typed: String, domain: String, vault: Vault, pinned: String? = nil,
        separate: Bool = false, length: Int, charset: Charset
    ) -> Fill? {
        let login = normalize(typed)
        let site = domain.trimmingCharacters(in: .whitespaces).lowercased()
        guard !site.isEmpty else { return nil }

        let entries = vault.findAll(domain: site)

        if let pinned, let entry = entries.first(where: { $0.id == pinned }) {
            return Fill(resolution: SiteResolution(entry: entry), user: login, isNew: false)
        }
        if let entry = entries.first(where: { ($0.login ?? "") == login }) {
            return Fill(resolution: SiteResolution(entry: entry), user: login, isNew: false)
        }
        if !separate, entries.count == 1, (entries[0].login ?? "").isEmpty {
            return Fill(resolution: SiteResolution(entry: entries[0]), user: login, isNew: false)
        }

        // Nouveau compte : l'entrée qu'on enregistrerait, pour dériver
        // exactement comme elle le fera ensuite.
        var entry = VaultEntry(
            siteKey: site, domains: [site], login: login.isEmpty ? nil : login)
        entry.length = length
        entry.charset = charset
        return Fill(resolution: SiteResolution(entry: entry), user: login, isNew: true)
    }

    /// Vrai quand l'identifiant saisi retombe sur l'unique entrée sans
    /// identifiant du site : il sera rendu au formulaire, mais le mot de passe
    /// reste celui de cette entrée. La vue le dit, et propose d'en faire un
    /// compte à part (`separate`).
    public static func keepsLoginlessEntry(_ fill: Fill) -> Bool {
        !fill.isNew && !fill.user.isEmpty && normalize(fill.resolution.login).isEmpty
    }

    /// Identifiants à proposer d'un geste pour un site : ceux du carnet, les
    /// plus utilisés d'abord (à égalité, ordre alphabétique), sans ceux que le
    /// site a déjà. Le système ne dit pas l'identifiant du formulaire ; c'est
    /// le plus souvent l'un de ceux qui servent ailleurs.
    public static func suggestions(vault: Vault, domain: String, limit: Int = 3) -> [String] {
        let site = domain.trimmingCharacters(in: .whitespaces).lowercased()
        let taken = Set(vault.findAll(domain: site).map { normalize($0.login ?? "") })
        var uses: [String: Int] = [:]
        for entry in vault.entries where entry.deleted != true {
            let login = normalize(entry.login ?? "")
            if !login.isEmpty, !taken.contains(login) { uses[login, default: 0] += 1 }
        }
        return uses
            .sorted { $0.value != $1.value ? $0.value > $1.value : $0.key < $1.key }
            .prefix(limit)
            .map(\.key)
    }
}
