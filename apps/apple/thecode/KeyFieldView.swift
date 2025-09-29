//
//  KeyField.swift
//  thecode-extension-ios
//
//  Created by Juliette Debono on 28/09/2025.
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
            Text("Clé").font(.headline)
            
            HStack {
                if isEditing {
                    if showRealKey {
                        TextField("Entrez la clé", text: $encodingKey, onCommit: endEditiing)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .focused($focused)
                            .onAppear { focused = true }
                    } else {
                        SecureField("Entrez la clé", text: $editingBuffer, onCommit: commitEdit)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .focused($focused)
                            .onAppear { focused = true }
                    }
                } else {
                    if showRealKey {
                        TextField("Aucune clef renseignée", text: .constant(encodingKey))
                            .disabled(true)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                    } else {
                        SecureField("Aucune clef renseignée", text: .constant(encodingKey.isEmpty ? "" : String(repeating: "•", count: 10)))
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
    
    private func endEditiing() {
        isEditing = false
    }
    
    private func authenticateThenReveal() {
        let context = LAContext()
        var error: NSError?
        if showRealKey {
            showRealKey = false
        } else {
            if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
                let reason = "Authentifiez-vous pour afficher la clé"
                context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, evalError in
                    DispatchQueue.main.async {
                        if success {
                            showRealKey = true
                            authError = nil
                        } else {
                            authError = "Authentification échouée"
                            showRealKey = false
                        }
                    }
                }
            } else {
                authError = "Biométrie non disponible"
            }
        }
    }
}
