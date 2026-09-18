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
import Compression
import CryptoKit
import Foundation

public enum Transfer {

    public static let prefix = "TC1"

    private static let salt = "thecode-transfer/v1"
    private static let iterations: UInt32 = 600_000
    private static let keyBytes = 32

    public enum TransferError: Error, Equatable {
        /// Version inconnue, ou payload mal forme.
        case unreadable(String)
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

    // MARK: - Découpage en plusieurs QR

    /// Un QR plafonne à ~2,9 Ko. On garde de la marge pour l'en-tête du
    /// fragment, qui s'ajoute à chaque morceau.
    public static let fragmentPayloadLimit = 2600

    /// Découpe un payload en fragments affichables l'un après l'autre.
    ///
    /// Un seul fragment quand le payload tient : inutile d'imposer un
    /// assemblage pour un carnet ordinaire.
    public static func fragments(_ payload: String) -> [String] {
        guard payload.count > fragmentPayloadLimit else { return [payload] }

        // Le préfixe « TC1. » est porté une fois par le réassemblage, pas par
        // chaque fragment.
        let body = String(payload.dropFirst(prefix.count + 1))
        let chunks = stride(from: 0, to: body.count, by: fragmentPayloadLimit).map { start -> String in
            let from = body.index(body.startIndex, offsetBy: start)
            let to = body.index(from, offsetBy: min(fragmentPayloadLimit, body.count - start))
            return String(body[from..<to])
        }

        return chunks.enumerated().map { index, chunk in
            "TC1m.\(index).\(chunks.count).\(chunk)"
        }
    }

    // MARK: - Carnet entier

    /// Chiffre un carnet en un payload transportable.
    public static func exportVault(_ vault: Vault, masterKey: String) throws -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let compressed = try deflate(encoder.encode(vault))

        let sealed = try seal(compressed, with: deriveKey(masterKey))
        return "\(prefix).\(Base64URL.encode(sealed.nonce)).\(Base64URL.encode(sealed.blob))"
    }

    /// Déchiffre un payload. Lève `TransferError` s'il est illisible.
    public static func importVault(_ payload: String, masterKey: String) throws -> Vault {
        let parts = payload.trimmingCharacters(in: .whitespacesAndNewlines).split(
            separator: ".", omittingEmptySubsequences: false
        ).map(String.init)

        guard parts.count == 3 else {
            throw TransferError.unreadable("Format inattendu : TC1.<nonce>.<donnees> attendu.")
        }
        guard parts[0] == prefix else {
            // Interpréter un format inconnu au hasard serait pire que refuser.
            throw TransferError.unreadable(
                "Version « \(parts[0]) » inconnue, ce client lit \(prefix).")
        }
        guard let nonce = Base64URL.decode(parts[1]), let blob = Base64URL.decode(parts[2]) else {
            throw TransferError.unreadable("Encodage invalide.")
        }

        let compressed = try open(nonce: nonce, blob: blob, with: deriveKey(masterKey))
        return try JSONDecoder().decode(Vault.self, from: try inflate(compressed))
    }
}

// MARK: - Compression zlib

/// Compresse, pour qu'un carnet de cinquante entrées tienne dans un QR.
///
/// Le format attendu est **zlib** (RFC 1950) : c'est ce que produisent
/// `zlib.compress` côté Python, `Deflater` côté Java et `CompressionStream
/// ("deflate")` côté navigateur — où « deflate » désigne justement le format
/// zlib, « deflate-raw » étant le format brut.
///
/// `COMPRESSION_ZLIB` d'Apple, malgré son nom, produit du deflate **brut**
/// (RFC 1951). On ajoute donc l'en-tête et l'Adler-32 nous-mêmes. Sans cela
/// l'aller-retour local fonctionne — et rien d'autre ne relit le payload.
private func deflate(_ data: Data) throws -> Data {
    var out = Data([0x78, 0x9C])
    out.append(try perform(data, operation: COMPRESSION_STREAM_ENCODE))

    var checksum = adler32(data).bigEndian
    out.append(Data(bytes: &checksum, count: 4))
    return out
}

private func inflate(_ data: Data) throws -> Data {
    // 2 octets d'en-tête, 4 d'Adler-32 : le reste est du deflate brut.
    guard data.count > 6, data[data.startIndex] & 0x0F == 8 else {
        throw Transfer.TransferError.unreadable("Contenu compressé illisible.")
    }
    let body = data.dropFirst(2).dropLast(4)
    let plain = try perform(Data(body), operation: COMPRESSION_STREAM_DECODE)

    let expected = data.suffix(4).reduce(UInt32(0)) { ($0 << 8) | UInt32($1) }
    guard adler32(plain) == expected else {
        throw Transfer.TransferError.unreadable("Somme de contrôle invalide.")
    }
    return plain
}

/// Adler-32, tel que le définit RFC 1950. Trivial, et il évite d'accepter un
/// contenu décompressé de travers.
private func adler32(_ data: Data) -> UInt32 {
    var a: UInt32 = 1
    var b: UInt32 = 0
    for byte in data {
        a = (a + UInt32(byte)) % 65521
        b = (b + a) % 65521
    }
    return (b << 16) | a
}

private func perform(_ data: Data, operation: compression_stream_operation) throws -> Data {
    guard !data.isEmpty else { return Data() }

    var stream = compression_stream(
        dst_ptr: UnsafeMutablePointer<UInt8>(bitPattern: 1)!, dst_size: 0,
        src_ptr: UnsafePointer<UInt8>(bitPattern: 1)!, src_size: 0, state: nil)
    guard compression_stream_init(&stream, operation, COMPRESSION_ZLIB) == COMPRESSION_STATUS_OK
    else {
        throw Transfer.TransferError.unreadable("Compression indisponible.")
    }
    defer { compression_stream_destroy(&stream) }

    let bufferSize = 32_768
    let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
    defer { buffer.deallocate() }

    var output = Data()
    let flags = Int32(COMPRESSION_STREAM_FINALIZE.rawValue)

    try data.withUnsafeBytes { (raw: UnsafeRawBufferPointer) in
        stream.src_ptr = raw.bindMemory(to: UInt8.self).baseAddress!
        stream.src_size = data.count

        repeat {
            stream.dst_ptr = buffer
            stream.dst_size = bufferSize

            switch compression_stream_process(&stream, flags) {
            case COMPRESSION_STATUS_OK, COMPRESSION_STATUS_END:
                output.append(buffer, count: bufferSize - stream.dst_size)
                if stream.dst_size != 0 { return }
            default:
                throw Transfer.TransferError.unreadable("Contenu illisible après déchiffrement.")
            }
        } while true
    }

    return output
}
