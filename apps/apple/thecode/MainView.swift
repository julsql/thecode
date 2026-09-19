//
//  MainView.swift
//  thecode-extension-ios
//
//  Created by Jul SQL on 27/09/2025.
//

import SwiftUI
import LocalAuthentication
import AuthenticationServices

// MARK: - Localisation (FR si appareil en français, EN sinon par défaut)

enum L10n {
    // On lit `Locale.preferredLanguages` (la liste des langues choisies par
    // l'utilisateur dans Réglages → Général → Langue) plutôt que `Locale.current`,
    // qui est résolue contre les localizations déclarées par l'app : sans bundle
    // .lproj/CFBundleLocalizations, iOS retomberait toujours sur la langue de
    // développement (en) — d'où l'app en anglais sur un téléphone français.
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
    
    // UI state
    @State private var siteName: String = ""
    @State private var generatedValue: String = ""
    @State private var securityLabel: String = ""
    @State private var securityColor: Color = .black
    /// Brouillon de saisie du champ longueur. Nécessaire car un binding qui
    /// n'accepte que des valeurs déjà valides rend le champ inutilisable :
    /// taper « 30 » commence par « 3 », rejeté, donc le champ revenait
    /// aussitôt à sa valeur précédente.
    @State private var lengthDraft: String = String(PasswordSettings.defaultLength)
    @FocusState private var lengthFieldFocused: Bool
    
    // key editing / visibility
    @State private var showRealKey: Bool = false
    // Auth biométrique valide pour la session : autorise l'édition de la
    // clé (en mode masqué ou révélé) ET la génération de mots de passe.
    // L'état réel de référence est `SessionLock` (horodatage persistant) : ce
    // @State n'en est que le reflet, réévalué à chaque passage en .active.
    @State private var unlocked: Bool = false

    // Statut du remplissage automatique
    @State private var autofillEnabled: Bool = false

    // Réglages (thème, partage, information)
    @AppStorage("darkMode", store: UserDefaults(suiteName: appGroupID)) var darkMode: String = "SYSTEM"
    @State private var showShareSheet: Bool = false
    @State private var showInfoSheet: Bool = false
    @State private var showNoPasswordAlert: Bool = false
    @State private var showVault: Bool = false
    @State private var vaultSaveMessage: String?

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
            "Les mots de passe se calculent désormais avec un nouvel algorithme (v2). Ceux "
                + "déjà posés sur vos sites viennent de l'ancien et n'ont pas changé.",
            "Passwords are now computed with a new algorithm (v2). The ones already set on "
                + "your sites came from the old one and have not changed.")
        let detail = L10n.t(
            "Le remplissage automatique utilise le nouveau. Pour un site que vous n'avez pas "
                + "encore mis à jour, générez avec l'ancien (v1) depuis la barre d'outils, ou "
                + "passez l'entrée en v2 depuis le carnet après avoir changé le mot de passe "
                + "sur le site.",
            "Autofill uses the new one. For a site you have not updated yet, generate with "
                + "the old algorithm (v1) from the toolbar, or move the entry to v2 from the "
                + "vault once you have changed the password on the site.")

        return VStack(spacing: 0) {
            ScrollView {
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
            }

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
        .modifier(V2NoticeSizing())
    }




    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.colorScheme) private var colorScheme
    
    var body: some View {
        NavigationView {
            Form {
                // Paramètres globaux existants
                Section(header: Text(L10n.t("Paramètres de l'application", "App settings"))) {
                    
                    KeyFieldView(encodingKey: $encodingKey,
                                 showRealKey: $showRealKey,
                                 unlocked: $unlocked)

                    if !encodingKey.isEmpty {
                        fingerprintRow
                    }
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text(L10n.t("Longueur du mot de passe", "Password length"))
                            .font(.headline)
                        
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
                                .keyboardType(.numberPad)
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

                Section(header: Text(L10n.t("Remplissage automatique", "Autofill"))) {
                    HStack(spacing: 10) {
                        Circle()
                            .fill(autofillStatusColor)
                            .frame(width: 10, height: 10)
                        Text(autofillStatusText)
                            .foregroundColor(.primary)
                    }

                    Button(action: openAutofillSettings) {
                        HStack {
                            Image(systemName: "key.fill")
                            Text(autofillEnabled
                                 ? L10n.t("Ouvrir les paramètres", "Open settings")
                                 : L10n.t("Activer le remplissage automatique", "Enable autofill"))
                        }
                    }
                }

                Section(header: Text(L10n.t("Générer un mot de passe pour un site", "Generate a password for a website"))) {
                    if unlocked {
                        TextField(L10n.t("Nom du site", "Website name"), text: $siteName)
                            .textFieldStyle(RoundedBorderTextFieldStyle())

                        if !generatedValue.isEmpty {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    TextField(L10n.t("Valeur générée", "Generated value"), text: $generatedValue)
                                        .textFieldStyle(RoundedBorderTextFieldStyle())
                                        .disabled(true)

                                    Button(action: {
                                        UIPasteboard.general.string = generatedValue
                                    }) {
                                        Image(systemName: "doc.on.doc") // icône “copier”
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
                                    .foregroundColor(.secondary)

                                Button(action: saveToVault) {
                                    HStack {
                                        Image(systemName: "square.and.arrow.down")
                                        Text(L10n.t("Enregistrer les réglages au carnet",
                                                    "Save settings to vault"))
                                    }
                                }
                                .padding(.top, 4)

                                if let vaultSaveMessage {
                                    Text(vaultSaveMessage)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
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
            .navigationTitle("TheCode")
            .toolbar {
                ToolbarItemGroup(placement: .navigationBarTrailing) {
                    Button(action: toggleTheme) {
                        Image(systemName: themeIconName)
                    }
                    .accessibilityLabel(L10n.t("Thème", "Theme"))

                    Button(action: tapShare) {
                        Image(systemName: "square.and.arrow.up")
                    }
                    .accessibilityLabel(L10n.t("Partager", "Share"))

                    // Le carnet dit sur quels sites on a un compte et sous
                    // quel identifiant : aussi sensible qu'un coffre de mots
                    // de passe, donc jamais accessible sans authentification.
                    Button(action: { if unlocked { showVault = true } }) {
                        Image(systemName: "list.bullet.rectangle")
                    }
                    .accessibilityLabel(L10n.t("Carnet", "Vault"))
                    .disabled(!unlocked)

                    // Le mode en cours se lit dans la barre, comme le thème :
                    // c'est lui qui décide quel mot de passe sort.
                    Button(action: { useV1.toggle() }) {
                        Text(useV1 ? "v1" : "v2")
                            .font(.footnote.weight(.bold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(useV1 ? Color.orange.opacity(0.25) : Color.clear)
                            .overlay(
                                RoundedRectangle(cornerRadius: 6)
                                    .stroke(Color.accentColor.opacity(0.6), lineWidth: 1))
                            .cornerRadius(6)
                    }
                    .accessibilityLabel(
                        useV1
                            ? L10n.t("Ancien algorithme — revenir à la v2",
                                     "Old algorithm — back to v2")
                            : L10n.t("Algorithme actuel — passer en v1",
                                     "Current algorithm — switch to v1"))

                    Button(action: { showInfoSheet = true }) {
                        Image(systemName: "info.circle")
                    }
                    .accessibilityLabel(L10n.t("Information", "Information"))
                }
            }
            .onAppear {
                if !v2NoticeSeen { showV2Notice = true }
                // Le trousseau peut n'avoir rien rendu au moment où la vue a
                // été construite ; on retente plutôt que de laisser un champ
                // vide qui effacerait la clef à la première frappe.
                if encodingKey.isEmpty { encodingKey = SecureKeyStore.read() }
                refreshAutofillStatus()
                restoreSession()
                lengthDraft = String(lengthNumber)
            refreshFingerprint(encodingKey)
            }
            .onChange(of: scenePhase) { newPhase in
                if newPhase == .active {
                    refreshAutofillStatus()
                    restoreSession()
                } else {
                    // L'utilisateur a quitté l'app (ou a juste ouvert le
                    // sélecteur d'apps). On masque la clé et le mot de passe
                    // pour que le snapshot ne les capture pas. La session
                    // d'auth n'est plus révoquée : on ré-horodate la fenêtre
                    // de grâce pour qu'elle courre à partir de maintenant.
                    showRealKey = false
                    generatedValue = ""
                    if unlocked { SessionLock.stamp() }
                }
            }
            .sheet(isPresented: $showShareSheet) {
                ActivityView(activityItems: [shareText])
            }
            .sheet(isPresented: $showInfoSheet) {
                InfoSheet(isPresented: $showInfoSheet)
            }
            .sheet(isPresented: $showV2Notice) { v2NoticeSheet }
        .sheet(isPresented: $showVault) {
                VaultScreen(masterKey: encodingKey, isPresented: $showVault)
            }
            .alert(L10n.t("Aucun mot de passe à partager", "No password to share"), isPresented: $showNoPasswordAlert) {
                Button("OK", role: .cancel) { }
            }
        }
        .onChange(of: siteName) { _ in vaultSaveMessage = nil }
        .onChange(of: useV1) { _ in generatePassword() }
        .onChange(of: encodingKey) { newValue in
            SecureKeyStore.write(newValue)
            refreshFingerprint(newValue)
            generatePassword()
        }
        .onChange(of: lengthNumber) { newVal in
            // Le slider (ou un clamp) a bougé la valeur : on réaligne le champ.
            if lengthDraft != String(newVal) { lengthDraft = String(newVal) }
            generatePassword()
        }
        .onChange(of: lengthDraft) { newVal in
            // Saisie complète et dans les bornes → appliquée immédiatement.
            if let val = Int(newVal), PasswordSettings.lengthRange.contains(val) {
                lengthNumber = val
            }
        }
        // Le pavé numérique n'a pas de touche retour : on valide la saisie
        // partielle ou hors bornes quand le champ perd le focus.
        .onChange(of: lengthFieldFocused) { focused in
            if !focused { commitLengthDraft() }
        }
        .onChange(of: minState) { _ in generatePassword() }
        .onChange(of: majState) { _ in generatePassword() }
        .onChange(of: symState) { _ in generatePassword() }
        .onChange(of: chiState) { _ in generatePassword() }
        .onChange(of: siteName) { _ in generatePassword() }
    }
    
    private var autofillStatusText: String {
        autofillEnabled
            ? L10n.t("Activé pour cet appareil", "Active on this device")
            : L10n.t("Désactivé — touchez pour configurer", "Disabled — tap to set up")
    }


    /// Enregistre les réglages du site affiché.
    ///
    /// Le site est pris tel qu'il a été saisi : c'est lui qui a produit le mot
    /// de passe à l'écran, le canonicaliser ici enregistrerait des réglages
    /// sous une clef qui en produit un autre.
    private func saveToVault() {
        let site = siteName.trimmingCharacters(in: .whitespaces)
        guard !site.isEmpty else { return }

        var vault = VaultStore.load()
        var entry = vault.upsert(
            site: site, length: lengthNumber,
            charset: Charset(
                lower: minState, upper: majState, symbols: symState, numbers: chiState))

        // Enregistrer un mot de passe généré en v1 sous une entrée v2 donnerait
        // un autre mot de passe à la relecture.
        if let index = vault.entries.firstIndex(where: { $0.id == entry.id }) {
            vault.entries[index].v = useV1 ? 1 : 2
            entry = vault.entries[index]
        }

        do {
            try VaultStore.save(vault)
        } catch {
            vaultSaveMessage = L10n.t(
                "Le carnet n'a pas pu être enregistré.", "The vault could not be saved.")
            return
        }

        // Une entrée existante garde son siteKey : le réécrire changerait un
        // mot de passe déjà en service. On le dit plutôt que de laisser croire
        // que le mot de passe affiché est celui de l'entrée.
        vaultSaveMessage =
            entry.siteKey == site
            ? L10n.t("« \(site) » enregistré au carnet.", "\"\(site)\" saved to the vault.")
            : L10n.t(
                "« \(site) » enregistré. Attention : cette entrée génère son mot de passe "
                    + "depuis « \(entry.siteKey) », pas depuis ce que vous avez saisi.",
                "\"\(site)\" saved. Careful: this entry generates its password from "
                    + "\"\(entry.siteKey)\", not from what you typed.")
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

    private var autofillStatusColor: Color {
        autofillEnabled ? .green : .red
    }

    private func refreshAutofillStatus() {
        ASCredentialIdentityStore.shared.getState { state in
            DispatchQueue.main.async {
                self.autofillEnabled = state.isEnabled
            }
        }
    }

    // MARK: - Réglages (thème / partage / information)

    private var themeIconName: String {
        switch darkMode {
        case "DARK":  return "moon.fill"
        case "LIGHT": return "sun.max.fill"
        default:      return "circle.lefthalf.filled"
        }
    }

    private func toggleTheme() {
        // Cycle : SYSTEM → DARK → LIGHT → SYSTEM. On garde SYSTEM atteignable
        // pour permettre de revenir au mode par défaut (suivre le système).
        switch darkMode {
        case "SYSTEM": darkMode = "DARK"
        case "DARK":   darkMode = "LIGHT"
        default:       darkMode = "SYSTEM"
        }
    }

    private var shareText: String {
        String(format: L10n.t("Mon mot de passe pour %@ est :\n%@",
                              "My password for %@ is:\n%@"),
               siteName, generatedValue)
    }

    private func tapShare() {
        if generatedValue.isEmpty {
            showNoPasswordAlert = true
        } else {
            showShareSheet = true
        }
    }

    private func openAutofillSettings() {
        if #available(iOS 17.0, *) {
            Task { try? await ASSettingsHelper.openCredentialProviderAppSettings() }
        } else if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
    }

    private func authenticateForGeneration() {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics,
                                        error: &error) else {
            return
        }
        let reason = L10n.t("Authentifiez-vous pour générer un mot de passe",
                            "Authenticate to generate a password")
        context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics,
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
        // Les bindings @AppStorage continuent de notifier les onChange,
        // mais on s'arrête ici tant que l'utilisateur ne s'est pas
        // authentifié.
        guard unlocked else { return }
        if (siteName == "" || encodingKey == "" || (!minState && !majState && !symState && !chiState)) {
            return;
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
        let key = encodingKey
        let reuse = masterV2For == key ? masterV2 : nil

        Task.detached {
            let derived = reuse ?? (try? CoreV2.deriveMasterKey(key))
            let result = utils.generatePasswordV2(
                masterKey: key, siteKey: site, master: derived)

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

// MARK: - Share sheet (UIActivityViewController bridge pour iOS 15+)

private struct ActivityView: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) { }
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
        NavigationView {
            ScrollView {
                Text(L10n.t(Self.infoFR, Self.infoEN))
                    .font(.body)
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .navigationTitle(L10n.t("Information", "Information"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("OK") { isPresented = false }
                }
            }
        }
    }
}

/// Borne la hauteur de la feuille d'annonce.
///
/// Une feuille iOS occupe tout l'écran par défaut, ce qui est beaucoup pour
/// trois phrases. `presentationDetents` n'existe qu'à partir d'iOS 16, et la
/// cible de déploiement est iOS 15 : sans ce garde, l'app ne compilerait pas
/// pour les appareils les plus anciens.
private struct V2NoticeSizing: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 16.0, *) {
            content.presentationDetents([.medium, .large])
        } else {
            content
        }
    }
}
