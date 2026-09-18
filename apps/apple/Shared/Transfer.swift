//
//  Transfer.swift
//  Chiffrement du carnet avant qu'il ne quitte l'appareil.
//
//  Le serveur ne reçoit que des blocs opaques : il ne peut lire ni les sites,
//  ni les identifiants.
//
//  Le sel diffère de celui des mots de passe et de celui de l'empreinte : une
//  même valeur dérivée ne doit jamais servir à deux usages, sinon une faiblesse
//  sur l'un exposerait l'autre.
//
//  Source unique : shared/apple/Transfer.swift
//  Spécification : shared/spec/vault-transfer.md
//

import CommonCrypto
import CryptoKit
import Foundation

public enum Transfer {

    private static let salt = "thecode-transfer/v1"
    private static let iterations: UInt32 = 600_000
    private static let keyBytes = 32

    public enum TransferError: Error, Equatable {
        /// La clef maîtresse n'est pas celle qui a servi à chiffrer, ou les
        /// données ont été altérées. AES-GCM ne distingue pas les deux, et
        /// c'est volontaire.
        case cannotOpen
        case derivationFailed
    }

    /// Dérive la clef de transfert depuis la clef maîtresse.
    public static func deriveKey(_ masterKey: String) throws -> SymmetricKey {
        var output = [UInt8](repeating: 0, count: keyBytes)
        let saltBytes = Array(salt.utf8)

        let status = masterKey.withCString { keyPointer in
            CCKeyDerivationPBKDF(
                CCPBKDFAlgorithm(kCCPBKDF2),
                keyPointer,
                strlen(keyPointer),
                saltBytes,
                saltBytes.count,
                CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
                iterations,
                &output,
                keyBytes
            )
        }

        guard status == kCCSuccess else { throw TransferError.derivationFailed }
        return SymmetricKey(data: Data(output))
    }

    /// Un bloc chiffré : nonce et données, tous deux opaques pour le serveur.
    public struct Sealed {
        public let nonce: Data
        public let blob: Data
    }

    public static func seal(_ plain: Data, with key: SymmetricKey) throws -> Sealed {
        // AES.GCM.Nonce() tire un nonce aléatoire : le réutiliser avec la même
        // clef casserait AES-GCM.
        let nonce = AES.GCM.Nonce()
        let box = try AES.GCM.seal(plain, using: key, nonce: nonce)
        return Sealed(nonce: Data(nonce), blob: box.ciphertext + box.tag)
    }

    public static func open(nonce: Data, blob: Data, with key: SymmetricKey) throws -> Data {
        guard blob.count > 16 else { throw TransferError.cannotOpen }

        do {
            let box = try AES.GCM.SealedBox(
                nonce: AES.GCM.Nonce(data: nonce),
                ciphertext: blob.prefix(blob.count - 16),
                tag: blob.suffix(16)
            )
            return try AES.GCM.open(box, using: key)
        } catch {
            throw TransferError.cannotOpen
        }
    }
}
