//
//  VaultStore.swift
//  Persistance du carnet.
//
//  Le fichier vit dans le conteneur du groupe d'app, pas dans celui de l'app :
//  l'extension de remplissage automatique doit lire le même carnet, sinon elle
//  proposerait d'autres réglages que l'app.
//
//  Le carnet ne contient aucun mot de passe, seulement de quoi rejouer une
//  dérivation. Il reste néanmoins la liste des sites où l'utilisatrice a un
//  compte : protection du fichier au niveau du système de fichiers, comme le
//  reste des données de l'app.
//
//  Source unique : shared/apple/VaultStore.swift
//

import CryptoKit
import Foundation

public enum VaultStore {

    /// Identifiant du groupe d'app. Redéclaré ici plutôt que réutilisé depuis
    /// les targets : ce fichier est aussi compilé dans le bundle de tests, qui
    /// n'embarque pas le code de l'app.
    public static let appGroupID = "group.fr.julsql.thecode.params"

    private static let filename = "vault.json"

    /// Emplacement du carnet, ou `nil` si le groupe d'app est indisponible.
    public static func url(appGroupID: String = VaultStore.appGroupID) -> URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: appGroupID)?
            .appendingPathComponent(filename)
    }

    /// Charge le carnet. Un fichier absent ou illisible rend un carnet vide.
    ///
    /// Remonter une erreur ici bloquerait l'app sur un écran d'échec sans que
    /// l'utilisatrice puisse rien y faire ; repartir d'un carnet vide la laisse
    /// travailler, et la synchronisation récupérera ce qui existe ailleurs.
    ///
    /// Une entrée illisible est écartée, les autres sont gardées. Dans ce cas,
    /// comme pour un fichier entièrement illisible, une copie du fichier est
    /// mise de côté avant toute réécriture : rien n'est perdu en silence.
    public static func load(from url: URL? = VaultStore.url()) -> Vault {
        guard let url, let data = try? Data(contentsOf: url), !data.isEmpty else {
            return Vault()
        }
        guard let vault = try? JSONDecoder().decode(Vault.self, from: data) else {
            _ = try? preserve(data, besides: url)
            return Vault()
        }
        if vault.skippedEntries > 0 { _ = try? preserve(data, besides: url) }
        return vault
    }

    public static func save(_ vault: Vault, to url: URL? = VaultStore.url()) throws {
        guard let url else { throw VaultStoreError.containerUnavailable }

        // Ne jamais remplacer un fichier qu'on n'a pas su lire en entier sans
        // en avoir gardé une copie : la sauvegarde écraserait ce qui n'a pas
        // été chargé. Si la copie échoue, on n'écrit pas.
        if let existing = try? Data(contentsOf: url), !existing.isEmpty,
            (try? JSONDecoder().decode(Vault.self, from: existing))?.skippedEntries != 0
        {
            do {
                try preserve(existing, besides: url)
            } catch {
                throw VaultStoreError.unreadableFileNotPreserved
            }
        }

        var stamped = vault
        stamped.updatedAt = Vault.nowIso()

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let data = try encoder.encode(stamped)

        // Écriture atomique : une interruption ne doit pas laisser un carnet
        // tronqué, qui ferait perdre toutes les entrées.
        try data.write(to: url, options: [.atomic, .completeFileProtection])
    }

    /// Copies mises de côté pour ce carnet, par nom.
    public static func preservedCopies(of url: URL? = VaultStore.url()) -> [URL] {
        guard let url else { return [] }
        let prefix = url.deletingPathExtension().lastPathComponent + ".unreadable-"
        let siblings =
            (try? FileManager.default.contentsOfDirectory(
                at: url.deletingLastPathComponent(), includingPropertiesForKeys: nil)) ?? []
        return siblings.filter { $0.lastPathComponent.hasPrefix(prefix) }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
    }

    /// Met de côté une copie du contenu, à côté du carnet.
    ///
    /// Nommée d'après l'empreinte du contenu : recharger le même fichier ne
    /// multiplie pas les copies, et une copie existante n'est jamais écrasée.
    @discardableResult
    static func preserve(_ data: Data, besides url: URL) throws -> URL {
        let digest = SHA256.hash(data: data).prefix(8).map { String(format: "%02x", $0) }
            .joined()
        let copy = url.deletingLastPathComponent().appendingPathComponent(
            "\(url.deletingPathExtension().lastPathComponent).unreadable-\(digest).json")
        if !FileManager.default.fileExists(atPath: copy.path) {
            try data.write(to: copy, options: [.withoutOverwriting, .completeFileProtection])
        }
        return copy
    }

    public enum VaultStoreError: Error, Equatable {
        case containerUnavailable
        /// Le fichier en place n'a pu être ni lu en entier ni mis de côté :
        /// l'écraser perdrait ce qu'il contient.
        case unreadableFileNotPreserved
    }
}
