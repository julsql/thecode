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
    /// Seule version admise au carnet. La v1 ne subsiste qu'en génération
    /// ponctuelle, hors carnet : voir shared/spec/vault-merge.md.
    public static let version = 2

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
    /// Toujours `VaultEntry.version` dans un carnet : toute autre valeur est
    /// écartée à la lecture et refusée à l'écriture.
    public var v: Int
    public var notes: String?
    /// Absent des entrées antérieures au champ : `updatedAt` en tient lieu.
    public var createdAt: String?
    public var updatedAt: String
    public var deleted: Bool?

    public init(siteKey: String, domains: [String]? = nil, label: String? = nil,
                login: String? = nil, length: Int = 20,
                charset: Charset = Charset()) {
        self.id = UUID().uuidString.lowercased()
        self.label = label
        self.siteKey = siteKey
        self.domains = Array(Set(domains?.isEmpty == false ? domains! : [siteKey])).sorted()
        self.login = login
        self.counter = 1
        self.length = length
        self.charset = charset
        self.v = VaultEntry.version
        let now = Vault.nowIso()
        self.createdAt = now
        self.updatedAt = now
    }

    /// Vrai quand l'entrée a sa place au carnet.
    public var isStorable: Bool { v == VaultEntry.version }

    func covers(domain: String) -> Bool {
        domains.contains { $0.lowercased() == domain.lowercased() }
    }

    /// Forme canonique, pour départager sans dépendre de l'ordre.
    ///
    /// Compacte, clés triées à tous les niveaux, `deleted` faux retiré. La
    /// forme est fixée par `shared/spec/vault-merge.md` : deux appareils qui
    /// n'écrivent pas la même chaîne désignent un gagnant différent et ne
    /// convergent jamais.
    ///
    /// `withoutEscapingSlashes` est indispensable : par défaut JSONEncoder
    /// écrit `\/`, ce que les autres implémentations n'écrivent pas.
    func canonical() -> String {
        var normalised = self
        if normalised.deleted != true { normalised.deleted = nil }

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return (try? encoder.encode(normalised)).flatMap { String(data: $0, encoding: .utf8) } ?? id
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
        self.entries = entries.filter(\.isStorable)
    }

    private enum CodingKeys: String, CodingKey {
        case schema, updatedAt, entries
    }

    /// Ce qu'il faut lire d'une entrée pour décider si elle a sa place.
    private struct VersionProbe: Decodable {
        let v: Int?
    }

    /// Lecture tolérante : une entrée `v ≠ 2` est écartée sans erreur.
    ///
    /// Le décodage synthétisé échouait sur tout le carnet pour une seule
    /// entrée refusée, et le chargement retombe alors sur un carnet vide : la
    /// prochaine écriture aurait effacé toutes les autres. Une entrée v2
    /// malformée, elle, reste une erreur — la taire masquerait une corruption.
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        schema = try container.decode(Int.self, forKey: .schema)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)

        // Deux passes sur le même tableau : un conteneur non indexé ne revient
        // pas en arrière, et il faut connaître `v` avant de décoder l'entrée.
        var probes = try container.nestedUnkeyedContainer(forKey: .entries)
        var items = try container.nestedUnkeyedContainer(forKey: .entries)
        var kept: [VaultEntry] = []
        while !probes.isAtEnd {
            let probe = try probes.decode(VersionProbe.self)
            if probe.v == VaultEntry.version {
                kept.append(try items.decode(VaultEntry.self))
            } else {
                _ = try items.decode(VersionProbe.self)
            }
        }
        entries = kept
    }

    /// Écriture : une entrée `v ≠ 2` ne quitte jamais la mémoire.
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(schema, forKey: .schema)
        try container.encodeIfPresent(updatedAt, forKey: .updatedAt)
        try container.encode(entries.filter(\.isStorable), forKey: .entries)
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
        if let index = entries.firstIndex(where: {
            $0.isStorable && $0.deleted != true && $0.covers(domain: site)
        }) {
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

    /// Enregistre les réglages d'un compte, apparié sur domaine + identifiant.
    ///
    /// L'identifiant entre dans la dérivation v2 : deux comptes d'un même site
    /// sont deux entrées, et enregistrer l'un ne doit jamais toucher l'autre.
    /// Un identifiant vide désigne l'entrée sans identifiant.
    ///
    /// Comme `upsert(site:length:charset:)`, `siteKey` n'est jamais réécrit.
    @discardableResult
    public mutating func upsert(
        site: String, login: String, length: Int, charset: Charset
    ) -> VaultEntry {
        if let index = entries.firstIndex(where: {
            $0.isStorable && $0.deleted != true && $0.covers(domain: site)
                && ($0.login ?? "") == login
        }) {
            entries[index].length = length
            entries[index].charset = charset
            entries[index].updatedAt = Vault.nowIso()
            return entries[index]
        }

        var created = VaultEntry(
            siteKey: site, domains: [site], login: login.isEmpty ? nil : login)
        created.length = length
        created.charset = charset
        entries.append(created)
        return created
    }

    /// L'identifiant que le carnet connaît pour ce site, s'il en connaît un.
    ///
    /// Plusieurs comptes : le premier, comme `find(domain:)`. L'écran de
    /// génération ne fait que préremplir, l'utilisatrice peut le changer.
    public func suggestedLogin(for site: String) -> String? {
        let domain = site.trimmingCharacters(in: .whitespaces)
        guard !domain.isEmpty else { return nil }
        return find(domain: domain)?.login
    }

    /// Nouvelle valeur du champ identifiant quand le site change.
    ///
    /// Ce qui a été tapé à la main l'emporte : on ne remplace que ce que le
    /// carnet avait lui-même prérempli, ou un champ vide.
    public static func prefilledLogin(
        typed: String, previousSuggestion: String, suggestion: String?
    ) -> String {
        typed.isEmpty || typed == previousSuggestion ? (suggestion ?? "") : typed
    }

    public static func merge(_ left: Vault, _ right: Vault) -> (Vault, [VaultConflict]) {
        var conflicts: [VaultConflict] = []
        var byId: [String: VaultEntry] = [:]
        let leftEntries = left.entries.filter(\.isStorable)
        let rightEntries = right.entries.filter(\.isStorable)
        for entry in leftEntries { byId[entry.id] = entry }

        for incoming in rightEntries {
            if let existing = byId[incoming.id] {
                byId[incoming.id] = mergeEntry(existing, incoming, &conflicts)
            } else {
                byId[incoming.id] = incoming
            }
        }

        let entries = byId.values.sorted { $0.id < $1.id }
        findDuplicates(
            entries, leftIds: Set(leftEntries.map(\.id)), rightIds: Set(rightEntries.map(\.id)),
            &conflicts)
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

        // Une entrée n'est créée qu'une fois : la date la plus ancienne est la
        // vraie. Un carnet antérieur au champ ne doit pas l'effacer.
        merged.createdAt = [left.createdAt, right.createdAt]
            .compactMap { $0 }.filter { !$0.isEmpty }.min()

        merged.updatedAt = max(left.updatedAt, right.updatedAt)
        return merged
    }

    /// Signale les doublons que la fusion rapproche : le même compte créé à
    /// part sur deux appareils, donc sous deux id. Un doublon déjà présent d'un
    /// côté l'a été quand il y est entré — le resignaler à chaque fusion serait
    /// du bruit.
    private static func findDuplicates(
        _ entries: [VaultEntry], leftIds: Set<String>, rightIds: Set<String>,
        _ conflicts: inout [VaultConflict]
    ) {
        let live = entries.filter { $0.deleted != true }
        for i in live.indices {
            for j in live.indices where j > i {
                let a = live[i]
                let b = live[j]
                let apart =
                    (leftIds.contains(a.id) && !rightIds.contains(a.id)
                        && rightIds.contains(b.id) && !leftIds.contains(b.id))
                    || (rightIds.contains(a.id) && !leftIds.contains(a.id)
                        && leftIds.contains(b.id) && !rightIds.contains(b.id))
                guard apart, (a.login ?? "") == (b.login ?? "") else { continue }
                let domains = Set(a.domains.map { $0.lowercased() })
                guard b.domains.contains(where: { domains.contains($0.lowercased()) }) else {
                    continue
                }
                // `live` est trié par id : `a` porte le plus petit.
                conflicts.append(VaultConflict(kind: "doublon", entryId: a.id, detail: b.id))
            }
        }
    }

    /// Ce qui part au serveur quand le compte a un plafond, et ce qui reste sur
    /// l'appareil. Voir shared/spec/vault-sync.md, « Synchronisation partielle ».
    ///
    /// Ce qui est déjà sur le serveur part toujours, pierres tombales comprises :
    /// une modification doit pouvoir partir. Les places libres vont aux autres
    /// entrées, les plus anciennes d'abord. Une entrée jamais synchronisée puis
    /// supprimée n'a rien à propager.
    public static func selectForPush<S: Sequence>(
        _ vault: Vault, remoteIds: S, maxEntries: Int
    ) -> (push: [VaultEntry], localOnly: [VaultEntry]) where S.Element == String {
        let remote = Set(remoteIds)
        let onServer = vault.entries.filter { remote.contains($0.id) }
        let others = vault.entries
            .filter { !remote.contains($0.id) && $0.deleted != true }
            .sorted {
                let da = $0.createdAt ?? $0.updatedAt
                let db = $1.createdAt ?? $1.updatedAt
                return da != db ? da < db : $0.id < $1.id
            }

        let free = max(0, maxEntries - onServer.filter { $0.deleted != true }.count)
        let byId: (VaultEntry, VaultEntry) -> Bool = { $0.id < $1.id }
        return (
            push: (onServer + others.prefix(free)).sorted(by: byId),
            localOnly: others.dropFirst(free).sorted(by: byId)
        )
    }
}

/// Proposer d'enregistrer au carnet un compte généré depuis l'app.
///
/// Réservé à qui est connecté à la synchronisation : le carnet sert d'abord à
/// retrouver ses réglages sur un autre appareil. Sans compte, la proposition
/// reviendrait à chaque site sans rien apporter de plus que le bouton.
public enum SaveProposal {

    /// Ce qui identifie un refus : le même compte n'est pas reproposé.
    public static func key(site: String, login: String) -> String {
        site.trimmingCharacters(in: .whitespaces).lowercased() + "\n" + login
    }

    /// Vrai quand le compte (site + identifiant) est absent du carnet.
    ///
    /// Jamais en v1 : l'entrée créée serait en v2, et donnerait un autre mot
    /// de passe que celui qui vient d'être copié.
    public static func shouldPropose(
        site: String, login: String, in vault: Vault, isLinked: Bool, usesV1: Bool,
        declined: Set<String> = []
    ) -> Bool {
        let domain = site.trimmingCharacters(in: .whitespaces)
        guard isLinked, !usesV1, !domain.isEmpty else { return false }
        guard !declined.contains(key(site: domain, login: login)) else { return false }
        return !vault.findAll(domain: domain).contains { ($0.login ?? "") == login }
    }
}
