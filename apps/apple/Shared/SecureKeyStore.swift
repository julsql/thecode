//
//  SecureKeyStore.swift
//  Stockage de la clef maîtresse dans le trousseau.
//
//  Source unique : shared/apple/SecureKeyStore.swift, copiée dans
//  apps/apple/Shared/ et compilée par les quatre cibles — l'extension autofill
//  macOS la référence explicitement, comme PasswordSettings, son dossier Shared
//  n'étant pas synchronisé.
//
//  La clef ouvre tous les comptes. Elle vivait dans UserDefaults, donc en clair
//  dans le conteneur de l'app group — ce que le README affirmait pourtant ne pas
//  faire. Le trousseau la chiffre au repos et la lie à cet appareil.
//

import Foundation
import Security

public enum SecureKeyStore {

    private static let service = "fr.julsql.thecode"
    private static let account = "encodingKey"

    /// Ancien emplacement, en clair, d'où la clef est migrée.
    private static let legacyDefaultsSuite = "group.fr.julsql.thecode.params"

    /// Aucun `kSecAttrAccessGroup` n'est passé, et c'est volontaire.
    ///
    /// Sans cet attribut, l'élément va dans le premier groupe déclaré par
    /// `keychain-access-groups`. Les quatre cibles n'en déclarent qu'un,
    /// `$(AppIdentifierPrefix)fr.julsql.thecode` : elles partagent donc le même
    /// élément sans que le code ait à connaître l'identifiant d'équipe, qui
    /// n'est pas lisible à l'exécution et qu'il faudrait sinon écrire en dur.
    private static func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            // Même trousseau que sur iOS. Sans cela, macOS écrit dans le
            // trousseau historique, qui ignore kSecAttrAccessible : la clef n'y
            // serait pas liée à l'appareil, contrairement à ce qu'on annonce.
            kSecUseDataProtectionKeychain as String: true,
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
        guard let defaults = UserDefaults(suiteName: legacyDefaultsSuite) else { return }
        let legacy = defaults.string(forKey: account) ?? ""
        guard !legacy.isEmpty else { return }

        write(legacy)
        defaults.removeObject(forKey: account)
    }
}
