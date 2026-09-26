//
//  MainView.swift
//  thecode-macos
//

import SwiftUI
import LocalAuthentication
import AppKit

let appGroupID = "group.fr.julsql.thecode.params"

// MARK: - Localisation (FR si système en français, EN sinon)

enum L10n {
    static let isFrench: Bool = {
        guard let primary = Locale.preferredLanguages.first else { return false }
        return primary.lowercased().hasPrefix("fr")
    }()

    static func t(_ fr: String, _ en: String) -> String {
        isFrench ? fr : en
    }
}

struct MainView: View {
    // Paramètres globaux
    /// La clef maîtresse, lue et écrite dans le trousseau.
    ///
    /// Pas @AppStorage : elle vivait alors en clair dans le conteneur de l'app
    /// group, ce que le README affirmait pourtant ne pas faire. Le trousseau la
    /// chiffre au repos et la lie à cet appareil.
    @State var encodingKey: String = SecureKeyStore.read()
    @AppStorage("lengthNumber", store: UserDefaults(suiteName: appGroupID)) var lengthNumber: Int = 20
    @AppStorage("minState", store: UserDefaults(suiteName: appGroupID)) var minState: Bool = true
    @AppStorage("majState", store: UserDefaults(suiteName: appGroupID)) var majState: Bool = true
    @AppStorage("symState", store: UserDefaults(suiteName: appGroupID)) var symState: Bool = true
    @AppStorage("chiState", store: UserDefaults(suiteName: appGroupID)) var chiState: Bool = true
    @AppStorage("darkMode", store: UserDefaults(suiteName: appGroupID)) var darkMode: String = "SYSTEM"

    @State private var siteName: String = ""
    /// Identifiant du compte : il entre dans la dérivation v2, vide = sans.
    @State private var loginName: String = ""
    /// Dernier identifiant prérempli depuis le carnet, pour ne jamais écraser
    /// ce que l'utilisatrice a tapé elle-même.
    @State private var suggestedLogin: String = ""
    @State private var generatedValue: String = ""
    @State private var securityLabel: String = ""
    @State private var securityColor: Color = .primary
    /// Brouillon de saisie du champ longueur. Nécessaire car un binding qui
    /// n'accepte que des valeurs déjà valides rend le champ inutilisable :
    /// taper « 30 » commence par « 3 », rejeté, donc le champ revenait
    /// aussitôt à sa valeur précédente.
    @State private var lengthDraft: String = String(PasswordSettings.defaultLength)
    @FocusState private var lengthFieldFocused: Bool
    @State private var showRealKey: Bool = false
    // Auth biométrique valide pour la session : autorise l'édition de la
    // clé (en mode masqué ou révélé) ET la génération de mots de passe.
    // L'état réel de référence est `SessionLock` (horodatage persistant) : ce
    // @State n'en est que le reflet, réévalué à chaque activation de l'app.
    @State private var unlocked: Bool = false

    // UI
    @State private var showInfoSheet: Bool = false
    @State private var showNoPasswordAlert: Bool = false
    @State private var showVault: Bool = false
    @State private var vaultSaveMessage: String?
    /// Entrée du carnet pour le compte affiché (domaine + identifiant) : le
    /// bouton dit s'il crée une entrée ou met à jour celle qui existe.
    @State private var vaultEntry: VaultEntry?
    /// Proposition d'enregistrer au carnet un site qu'il ne connaît pas.
    @State private var showSaveProposal = false
    /// Comptes pour lesquels la proposition a été refusée, le temps de la
    /// session : la reposer à chaque copie la rendrait pénible.
    @State private var declinedProposals: Set<String> = []

    /// Clef maîtresse déjà dérivée, et la clef dont elle vient.
    ///
    /// PBKDF2 à 600 000 itérations coûte quelques centaines de millisecondes :
    /// la refaire à chaque frappe rendrait l'écran inutilisable.
    @State private var masterV2: Data? = nil
    @State private var masterV2For: String = ""
    /// Numéro de la dernière demande : une réponse en retard est ignorée.
    @State private var generationTicket = 0

    /// Bascule explicite vers l'ancien algorithme.
    ///
    /// La v2 est la règle ; la v1 ne sert qu'à retrouver un mot de passe posé
    /// sur un site avant qu'elle n'existe.
    /// Remis à v2 à chaque lancement : la v1 est une exception, et une
    /// exception qui survit à la fermeture se ferait oublier.
    @State private var useV1 = false
    /// Annonce du passage à la v2, en feuille modale à l'ouverture.
    ///
    /// Fermer la fait revenir la prochaine fois : seule la case à cocher la
    /// retire pour de bon. Une annonce qu'on n'a pas eu le temps de lire ne
    /// doit pas disparaître pour toujours.
    @AppStorage("v2NoticeSeen", store: UserDefaults(suiteName: appGroupID))
    var v2NoticeSeen: Bool = false

    @State private var showV2Notice = false

    /// Empreinte de la clef maîtresse.
    ///
    /// Une faute de frappe sur la clef ne se voit pas : elle produit un autre
    /// mot de passe, valide en apparence, et on ne s'en aperçoit qu'au refus
    /// de connexion. L'empreinte rend la clef reconnaissable sans la révéler.
    ///
    /// Le calcul passe par un KDF coûteux : il se fait hors du fil principal,
    /// et seulement quand la clef change.
    @State private var fingerprint: Fingerprint.Result? = nil
    /// Calcul en attente : chaque frappe annule le précédent.
    @State private var fingerprintWork: Task<Void, Never>? = nil

    private var fingerprintRow: some View {
        HStack(spacing: 8) {
            Text(L10n.t("Empreinte", "Fingerprint"))
                .font(.footnote)
                .foregroundColor(.secondary)

            if let fingerprint {
                Text(fingerprint.text)
                    .font(.footnote.monospaced())
                    .fontWeight(.semibold)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(fingerprint.color)
                    .foregroundColor(.white)
                    .cornerRadius(6)
            } else {
                ProgressView().controlSize(.small)
            }
        }
    }

    /// Recalcule l'empreinte, après une pause dans la frappe.
    ///
    /// Le calcul passe par PBKDF2 à 600 000 itérations : le lancer à chaque
    /// frappe fige la saisie. Chaque frappe annule la demande précédente ;
    /// seule la dernière, celle qui suit la pause, va au bout.
    private func refreshFingerprint(_ key: String) {
        fingerprintWork?.cancel()

        guard !key.isEmpty else {
            fingerprint = nil
            return
        }
        fingerprint = nil

        fingerprintWork = Task {
            try? await Task.sleep(nanoseconds: 400_000_000)
            guard !Task.isCancelled else { return }

            let computed = await Task.detached { Fingerprint.of(key) }.value
            guard !Task.isCancelled else { return }

            await MainActor.run {
                // La clef a pu changer pendant le calcul : une empreinte en
                // retard désignerait une autre clef que celle affichée.
                guard key == encodingKey else { return }
                fingerprint = computed
            }
        }
    }

    @State private var v2NoticeNeverAgain = false

    private var v2NoticeSheet: some View {
        let intro = L10n.t(
            "Les mots de passe se calculent désormais avec un nouvel algorithme "
                + "(v2). Veuillez migrer vos mots de passe dans ce nouvel algorithme.",
            "Passwords are now computed with a new algorithm (v2). Please migrate "
                + "your passwords to this new algorithm.")
        let detail = L10n.t(
            "Le remplissage automatique utilise le nouveau : pour un site que vous "
                + "n'avez pas encore mis à jour, générez le mot de passe en v1 depuis "
                + "l'application avec l'ancien algorithme.",
            "Autofill uses the new one: for a site you have not updated yet, "
                + "generate the password in v1 from the app with the old algorithm.")

        // Pas de ScrollView : elle n'a pas de hauteur propre, ce qui obligeait à
        // fixer celle de la fenêtre — d'où un grand vide sous un texte court.
        // La pile, elle, prend exactement la place de son contenu.
        return VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 16) {
                    // L'icône donne le ton avant le texte : c'est une nouvelle,
                    // pas une erreur.
                    HStack(spacing: 12) {
                        Image(systemName: "sparkles")
                            .font(.title2)
                            .foregroundColor(.accentColor)

                        Text(L10n.t("Nouvel algorithme", "New algorithm"))
                            .font(.title3)
                            .fontWeight(.semibold)
                    }

                    Text(intro)
                        .font(.callout)
                        .foregroundColor(.secondary)
                        .fixedSize(horizontal: false, vertical: true)

                    Text(detail)
                        .font(.callout)
                        .foregroundColor(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(24)

            Divider()

            VStack(spacing: 14) {
                Toggle(isOn: $v2NoticeNeverAgain) {
                    Text(L10n.t("Ne plus afficher", "Don't show again"))
                        .font(.callout)
                }

                Button {
                    // Seule la case retire l'annonce pour de bon.
                    if v2NoticeNeverAgain { v2NoticeSeen = true }
                    showV2Notice = false
                } label: {
                    Text(L10n.t("Fermer", "Close"))
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
            }
            .padding(24)
        }
        // Largeur fixe, hauteur libre : la fenêtre suit le texte, y compris
        // quand il est traduit ou agrandi par les réglages d'accessibilité.
        .frame(width: 460)
    }


    var body: some View {
        VStack(spacing: 0) {
            // Barre supérieure (titre + actions)
            HStack(spacing: 12) {
                Text("TheCode")
                    .font(.title2.bold())

                Spacer()

                Button(action: toggleTheme) {
                    Image(systemName: themeIconName)
                }
                .buttonStyle(.borderless)
                .help(L10n.t("Thème", "Theme"))

                Button(action: tapShare) {
                    Image(systemName: "square.and.arrow.up")
                }
                .buttonStyle(.borderless)
                .help(L10n.t("Partager", "Share"))

                // Le carnet a son propre verrou et partage la session de la
                // clef (voir vault-lock.md) : c'est lui qui demande le
                // déverrouillage, clef verrouillée ou non.
                Button(action: { showVault = true }) {
                    Image(systemName: "list.bullet.rectangle")
                }
                .buttonStyle(.borderless)
                .help(L10n.t("Carnet", "Vault"))

                // Le mode en cours se lit dans la barre, comme le thème :
                // c'est lui qui décide quel mot de passe sort.
                Button(action: { useV1.toggle() }) {
                    Text(useV1 ? "v1" : "v2")
                        .font(.footnote.weight(.bold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(useV1 ? AlgoTheme.v1Pink.opacity(0.25) : Color.clear)
                        .overlay(
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(AlgoTheme.tint(usesV1: useV1).opacity(0.6), lineWidth: 1))
                        .cornerRadius(6)
                }
                .buttonStyle(.borderless)
                .help(
                    useV1
                        ? L10n.t("Ancien algorithme (v1) — revenir à la v2",
                                 "Old algorithm (v1) — back to v2")
                        : L10n.t("Générer avec l'ancien algorithme (v1)",
                                 "Generate with the old algorithm (v1)"))

                Button(action: { showInfoSheet = true }) {
                    Image(systemName: "info.circle")
                }
                .buttonStyle(.borderless)
                .help(L10n.t("Information", "Information"))
            }
            .font(.title3)
            .padding(.horizontal)
            .padding(.vertical, 10)
            .background(.bar)

            Divider()

            // Contenu principal
            Form {
                Section(header: Text(L10n.t("Paramètres de l'application", "App settings"))) {
                    KeyFieldView(encodingKey: $encodingKey,
                                 showRealKey: $showRealKey,
                                 unlocked: $unlocked)

                    if !encodingKey.isEmpty {
                        fingerprintRow
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text(L10n.t("Longueur du mot de passe", "Password length"))
                        HStack {
                            Slider(value: Binding(
                                get: { Double(lengthNumber) },
                                set: { lengthNumber = Int($0) }
                            ),
                            in: Double(PasswordSettings.minLength)...Double(PasswordSettings.maxLength),
                            step: 1)

                            TextField("", text: $lengthDraft)
                                .frame(width: 50)
                                .textFieldStyle(RoundedBorderTextFieldStyle())
                                .multilineTextAlignment(.center)
                                .focused($lengthFieldFocused)
                                .onSubmit { commitLengthDraft() }
                        }
                    }

                    Toggle(L10n.t("Minuscules", "Lowercase"), isOn: $minState)
                    Toggle(L10n.t("Majuscules", "Uppercase"), isOn: $majState)
                    Toggle(L10n.t("Symboles", "Symbols"), isOn: $symState)
                    Toggle(L10n.t("Chiffres", "Digits"), isOn: $chiState)
                }

                Section(header: Text(L10n.t("Remplissage automatique", "AutoFill"))) {
                    Text(L10n.t(
                        "TheCode peut remplir vos mots de passe dans Safari et les apps. Activez-le dans Réglages Système → Mots de passe → Options, puis cochez TheCode.",
                        "TheCode can fill your passwords in Safari and apps. Enable it in System Settings → Passwords → Options, then tick TheCode."))
                        .foregroundColor(.secondary)
                        .fixedSize(horizontal: false, vertical: true)

                    Button(action: openAutoFillSettings) {
                        HStack {
                            Image(systemName: "key.fill")
                            Text(L10n.t("Ouvrir les réglages de mots de passe",
                                        "Open password settings"))
                        }
                    }
                }

                Section(header: Text(L10n.t("Générer un mot de passe pour un site", "Generate a password for a website"))) {
                    if unlocked {
                        TextField(L10n.t("Nom du site", "Website name"), text: $siteName)
                            .textFieldStyle(RoundedBorderTextFieldStyle())

                        TextField(L10n.t("Identifiant (facultatif)", "Login (optional)"),
                                  text: $loginName)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .disableAutocorrection(true)

                        // La v1 ne connaît que le site et la clef : le dire
                        // plutôt que de laisser croire que l'identifiant compte.
                        if useV1 && !loginName.isEmpty {
                            Text(L10n.t("L'identifiant n'est pas utilisé en v1.",
                                        "The login is not used in v1."))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        if !generatedValue.isEmpty {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    TextField(L10n.t("Valeur générée", "Generated value"), text: $generatedValue)
                                        .textFieldStyle(RoundedBorderTextFieldStyle())
                                        .disabled(true)

                                    Button(action: copyGeneratedValue) {
                                        Image(systemName: "doc.on.doc")
                                    }
                                    .buttonStyle(BorderlessButtonStyle())
                                    .padding(.leading, 8)
                                }
                                // La version en cours doit se lire sans ouvrir
                                // de menu : c'est elle qui décide quel mot de
                                // passe sort.
                                Text(
                                    L10n.t("Sécurité : ", "Security: ")
                                        + localizedSecurityLabel(securityLabel)
                                        + (useV1 ? "  ·  v1" : "  ·  v2"))
                                    .foregroundColor(securityColor)

                                Button(action: saveToVault) {
                                    Label(
                                        vaultEntry == nil
                                            ? L10n.t("Enregistrer les réglages au carnet",
                                                     "Save settings to vault")
                                            : L10n.t("Mettre à jour l'entrée du carnet",
                                                     "Update the vault entry"),
                                        systemImage: vaultEntry == nil
                                            ? "square.and.arrow.down"
                                            : "arrow.triangle.2.circlepath")
                                }
                                .buttonStyle(.bordered)
                                .padding(.top, 4)

                                if let vaultSaveMessage {
                                    Text(vaultSaveMessage)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .padding(.top, 4)
                        }
                    } else {
                        Button(action: authenticateForGeneration) {
                            HStack {
                                Image(systemName: "lock.fill")
                                Text(L10n.t("Authentifiez-vous pour générer un mot de passe",
                                            "Authenticate to generate a password"))
                            }
                        }
                    }
                }
            }
            .formStyle(.grouped)
            // Sur le Form : deux .alert sur une même vue ne s'affichent pas
            // toujours tous les deux.
            .alert(
                L10n.t("Enregistrer ce site dans le carnet ?", "Save this site to the vault?"),
                isPresented: $showSaveProposal
            ) {
                Button(L10n.t("Enregistrer", "Save")) { saveToVault() }
                Button(L10n.t("Pas maintenant", "Not now"), role: .cancel) {
                    declinedProposals.insert(
                        SaveProposal.key(site: siteName, login: trimmedLogin))
                }
            } message: {
                Text(saveProposalMessage)
            }
        }
        .frame(minWidth: 520, minHeight: 600)
        // Toute l'interface passe en rose en v1 : l'exception doit se voir.
        .tint(AlgoTheme.tint(usesV1: useV1))
        .preferredColorScheme(preferredScheme)
        .onAppear {
            if !v2NoticeSeen { showV2Notice = true }
            applyAppAppearance()
            restoreSession()
            lengthDraft = String(lengthNumber)
            refreshFingerprint(encodingKey)
            refreshVaultEntry()
        }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didResignActiveNotification)) { _ in
            // Dès qu'on bascule sur une autre app : re-masquage de la clé
            // pour qu'elle ne reste pas en clair dans une fenêtre visible en
            // arrière-plan, et effacement du mot de passe affiché. La session
            // d'auth n'est plus révoquée : on ré-horodate la fenêtre de grâce
            // pour qu'elle courre à partir de maintenant.
            showRealKey = false
            generatedValue = ""
            if unlocked { SessionLock.stamp() }
        }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            restoreSession()
        }
        .onChange(of: darkMode) { _ in applyAppAppearance() }
        .onChange(of: useV1) { _ in generatePassword() }
        .onChange(of: encodingKey) { newValue in
            SecureKeyStore.write(newValue)
            refreshFingerprint(newValue)
            generatePassword()
        }
        .onChange(of: lengthNumber) { newVal in
            // Le slider (ou un clamp) a bougé la valeur : on réaligne le champ.
            if lengthDraft != String(newVal) { lengthDraft = String(newVal) }
            PasswordSettings.touch(UserDefaults(suiteName: appGroupID))
            generatePassword()
        }
        .onChange(of: lengthDraft) { newVal in
            // Saisie complète et dans les bornes → appliquée immédiatement.
            if let val = Int(newVal), PasswordSettings.lengthRange.contains(val) {
                lengthNumber = val
            }
        }
        // Valide la saisie partielle ou hors bornes à la perte du focus.
        .onChange(of: lengthFieldFocused) { focused in
            if !focused { commitLengthDraft() }
        }
        .onChange(of: minState) { _ in
            PasswordSettings.touch(UserDefaults(suiteName: appGroupID))
            generatePassword()
        }
        .onChange(of: majState) { _ in
            PasswordSettings.touch(UserDefaults(suiteName: appGroupID))
            generatePassword()
        }
        .onChange(of: symState) { _ in
            PasswordSettings.touch(UserDefaults(suiteName: appGroupID))
            generatePassword()
        }
        .onChange(of: chiState) { _ in
            PasswordSettings.touch(UserDefaults(suiteName: appGroupID))
            generatePassword()
        }
        .onChange(of: siteName) { newSite in
            vaultSaveMessage = nil
            prefillLogin(for: newSite)
            refreshVaultEntry()
            generatePassword()
        }
        .onChange(of: loginName) { _ in
            vaultSaveMessage = nil
            refreshVaultEntry()
            generatePassword()
        }
        .sheet(isPresented: $showInfoSheet) {
            InfoSheet(isPresented: $showInfoSheet)
        }
        .sheet(isPresented: $showV2Notice) { v2NoticeSheet }
        // Au retour du carnet : la session est commune (vault-lock.md), le
        // déverrouiller a pu ouvrir la clef ou le verrouiller la refermer ; et
        // il a pu gagner ou perdre l'entrée affichée.
        .sheet(isPresented: $showVault, onDismiss: {
            restoreSession()
            refreshVaultEntry()
        }) {
            VaultScreen(masterKey: encodingKey, isPresented: $showVault)
        }
        .alert(L10n.t("Aucun mot de passe à partager", "No password to share"), isPresented: $showNoPasswordAlert) {
            Button("OK", role: .cancel) { }
        }
    }

    // MARK: - Réglages AutoFill

    /// Ouvre le volet Mots de passe des Réglages Système (où l'utilisateur
    /// active TheCode comme source de remplissage). Le deep-link direct n'est
    /// pas garanti selon les versions de macOS : on retombe sinon sur
    /// l'ouverture des Réglages Système.
    private func openAutoFillSettings() {
        let candidates = [
            "x-apple.systempreferences:com.apple.Passwords-Settings.extension",
            "x-apple.systempreferences:com.apple.preferences.password",
        ]
        for string in candidates {
            if let url = URL(string: string), NSWorkspace.shared.open(url) {
                return
            }
        }
        if let settings = NSWorkspace.shared.urlForApplication(
            withBundleIdentifier: "com.apple.systempreferences") {
            NSWorkspace.shared.open(settings)
        }
    }

    // MARK: - Thème

    private var preferredScheme: ColorScheme? {
        switch darkMode {
        case "DARK":  return .dark
        case "LIGHT": return .light
        default:      return nil
        }
    }

    private var themeIconName: String {
        switch darkMode {
        case "DARK":  return "moon.fill"
        case "LIGHT": return "sun.max.fill"
        default:      return "circle.lefthalf.filled"
        }
    }

    private func toggleTheme() {
        // Cycle SYSTEM → DARK → LIGHT → SYSTEM
        switch darkMode {
        case "SYSTEM": darkMode = "DARK"
        case "DARK":   darkMode = "LIGHT"
        default:       darkMode = "SYSTEM"
        }
    }

    private func applyAppAppearance() {
        // Applique l'apparence au chrome de la fenêtre (titre, contrôles).
        switch darkMode {
        case "DARK":  NSApp.appearance = NSAppearance(named: .darkAqua)
        case "LIGHT": NSApp.appearance = NSAppearance(named: .aqua)
        default:      NSApp.appearance = nil
        }
    }

    // MARK: - Partage

    private var shareText: String {
        String(format: L10n.t("Mon mot de passe pour %@ est :\n%@",
                              "My password for %@ is:\n%@"),
               siteName, generatedValue)
    }

    private func tapShare() {
        if generatedValue.isEmpty {
            showNoPasswordAlert = true
            return
        }
        let picker = NSSharingServicePicker(items: [shareText])
        if let contentView = NSApp.keyWindow?.contentView {
            picker.show(relativeTo: .zero, of: contentView, preferredEdge: .minY)
        }
    }


    /// Enregistre les réglages du site affiché.
    ///
    /// Le site est pris tel qu'il a été saisi : c'est lui qui a produit le mot
    /// de passe à l'écran, le canonicaliser ici enregistrerait des réglages
    /// sous une clef qui en produit un autre.
    private func saveToVault() {
        let site = siteName.trimmingCharacters(in: .whitespaces)
        guard !site.isEmpty else { return }

        // Le carnet n'admet que la v2 : enregistrer depuis l'écran réglé en v1
        // crée ou garde une entrée v2, jamais l'inverse.
        // Apparié sur domaine + identifiant : un autre compte du même site est
        // une autre entrée, puisque l'identifiant change le mot de passe.
        var vault = VaultStore.load()
        let entry = vault.upsert(
            site: site, login: trimmedLogin, length: lengthNumber,
            charset: Charset(
                lower: minState, upper: majState, symbols: symState, numbers: chiState))

        do {
            try VaultStore.save(vault)
        } catch {
            vaultSaveMessage = L10n.t(
                "Le carnet n'a pas pu être enregistré.", "The vault could not be saved.")
            return
        }
        let updated = vaultEntry != nil
        vaultEntry = entry

        // Une entrée existante garde son siteKey : le réécrire changerait un
        // mot de passe déjà en service. On le dit plutôt que de laisser croire
        // que le mot de passe affiché est celui de l'entrée.
        if entry.siteKey != site {
            vaultSaveMessage = L10n.t(
                "« \(site) » enregistré. Attention : cette entrée génère son mot de passe "
                    + "depuis « \(entry.siteKey) », pas depuis ce que vous avez saisi.",
                "\"\(site)\" saved. Careful: this entry generates its password from "
                    + "\"\(entry.siteKey)\", not from what you typed.")
        } else if updated {
            vaultSaveMessage = L10n.t(
                "Entrée « \(site) » mise à jour.", "\"\(site)\" entry updated.")
        } else {
            vaultSaveMessage = L10n.t(
                "« \(site) » enregistré au carnet.", "\"\(site)\" saved to the vault.")
        }
    }

    /// Relit l'entrée du compte affiché, appariée comme `Vault.upsert` : même
    /// domaine, même identifiant.
    private func refreshVaultEntry() {
        let site = siteName.trimmingCharacters(in: .whitespaces)
        let login = trimmedLogin
        vaultEntry = site.isEmpty
            ? nil
            : VaultStore.load().findAll(domain: site).first { ($0.login ?? "") == login }
    }

    // MARK: - Sécurité

    /// L'identifiant tel qu'il entre dans la dérivation et au carnet.
    private var trimmedLogin: String {
        loginName.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Reprend l'identifiant que le carnet connaît pour ce site.
    private func prefillLogin(for site: String) {
        let suggestion = VaultStore.load().suggestedLogin(for: site)
        loginName = Vault.prefilledLogin(
            typed: loginName, previousSuggestion: suggestedLogin, suggestion: suggestion)
        suggestedLogin = suggestion ?? ""
    }

    private func localizedSecurityLabel(_ frenchLabel: String) -> String {
        guard !L10n.isFrench else { return frenchLabel }
        switch frenchLabel {
        case "Aucune":      return "None"
        case "Très Faible": return "Very Weak"
        case "Faible":      return "Weak"
        case "Moyenne":     return "Medium"
        case "Forte":       return "Strong"
        case "Très Forte":  return "Very Strong"
        case "Erreur":      return "Error"
        default:            return frenchLabel
        }
    }

    // MARK: - Copie

    private func copyGeneratedValue() {
        let pb = NSPasteboard.general
        pb.clearContents()
        pb.setString(generatedValue, forType: .string)
        proposeSaveIfNeeded()
    }

    /// Propose d'enregistrer le site quand le mot de passe vient d'être copié.
    ///
    /// La copie est le moment où le mot de passe sert : proposer à chaque
    /// frappe interromprait la saisie du nom du site.
    private func proposeSaveIfNeeded() {
        showSaveProposal = SaveProposal.shouldPropose(
            site: siteName, login: trimmedLogin, in: VaultStore.load(),
            isLinked: SyncCredentialsStore.load() != nil, usesV1: useV1,
            declined: declinedProposals)
    }

    private var saveProposalMessage: String {
        let site = siteName.trimmingCharacters(in: .whitespaces)
        let shown = trimmedLogin.isEmpty ? site : "\(site) · \(trimmedLogin)"
        return L10n.t(
            "« \(shown) » n'est pas dans votre carnet. Ses réglages seront synchronisés "
                + "avec vos autres appareils, jamais le mot de passe.",
            "\"\(shown)\" is not in your vault. Its settings will sync to your other "
                + "devices, never the password.")
    }

    // MARK: - Génération

    private func authenticateForGeneration() {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication,
                                        error: &error) else {
            return
        }
        let reason = L10n.t("Authentifiez-vous pour générer un mot de passe",
                            "Authenticate to generate a password")
        context.evaluatePolicy(.deviceOwnerAuthentication,
                               localizedReason: reason) { success, _ in
            DispatchQueue.main.async {
                if success {
                    SessionLock.stamp()
                    unlocked = true
                }
            }
        }
    }

    /// Réévalue la session, exactement comme le fait l'application Android.
    ///
    /// La clef est remasquée à chaque retour, même avec une session valide :
    /// le déverrouillage autorise à la révéler, il ne la révèle pas.
    ///
    /// Le nom du site est conservé : ce n'est pas un secret, et le flux de
    /// déverrouillage par code passe par ce point avant que l'auth réussisse —
    /// l'effacer ferait perdre la saisie en cours.
    private func restoreSession() {
        // Remasquage inconditionnel, avant même de savoir si la session tient.
        showRealKey = false

        if SessionLock.isValid {
            SessionLock.stamp()
            unlocked = true
            generatePassword()
        } else {
            SessionLock.invalidate()
            unlocked = false
            generatedValue = ""
        }
    }

    /// Valide le brouillon : une saisie vide, partielle ou hors bornes est
    /// ramenée dans les limites plutôt que silencieusement ignorée.
    private func commitLengthDraft() {
        let clamped = PasswordSettings.clampLength(Int(lengthDraft) ?? lengthNumber)
        lengthNumber = clamped
        lengthDraft = String(clamped)
    }

    private func generatePassword() {
        // Verrou d'autorisation : pas de génération sans auth de session.
        guard unlocked else { return }
        if siteName.isEmpty || encodingKey.isEmpty || (!minState && !majState && !symState && !chiState) {
            return
        }

        let utils = PasswordUtils()
        utils.minState = minState
        utils.majState = majState
        utils.symState = symState
        utils.chiState = chiState
        utils.longueur = lengthNumber

        if useV1 {
            // La v1 est un simple SHA-256 : instantané, rien à déporter.
            let result = utils.generatePassword(input: siteName + encodingKey)
            generatedValue = result.code
            securityLabel = result.label
            securityColor = result.color
            return
        }

        generationTicket += 1
        let ticket = generationTicket
        let site = siteName
        let login = trimmedLogin
        let key = encodingKey
        let reuse = masterV2For == key ? masterV2 : nil

        Task.detached {
            let derived = reuse ?? (try? CoreV2.deriveMasterKey(key))
            let result = utils.generatePasswordV2(
                masterKey: key, siteKey: site, login: login, master: derived)

            await MainActor.run {
                // Une réponse arrivée après une frappe plus récente
                // afficherait le mot de passe d'un autre site.
                guard ticket == generationTicket else { return }
                if let derived {
                    masterV2 = derived
                    masterV2For = key
                }
                generatedValue = result.code
                securityLabel = result.label
                securityColor = result.color
            }
        }
    }
}

// MARK: - Information sheet

private struct InfoSheet: View {
    @Binding var isPresented: Bool

    private static let infoFR: String = """
TheCode est un gestionnaire de mots de passe libre et open-source qui ne stocke aucun mot de passe : il les régénère à la volée à partir d'une seule clé secrète que vous mémorisez.

Choisissez votre clé, entrez le nom du site (par exemple « google.com » pour votre compte Google), ajustez la longueur et les options (minuscules, majuscules, chiffres, symboles), et le mot de passe est généré. Pour le retrouver, il vous suffit de revenir avec la même clé et le même nom de site.

En interne, TheCode combine votre clé avec le nom du site et applique une fonction cryptographique (SHA-256). Le résultat est converti en un mot de passe robuste qui respecte vos critères. Même clé + même site = même mot de passe, à chaque fois, de manière déterministe.

Aucun mot de passe n'est jamais sauvegardé ni transmis : tous les calculs ont lieu localement, sans connexion internet, sans compte, sans pistage.

TheCode vous suit partout : extensions navigateur (Chrome, Firefox, Safari, Edge, Opera) et applications natives iOS et Android. Avec la même clé, vous retrouvez les mêmes mots de passe sur toutes vos plateformes.
"""

    private static let infoEN: String = """
TheCode is a free and open-source password manager that stores no passwords: it regenerates them on the fly from a single secret key that you remember.

Choose your key, enter the website name (for example « google.com » for your Google account), tweak the length and the options (lowercase, uppercase, digits, symbols), and the password is generated. To find it again, just come back with the same key and the same website name.

Internally, TheCode combines your key with the website name and applies a cryptographic function (SHA-256). The result is converted into a strong password that matches your criteria. Same key + same website = same password, every time, deterministically.

No password is ever saved or transmitted: every computation happens locally, with no internet connection, no account, no tracking.

TheCode follows you everywhere: browser extensions (Chrome, Firefox, Safari, Edge, Opera) and native iOS and Android apps. With the same key, you find the same passwords across all your platforms.
"""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(L10n.t("Information", "Information"))
                .font(.title2.bold())

            ScrollView {
                Text(L10n.t(Self.infoFR, Self.infoEN))
                    .font(.body)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
            }

            HStack {
                Spacer()
                Button("OK") { isPresented = false }
                    .keyboardShortcut(.defaultAction)
            }
        }
        .padding()
        .frame(minWidth: 520, minHeight: 480)
    }
}
