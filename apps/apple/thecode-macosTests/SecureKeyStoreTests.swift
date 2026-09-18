//
//  SecureKeyStoreTests.swift
//  Stockage de la clef maîtresse dans le trousseau.
//
//  La clef ouvre tous les comptes. Elle vivait dans UserDefaults, donc en clair
//  dans le conteneur de l'app group — ce que le README affirmait pourtant ne
//  pas faire.
//
//  Côté macOS et non iOS : le bundle de tests iOS tourne sans application hôte
//  (TEST_HOST vide), donc sans les droits d'accès au trousseau. Ici l'hôte est
//  l'app macOS, qui les porte.
//

import Foundation
import Security
import Testing

/// Vrai si le processus peut réellement écrire dans le trousseau.
///
/// Une app non signée — ce qui est le cas en CI, faute de certificats — reçoit
/// `errSecMissingEntitlement`. Mieux vaut le dire que faire échouer une suite
/// qui ne teste alors plus rien.
private let keychainIsUsable: Bool = {
    let probe: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "fr.julsql.thecode.probe",
        kSecAttrAccount as String: "probe",
        kSecValueData as String: Data("x".utf8),
        kSecUseDataProtectionKeychain as String: true,
    ]
    SecItemDelete(probe as CFDictionary)
    let status = SecItemAdd(probe as CFDictionary, nil)
    SecItemDelete(probe as CFDictionary)
    return status == errSecSuccess
}()

@Suite("Clef maîtresse au trousseau", .serialized, .enabled(if: keychainIsUsable))
struct SecureKeyStoreTests {

    private func reset() {
        SecureKeyStore.clear()
    }

    @Test("Aller-retour fidèle")
    func roundTrips() {
        reset()
        defer { reset() }

        #expect(SecureKeyStore.write("ma clef à moi"))
        #expect(SecureKeyStore.read() == "ma clef à moi")
    }

    @Test("Une clef absente rend une chaîne vide, pas une erreur")
    func missingKeyIsEmpty() {
        reset()
        #expect(SecureKeyStore.read() == "")
    }

    @Test("Écrire deux fois remplace au lieu d'échouer")
    func overwrites() {
        reset()
        defer { reset() }

        // SecItemAdd par-dessus un élément existant rend errSecDuplicateItem :
        // sans mise à jour, l'ancienne clef resterait en place.
        SecureKeyStore.write("première")
        #expect(SecureKeyStore.write("seconde"))
        #expect(SecureKeyStore.read() == "seconde")
    }

    @Test("Écrire une chaîne vide efface")
    func emptyClears() {
        reset()
        defer { reset() }

        SecureKeyStore.write("clef")
        #expect(SecureKeyStore.write(""))
        #expect(SecureKeyStore.read() == "")
    }

    @Test("Effacer deux fois n'est pas un échec")
    func clearingTwiceSucceeds() {
        reset()
        #expect(SecureKeyStore.clear())
        #expect(SecureKeyStore.clear())
    }

    @Test("Une clef laissée en clair est déplacée puis retirée")
    func migratesFromUserDefaults() throws {
        reset()
        defer { reset() }

        let defaults = try #require(UserDefaults(suiteName: "group.fr.julsql.thecode.params"))
        defaults.set("clef héritée", forKey: "encodingKey")

        SecureKeyStore.migrateFromUserDefaults()

        #expect(SecureKeyStore.read() == "clef héritée")
        // Retirée dans tous les cas : l'y laisser après avoir annoncé le
        // contraire serait pire que de demander une ressaisie.
        #expect(defaults.string(forKey: "encodingKey") == nil)
    }

    @Test("Rien à migrer ne casse rien")
    func migratingNothingIsSafe() throws {
        reset()
        defer { reset() }

        let defaults = try #require(UserDefaults(suiteName: "group.fr.julsql.thecode.params"))
        defaults.removeObject(forKey: "encodingKey")

        SecureKeyStore.migrateFromUserDefaults()
        #expect(SecureKeyStore.read() == "")
    }

    @Test("La clef ne suit pas une sauvegarde vers un autre appareil")
    func staysOnThisDevice() throws {
        reset()
        defer { reset() }

        SecureKeyStore.write("clef")

        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "fr.julsql.thecode",
            kSecAttrAccount as String: "encodingKey",
            kSecUseDataProtectionKeychain as String: true,
            kSecReturnAttributes as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        #expect(SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess)

        let attributes = try #require(item as? [String: Any])
        // Le carnet se transfère explicitement ; la clef, jamais.
        #expect(
            attributes[kSecAttrAccessible as String] as? String
                == (kSecAttrAccessibleWhenUnlockedThisDeviceOnly as String))
        query.removeAll()
    }
}
