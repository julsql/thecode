//
//  KeyFieldView.swift
//  thecode-macos
//

import SwiftUI
import LocalAuthentication

struct KeyFieldView: View {
    @Binding var encodingKey: String
    @Binding var showRealKey: Bool
    @State private var isEditing: Bool = false
    @State private var editingBuffer: String = ""
    @State private var authError: String? = nil
    @FocusState private var focused: Bool

    var body: some View {
        HStack {
            Text(L10n.t("Clé", "Key")).font(.headline)

            HStack {
                if isEditing {
                    if showRealKey {
                        TextField(L10n.t("Entrez la clé", "Enter the key"), text: $encodingKey, onCommit: endEditing)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .focused($focused)
                            .onAppear { focused = true }
                    } else {
                        SecureField(L10n.t("Entrez la clé", "Enter the key"), text: $editingBuffer, onCommit: commitEdit)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .focused($focused)
                            .onAppear { focused = true }
                    }
                } else {
                    if showRealKey {
                        TextField(L10n.t("Aucune clef renseignée", "No key set"), text: .constant(encodingKey))
                            .disabled(true)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                    } else {
                        SecureField(L10n.t("Aucune clef renseignée", "No key set"), text: .constant(encodingKey.isEmpty ? "" : String(repeating: "•", count: 10)))
                            .disabled(true)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                    }
                }
            }
            .contentShape(Rectangle())
            .onTapGesture {
                if !isEditing {
                    isEditing = true
                    editingBuffer = ""
                    authError = nil
                }
            }

            HStack {
                if isEditing {
                    Button("OK") { commitEdit() }
                } else {
                    Button(action: authenticateThenReveal) {
                        Image(systemName: showRealKey ? "eye.slash.fill" : "eye.fill")
                    }
                    .frame(width: 30, height: 30)
                    .buttonStyle(.plain)
                    .fixedSize()
                }
            }
            .frame(width: 30, height: 30)
        }
    }

    private func commitEdit() {
        encodingKey = editingBuffer
        isEditing = false
        showRealKey = false
    }

    private func endEditing() {
        isEditing = false
    }

    private func authenticateThenReveal() {
        let context = LAContext()
        var error: NSError?
        if showRealKey {
            showRealKey = false
            return
        }
        if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
            let reason = L10n.t("Authentifiez-vous pour afficher la clé",
                                "Authenticate to reveal the key")
            context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, _ in
                DispatchQueue.main.async {
                    if success {
                        showRealKey = true
                        authError = nil
                    } else {
                        authError = L10n.t("Authentification échouée", "Authentication failed")
                        showRealKey = false
                    }
                }
            }
        } else {
            authError = L10n.t("Biométrie non disponible", "Biometrics not available")
        }
    }
}
