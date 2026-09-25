//
//  AutofillSave.swift
//  Ce que fait le carnet d'un mot de passe que le système propose d'enregistrer.
//
//  Depuis iOS 26.2, le système transmet au fournisseur de remplissage les mots
//  de passe saisis dans un formulaire (ASSavePasswordRequest). TheCode ne
//  stocke aucun mot de passe : il ne peut retenir que de quoi en *recalculer*
//  un. Un mot de passe choisi à la main ne se recalcule pas ; l'enregistrer
//  créerait une entrée qui proposerait ensuite un autre mot de passe que celui
//  du site. On n'enregistre donc que ce que la dérivation v2 reproduit.
//
//  Logique pure, sans AuthenticationServices : vérifiable en test, et
//  compilable sur macOS où l'API n'existe pas.
//

import Foundation

public enum AutofillSave {

    public enum Outcome: Equatable {
        /// Une entrée v2 à ajouter au carnet.
        case save(VaultEntry)
        /// Le carnet connaît déjà ce compte : rien à écrire, siteKey compris.
        case alreadyKnown
        /// Pas de compte de synchronisation : le carnet ne s'enrichit pas seul.
        case notLinked
        /// Domaine, clef ou jeu de caractères manquant.
        case unusable
        /// Le mot de passe ne sort pas de TheCode : impossible à rejouer.
        case notReproducible
    }

    /// Décide quoi faire d'un mot de passe saisi sur `domain` pour `user`.
    ///
    /// Essaie l'identifiant saisi, puis l'identifiant vide — c'est ce que
    /// produit le remplissage automatique pour un site que le carnet ne
    /// connaît pas encore. Le premier qui reproduit le mot de passe l'emporte.
    ///
    /// - Parameter master: clef maîtresse déjà dérivée, pour les tests ;
    ///   dérivée ici sinon (une seule fois pour tous les essais).
    public static func plan(
        domain: String, user: String, password: String, vault: Vault, isLinked: Bool,
        masterKey: String, length: Int, charset: Charset, master: Data? = nil
    ) -> Outcome {
        guard isLinked else { return .notLinked }

        let site = domain.trimmingCharacters(in: .whitespaces).lowercased()
        let login = user.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !site.isEmpty, !password.isEmpty, !masterKey.isEmpty,
            charset.lower || charset.upper || charset.symbols || charset.numbers
        else { return .unusable }

        let known = vault.findAll(domain: site)
        func isKnown(_ candidate: String) -> Bool {
            known.contains { ($0.login ?? "") == candidate }
        }
        if isKnown(login) { return .alreadyKnown }

        guard let derived = master ?? (try? CoreV2.deriveMasterKey(masterKey)) else {
            return .unusable
        }

        for candidate in login.isEmpty ? [""] : [login, ""] {
            guard
                reproduces(
                    password, site: site, login: candidate, length: length, charset: charset,
                    masterKey: masterKey, master: derived)
            else { continue }

            // Le compte sans identifiant existe déjà : le mot de passe vient
            // de lui, rien à ajouter.
            if isKnown(candidate) { return .alreadyKnown }

            var entry = VaultEntry(
                siteKey: site, domains: [site], login: candidate.isEmpty ? nil : candidate)
            entry.length = length
            entry.charset = charset
            return .save(entry)
        }
        return .notReproducible
    }

    private static func reproduces(
        _ password: String, site: String, login: String, length: Int, charset: Charset,
        masterKey: String, master: Data
    ) -> Bool {
        var probe = VaultEntry(siteKey: site, login: login.isEmpty ? nil : login)
        probe.length = length
        probe.charset = charset
        return PasswordUtils().generatePassword(
            for: SiteResolution(entry: probe), masterKey: masterKey, master: master
        ).code == password
    }
}
