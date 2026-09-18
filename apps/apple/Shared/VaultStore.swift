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
    public static func load(from url: URL? = VaultStore.url()) -> Vault {
        guard let url, let data = try? Data(contentsOf: url) else { return Vault() }
        return (try? JSONDecoder().decode(Vault.self, from: data)) ?? Vault()
    }

    public static func save(_ vault: Vault, to url: URL? = VaultStore.url()) throws {
        guard let url else { throw VaultStoreError.containerUnavailable }

        var stamped = vault
        stamped.updatedAt = Vault.nowIso()

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let data = try encoder.encode(stamped)

        // Écriture atomique : une interruption ne doit pas laisser un carnet
        // tronqué, qui ferait perdre toutes les entrées.
        try data.write(to: url, options: [.atomic, .completeFileProtection])
    }

    public enum VaultStoreError: Error, Equatable {
        case containerUnavailable
    }
}
