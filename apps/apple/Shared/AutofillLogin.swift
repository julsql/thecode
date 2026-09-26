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
//  Jamais d'identifiant vide rendu au système : c'est la cause la plus
//  probable du plantage de Safari (macOS) sur un formulaire sans champ
//  identifiant, et un compte sans identifiant ne se retrouve pas ensuite.
//
//  Logique pure, sans AuthenticationServices : vérifiable en test.
//

import Foundation

public enum AutofillLogin {

    /// Ce qu'il faut pour remplir : le compte à dériver et l'identifiant à
    /// rendre au système, jamais vide.
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
    /// `nil` quand l'entrée n'a pas d'identifiant : il faut alors le saisir,
    /// faute de quoi le système recevrait un identifiant vide.
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
    /// - Returns: `nil` sans identifiant, ou sans domaine.
    public static func resolve(
        login typed: String, domain: String, vault: Vault, pinned: String? = nil,
        length: Int, charset: Charset
    ) -> Fill? {
        let login = normalize(typed)
        let site = domain.trimmingCharacters(in: .whitespaces).lowercased()
        guard !login.isEmpty, !site.isEmpty else { return nil }

        let entries = vault.findAll(domain: site)

        if let pinned, let entry = entries.first(where: { $0.id == pinned }) {
            return Fill(resolution: SiteResolution(entry: entry), user: login, isNew: false)
        }
        if let entry = entries.first(where: { ($0.login ?? "") == login }) {
            return Fill(resolution: SiteResolution(entry: entry), user: login, isNew: false)
        }
        if entries.count == 1, (entries[0].login ?? "").isEmpty {
            return Fill(resolution: SiteResolution(entry: entries[0]), user: login, isNew: false)
        }

        // Nouveau compte : l'entrée qu'on enregistrerait, pour dériver
        // exactement comme elle le fera ensuite.
        var entry = VaultEntry(siteKey: site, domains: [site], login: login)
        entry.length = length
        entry.charset = charset
        return Fill(resolution: SiteResolution(entry: entry), user: login, isNew: true)
    }
}
