//
//  KeyField.swift
//  thecode-extension-ios
//
//  Created by Jul SQL on 28/09/2025.
//
//  Le champ clé a deux verrous distincts :
//   - `unlocked` : autorisation d'édition pour la session (persiste tant
//     que le process est en vie ; remis à zéro automatiquement quand l'app
//     est tuée puisque le @State du parent disparaît avec elle).
//   - `showRealKey` : autorisation d'affichage en clair (remis à zéro par
//     le parent dès que l'app passe en arrière-plan, pour que le snapshot
//     du sélecteur d'apps ne capture jamais la clé).
//
//  Conséquences :
//   - Verrouillé : SecureField désactivé, juste des points. Un tap
//     déclenche une auth qui passe en mode édition masquée (sans révéler).
//   - Déverrouillé + masqué : SecureField bindé sur la clé, éditable. Le
//     contenu reste affiché en points pendant la frappe.
//   - Déverrouillé + révélé : TextField en clair.
//

import SwiftUI
import LocalAuthentication

struct KeyFieldView: View {
    @Binding var encodingKey: String
    @Binding var showRealKey: Bool
    @Binding var unlocked: Bool
    @FocusState private var focused: Bool

    var body: some View {
        HStack {
            Text(L10n.t("Clé", "Key")).font(.headline)

            field
                .contentShape(Rectangle())
                .onTapGesture {
                    if unlocked {
                        // Le champ masqué n'est pas éditable : il faut lui
                        // donner le focus pour faire apparaître la saisie.
                        focused = true
                    } else {
                        authenticate(thenReveal: false)
                    }
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
        let placeholder = L10n.t("Aucune clef renseignée", "No key set")
        if showRealKey {
            TextField(placeholder, text: $encodingKey)
                .textFieldStyle(RoundedBorderTextFieldStyle())
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .focused($focused)
        } else if unlocked && focused {
            // Pendant la frappe seulement : il faut bien que la saisie aille
            // quelque part. Hors frappe, on repasse au rendu neutre.
            SecureField(placeholder, text: $encodingKey)
                .textFieldStyle(RoundedBorderTextFieldStyle())
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
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
            L10n.t("Aucune clef renseignée", "No key set"),
            text: .constant(encodingKey.isEmpty ? "" : String(repeating: "•", count: 10))
        )
        .textFieldStyle(RoundedBorderTextFieldStyle())
        .disabled(true)
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
                    // Le SecureField éditable n'existe dans la hiérarchie
                    // qu'après que `unlocked` ait été mis à true. On
                    // décale le focus d'un tick pour que SwiftUI ait
                    // monté la nouvelle vue avant qu'on ne tente de la
                    // focaliser.
                    DispatchQueue.main.async { focused = true }
                }
            }
        }
    }
}
