//
//  Vault.swift
//  Carnet de métadonnées.
//
//  Le carnet ne contient jamais de mot de passe ni de clef maîtresse :
//  seulement de quoi rejouer une dérivation. Une fuite révèle les sites et les
//  identifiants, pas les mots de passe.
//
//  Schéma : shared/vault.schema.json
//  Règles de fusion : shared/spec/vault-merge.md
//

import Foundation

public struct Charset: Codable, Equatable {
    public var lower: Bool
    public var upper: Bool
    public var symbols: Bool
    public var numbers: Bool

    public init(lower: Bool = true, upper: Bool = true,
                symbols: Bool = true, numbers: Bool = true) {
        self.lower = lower
        self.upper = upper
        self.symbols = symbols
        self.numbers = numbers
    }
}

public struct VaultEntry: Codable, Equatable {
    public var id: String
    public var label: String?
    /// Chaîne réellement passée à la dérivation. Figée à la création : elle ne
    /// suit pas les évolutions de la canonicalisation, sinon un changement de
    /// PSL modifierait des mots de passe existants.
    public var siteKey: String
    public var domains: [String]
    public var login: String?
    public var counter: Int
    public var length: Int
    public var charset: Charset
    public var v: Int
    public var notes: String?
    public var updatedAt: String
    public var deleted: Bool?

    public init(siteKey: String, domains: [String]? = nil, label: String? = nil,
                login: String? = nil, length: Int = 20,
                charset: Charset = Charset(), v: Int = 1) {
        self.id = UUID().uuidString.lowercased()
        self.label = label
        self.siteKey = siteKey
        self.domains = Array(Set(domains?.isEmpty == false ? domains! : [siteKey])).sorted()
        self.login = login
        self.counter = 1
        self.length = length
        self.charset = charset
        self.v = v
        self.updatedAt = Vault.nowIso()
    }

    func covers(domain: String) -> Bool {
        domains.contains { $0.lowercased() == domain.lowercased() }
    }

    /// Représentation stable, pour départager sans dépendre de l'ordre.
    func canonical() -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return (try? encoder.encode(self)).flatMap { String(data: $0, encoding: .utf8) } ?? id
    }
}

/// Un désaccord que la fusion refuse de trancher toute seule.
public struct VaultConflict: Equatable {
    public let kind: String
    public let entryId: String
    public let detail: String
}

public struct Vault: Codable {
    public static let schemaVersion = 1

    public var schema: Int
    public var updatedAt: String?
    public var entries: [VaultEntry]

    public init(entries: [VaultEntry] = []) {
        self.schema = Vault.schemaVersion
        self.updatedAt = Vault.nowIso()
        self.entries = entries
    }

    static func nowIso() -> String {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd'T'HH:mm:ss'Z'"
        fmt.timeZone = TimeZone(identifier: "UTC")
        fmt.locale = Locale(identifier: "en_US_POSIX")
        return fmt.string(from: Date())
    }

    /// Entrées couvrant ce domaine. Plusieurs = plusieurs comptes sur le site.
    public func findAll(domain: String) -> [VaultEntry] {
        entries.filter { $0.deleted != true && $0.covers(domain: domain) }
    }

    public func find(domain: String) -> VaultEntry? {
        findAll(domain: domain).first
    }

    /// Fusionne deux carnets. Commutative et idempotente : l'ordre de
    /// synchronisation des appareils ne doit pas changer le résultat.
    /// Enregistre les réglages d'un site, en créant l'entrée si besoin.
    ///
    /// Même sémantique que le CLI : la recherche se fait par domaine et non par
    /// `siteKey`, sinon « google.fr » créerait un doublon d'une entrée qui
    /// couvre déjà « google.com » et « google.fr ».
    ///
    /// `siteKey` n'est jamais réécrit : il produit le mot de passe, le modifier
    /// en changerait un déjà en service. L'appelant compare le `siteKey` rendu
    /// au site saisi pour prévenir quand les deux diffèrent.
    @discardableResult
    public mutating func upsert(site: String, length: Int, charset: Charset) -> VaultEntry {
        if let index = entries.firstIndex(where: { $0.deleted != true && $0.covers(domain: site) }) {
            entries[index].length = length
            entries[index].charset = charset
            entries[index].updatedAt = Vault.nowIso()
            return entries[index]
        }

        var created = VaultEntry(siteKey: site, domains: [site])
        created.length = length
        created.charset = charset
        entries.append(created)
        return created
    }

    public static func merge(_ left: Vault, _ right: Vault) -> (Vault, [VaultConflict]) {
        var conflicts: [VaultConflict] = []
        var byId: [String: VaultEntry] = [:]
        for entry in left.entries { byId[entry.id] = entry }

        for incoming in right.entries {
            if let existing = byId[incoming.id] {
                byId[incoming.id] = mergeEntry(existing, incoming, &conflicts)
            } else {
                byId[incoming.id] = incoming
            }
        }

        let entries = byId.values.sorted { $0.id < $1.id }
        var merged = Vault(entries: entries)
        merged.updatedAt = ([left.updatedAt ?? "", right.updatedAt ?? ""]
            + entries.map(\.updatedAt)).filter { !$0.isEmpty }.max() ?? nowIso()
        return (merged, conflicts)
    }

    private static func mergeEntry(_ left: VaultEntry, _ right: VaultEntry,
                                   _ conflicts: inout [VaultConflict]) -> VaultEntry {
        // Égalité d'horodatage : on départage sur la représentation canonique.
        // Départager sur la position ne serait pas commutatif — chaque appareil
        // garderait le sien — et l'id ne peut pas servir, les deux entrées
        // portent la même.
        let winner: VaultEntry
        if left.updatedAt != right.updatedAt {
            winner = left.updatedAt > right.updatedAt ? left : right
        } else {
            winner = left.canonical() <= right.canonical() ? left : right
        }

        var merged = winner

        // siteKey produit le mot de passe : on ne choisit jamais à la place de
        // l'utilisateur. On garde celui de gauche et on signale.
        if left.siteKey != right.siteKey {
            conflicts.append(VaultConflict(kind: "sitekey-divergent", entryId: left.id,
                                           detail: "\(left.siteKey) vs \(right.siteKey)"))
            merged.siteKey = left.siteKey
        }

        // Union : une addition de chaque côté ne doit pas en effacer une autre.
        merged.domains = Array(Set(left.domains).union(right.domains)).sorted()

        // Un compteur ne recule pas : une valeur haute signifie déjà renouvelé.
        let high = max(left.counter, right.counter)
        let low = min(left.counter, right.counter)
        merged.counter = high
        if high != low && winner.counter == low {
            conflicts.append(VaultConflict(kind: "counter-recul", entryId: left.id,
                                           detail: "le plus recent porte \(low), on garde \(high)"))
        }

        // Une suppression se propage, sinon l'autre carnet ressusciterait
        // l'entrée.
        if left.deleted == true || right.deleted == true { merged.deleted = true }

        merged.updatedAt = max(left.updatedAt, right.updatedAt)
        return merged
    }
}
