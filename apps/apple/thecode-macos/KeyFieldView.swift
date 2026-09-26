//
//  KeyFieldView.swift
//  thecode-macos
//
//  Le champ clé a deux verrous distincts :
//   - `unlocked` : autorisation d'édition pour la session (persiste tant
//     que le process est en vie).
//   - `showRealKey` : autorisation d'affichage en clair (remis à zéro par
//     le parent dès que l'app perd l'activation, pour que la clé ne
//     reste pas visible quand on bascule sur une autre app).
//
//  Conséquences :
//   - Verrouillé : champ neutre désactivé. Un clic déclenche une auth
//     (Touch ID ou mot de passe de la session) qui passe en édition masquée.
//   - Déverrouillé + masqué : SecureField bindé sur la clé, éditable.
//   - Déverrouillé + révélé : TextField en clair.
//

import SwiftUI
import LocalAuthentication

struct KeyFieldView: View {
    @Binding var encodingKey: String
    @Binding var showRealKey: Bool
    @Binding var unlocked: Bool
    @FocusState private var focused: Bool
    /// Saisie masquée demandée : le `SecureField` doit exister avant de pouvoir
    /// recevoir le focus. L'attendre du focus lui-même ne marchait jamais, le
    /// champ affiché hors frappe étant désactivé et sans focus.
    @State private var editing = false

    var body: some View {
        HStack {
            Text(L10n.t("Clé", "Key")).font(.headline)

            field
                .onChange(of: focused) { _, isFocused in
                    if !isFocused { editing = false }
                }

            Button(action: handleEye) {
                Image(systemName: showRealKey ? "eye.slash.fill" : "eye.fill")
            }
            .frame(width: 30, height: 30)
            .buttonStyle(.plain)
            .fixedSize()
        }
    }

    @ViewBuilder
    private var field: some View {
        // Pas de placeholder côté macOS : le label « Clé » à gauche
        // suffit déjà à indiquer la nature du champ.
        let placeholder = ""
        if showRealKey {
            TextField(placeholder, text: $encodingKey)
                .textFieldStyle(RoundedBorderTextFieldStyle())
                .autocorrectionDisabled()
                .focused($focused)
        } else if (unlocked || encodingKey.isEmpty) && editing {
            // Pendant la frappe seulement : il faut bien que la saisie aille
            // quelque part. Hors frappe, on repasse au rendu neutre.
            SecureField(placeholder, text: $encodingKey)
                .textFieldStyle(RoundedBorderTextFieldStyle())
                .focused($focused)
        } else {
            maskedField
        }
    }

    /// Rendu masqué, identique qu'on soit verrouillé ou non.
    ///
    /// Toujours le même nombre de points, jamais corrélé à la vraie clef : le
    /// `SecureField` en affiche autant que de caractères saisis, ce qui
    /// révélait la longueur de la clef dès qu'on la masquait après
    /// déverrouillage.
    ///
    /// Le `SecureField` ne sert donc que pendant la frappe, quand le champ a
    /// le focus : il faut bien que la saisie aille quelque part.
    private var maskedField: some View {
        TextField(
            "",
            text: .constant(encodingKey.isEmpty ? "" : String(repeating: "•", count: 10))
        )
        .textFieldStyle(RoundedBorderTextFieldStyle())
        .disabled(true)
        // Un champ désactivé ne reçoit pas les clics : c'est ce calque qui les
        // prend, pour ouvrir la saisie masquée.
        .overlay(
            Color.clear
                .contentShape(Rectangle())
                .onTapGesture(perform: startEditing)
        )
    }

    private func startEditing() {
        // Sans clef, il n'y a rien à protéger : pas d'authentification pour la
        // première saisie.
        guard unlocked || encodingKey.isEmpty else {
            authenticate(thenReveal: false)
            return
        }
        editing = true
        DispatchQueue.main.async { focused = true }
    }

    private func handleEye() {
        if showRealKey {
            showRealKey = false
            return
        }
        if unlocked {
            showRealKey = true
            return
        }
        authenticate(thenReveal: true)
    }

    private func authenticate(thenReveal reveal: Bool) {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication,
                                        error: &error) else {
            return
        }
        let reason = reveal
            ? L10n.t("Authentifiez-vous pour afficher la clé",
                     "Authenticate to view the key")
            : L10n.t("Authentifiez-vous pour modifier la clé",
                     "Authenticate to edit the key")
        context.evaluatePolicy(.deviceOwnerAuthentication,
                               localizedReason: reason) { success, _ in
            DispatchQueue.main.async {
                guard success else { return }
                SessionLock.stamp()
                unlocked = true
                if reveal {
                    showRealKey = true
                } else {
                    startEditing()
                }
            }
        }
    }
}
