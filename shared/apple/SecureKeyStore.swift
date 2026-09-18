//
//  SecureKeyStore.swift
//  Stockage de la clef maîtresse dans le trousseau.
//
//  Source unique : shared/apple/SecureKeyStore.swift. Les extensions autofill
//  sont des targets distincts qui ne voient pas Shared/, d'où la copie — le
//  projet fait déjà de même pour DomainNormalizer. check-shared.sh garantit que
//  les copies ne dérivent pas.
//
//  La clef ouvre tous les comptes. Elle vivait dans UserDefaults, donc en clair
//  dans le conteneur de l'app group — ce que le README affirmait pourtant ne pas
//  faire. Le trousseau la chiffre au repos et la lie à cet appareil.
//

import Foundation
import Security

public enum SecureKeyStore {

    /// Partagé avec les extensions autofill, comme l'était l'app group.
    private static let accessGroup = "group.fr.julsql.thecode.params"
    private static let service = "fr.julsql.thecode"
    private static let account = "encodingKey"

    private static func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: accessGroup,
        ]
    }

    /// Lit la clef. Chaîne vide si absente ou illisible.
    public static func read() -> String {
        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data,
              let value = String(data: data, encoding: .utf8)
        else {
            return ""
        }
        return value
    }

    /// Écrit la clef, ou l'efface si elle est vide.
    @discardableResult
    public static func write(_ value: String) -> Bool {
        guard !value.isEmpty else { return clear() }

        let data = Data(value.utf8)
        var attributes: [String: Any] = [kSecValueData as String: data]
        // ThisDeviceOnly : la clef ne doit pas suivre une sauvegarde vers un
        // autre appareil. Le carnet se transfère explicitement, pas la clef.
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly

        let status = SecItemUpdate(baseQuery() as CFDictionary, attributes as CFDictionary)
        if status == errSecSuccess { return true }

        guard status == errSecItemNotFound else { return false }

        var insert = baseQuery()
        insert[kSecValueData as String] = data
        insert[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        return SecItemAdd(insert as CFDictionary, nil) == errSecSuccess
    }

    @discardableResult
    public static func clear() -> Bool {
        let status = SecItemDelete(baseQuery() as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }

    /// Déplace une clef écrite en clair par une version antérieure.
    ///
    /// Elle est retirée de UserDefaults dans tous les cas : l'y laisser après
    /// avoir annoncé le contraire serait pire que de demander une ressaisie.
    public static func migrateFromUserDefaults() {
        guard let defaults = UserDefaults(suiteName: accessGroup) else { return }
        let legacy = defaults.string(forKey: account) ?? ""
        guard !legacy.isEmpty else { return }

        write(legacy)
        defaults.removeObject(forKey: account)
    }
}
