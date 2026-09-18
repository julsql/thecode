//
//  SyncCredentialsStore.swift
//  Conservation des jetons de synchronisation.
//
//  Trousseau et non UserDefaults : ces jetons ouvrent le compte de
//  synchronisation, et un fichier de préférences se lit dans une sauvegarde ou
//  sur un appareil déverrouillé.
//
//  Aucun `kSecAttrAccessGroup` n'est passé : l'élément va donc dans le groupe
//  déclaré par la cible, le même que celui de la clef maîtresse. L'extension de
//  remplissage automatique pourrait le lire sans en avoir l'usage — elle ne
//  synchronise pas — mais c'est le même appareil et la même app, et cela évite
//  d'écrire l'identifiant d'équipe en dur pour désigner un autre groupe.
//
//  `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` : la synchronisation peut
//  tourner en arrière-plan après un premier déverrouillage, mais les jetons ne
//  quittent jamais l'appareil, ni par iCloud ni par une sauvegarde.
//
//  Source unique : shared/apple/SyncCredentialsStore.swift
//

import Foundation
import Security

public enum SyncCredentialsStore {

    private static let service = "fr.julsql.thecode.sync"
    private static let account = "credentials"

    public static func load() -> SyncCredentials? {
        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
            let data = item as? Data
        else { return nil }

        return try? JSONDecoder().decode(SyncCredentials.self, from: data)
    }

    @discardableResult
    public static func save(_ credentials: SyncCredentials) -> Bool {
        guard let data = try? JSONEncoder().encode(credentials) else { return false }

        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]

        // Mise à jour d'abord : ajouter par-dessus un élément existant échoue
        // avec errSecDuplicateItem, et l'ancien jeton resterait en place.
        let status = SecItemUpdate(baseQuery() as CFDictionary, attributes as CFDictionary)
        if status == errSecSuccess { return true }
        if status != errSecItemNotFound { return false }

        var insert = baseQuery()
        insert.merge(attributes) { _, new in new }
        return SecItemAdd(insert as CFDictionary, nil) == errSecSuccess
    }

    @discardableResult
    public static func clear() -> Bool {
        let status = SecItemDelete(baseQuery() as CFDictionary)
        // Rien à supprimer n'est pas un échec : le compte est délié dans les
        // deux cas.
        return status == errSecSuccess || status == errSecItemNotFound
    }

    private static func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            // Même trousseau que sur iOS. Sans cela, macOS écrit dans le
            // trousseau historique, qui ignore kSecAttrAccessible.
            kSecUseDataProtectionKeychain as String: true,
        ]
    }
}
