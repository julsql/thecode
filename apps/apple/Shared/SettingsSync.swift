//
//  SettingsSync.swift
//  Réglages par défaut partagés par le compte de synchronisation.
//
//  Les réglages restent dans les UserDefaults du groupe d'app (cf.
//  PasswordSettings) ; on y ajoute leur date de modification, et de quoi les
//  échanger avec le compte. Voir shared/spec/default-settings.md.
//
//  Hors de PasswordSettings.swift parce que l'extension iOS compile celui-ci
//  sans Sync.swift.
//

import Foundation

extension PasswordSettings {

    /// Date de la dernière modification locale, ISO 8601.
    static let updatedAtKey = "settingsUpdatedAt"
    /// Valeurs à cette date : distingue une vraie modification d'une écriture
    /// qui ne change rien (réglages distants appliqués, onChange qui suit).
    static let stampKey = "settingsStamp"

    /// Un réglage jamais daté perd contre n'importe quelle valeur distante.
    static let neverUpdated = SharedSettings.neverUpdated

    private static func stamp(_ values: Values) -> String {
        [
            "\(values.length)", "\(values.minState)", "\(values.majState)",
            "\(values.symState)", "\(values.chiState)",
        ].joined(separator: "|")
    }

    /// Date la modification locale, si les valeurs ont réellement changé.
    ///
    /// Appelé à chaque changement dans l'écran de génération. Sans la
    /// comparaison, appliquer les réglages distants déclencherait les onChange
    /// et les redaterait à maintenant : ils repartiraient comme une
    /// modification locale.
    ///
    /// `datesFirstStamp` à faux : des valeurs jamais relevées sont seulement
    /// prises comme référence, sans date. C'est le cas à la première
    /// synchronisation, où dater des réglages d'usine à maintenant les ferait
    /// gagner contre ceux du compte.
    ///
    /// Rend vrai si les valeurs ont changé : c'est ce qui demande une
    /// synchronisation, et non l'écho des réglages distants tout juste appliqués.
    @discardableResult
    static func touch(
        _ defaults: UserDefaults?, now: String = Vault.nowIso(), datesFirstStamp: Bool = true
    ) -> Bool {
        guard let defaults else { return false }
        let current = stamp(load(from: defaults))
        let previous = defaults.string(forKey: stampKey)
        guard previous != current else { return false }
        if previous != nil || datesFirstStamp { defaults.set(now, forKey: updatedAtKey) }
        defaults.set(current, forKey: stampKey)
        return true
    }

    /// Les réglages retenus, tels qu'ils partent au compte.
    static func shared(from defaults: UserDefaults?) -> SharedSettings {
        let values = load(from: defaults)
        return SharedSettings(
            length: values.length,
            charset: Charset(
                lower: values.minState, upper: values.majState,
                symbols: values.symState, numbers: values.chiState),
            updatedAt: defaults?.string(forKey: updatedAtKey) ?? neverUpdated)
    }

    /// Retient des réglages venus du compte, avec leur date.
    static func apply(_ settings: SharedSettings, to defaults: UserDefaults?) {
        guard let defaults else { return }
        defaults.set(clampLength(settings.length), forKey: Key.lengthNumber)
        defaults.set(settings.charset.lower, forKey: Key.minState)
        defaults.set(settings.charset.upper, forKey: Key.majState)
        defaults.set(settings.charset.symbols, forKey: Key.symState)
        defaults.set(settings.charset.numbers, forKey: Key.chiState)
        defaults.set(settings.updatedAt, forKey: updatedAtKey)
        defaults.set(stamp(load(from: defaults)), forKey: stampKey)
    }

    /// Échange les réglages avec le compte, après la synchronisation du carnet.
    ///
    /// Rend les identifiants, éventuellement renouvelés. Un échec ici ne
    /// remet pas en cause le carnet déjà synchronisé : l'appelant l'ignore.
    @discardableResult
    static func syncShared(
        masterKey: String, credentials: SyncCredentials,
        defaults: UserDefaults? = UserDefaults(suiteName: VaultStore.appGroupID),
        sync: Sync = Sync()
    ) async throws -> SyncCredentials {
        // Une modification faite ailleurs que dans l'écran de génération.
        touch(defaults, datesFirstStamp: false)
        let (outcome, renewed) = try await sync.syncSettingsRenewing(
            shared(from: defaults), masterKey: masterKey, credentials: credentials)
        if case .applyRemote(let remote) = outcome { apply(remote, to: defaults) }
        return renewed
    }
}
