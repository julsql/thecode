//
//  MainView.swift
//  thecode-extension-ios
//
//  Created by Juliette Debono on 27/09/2025.
//

import SwiftUI
import LocalAuthentication

struct MainView: View {
    // Paramètres globaux
    @AppStorage("encodingKey", store: UserDefaults(suiteName: appGroupID)) var encodingKey: String = ""
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
    @State private var lengthText: String = "20"
    
    // key editing / visibility
    @State private var showRealKey: Bool = false
    
    @Environment(\.scenePhase) private var scenePhase
    
    var utils: PasswordUtils {
        var u = PasswordUtils()
        u.minState = minState
        u.majState = majState
        u.symState = symState
        u.chiState = chiState
        u.longueur = lengthNumber
        u.modifBase() // construit la base dynamique selon les options
        return u
    }
    
    var body: some View {
        NavigationView {
            Form {
                // Paramètres globaux existants
                Section(header: Text("Paramètres de l'application")) {
                    
                    KeyFieldView(encodingKey: $encodingKey, showRealKey: $showRealKey)
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Longueur du mot de passe")
                            .font(.headline)
                        
                        HStack {
                            Slider(value: Binding(
                                get: { Double(lengthNumber) },
                                set: { newVal in
                                    lengthNumber = Int(newVal)
                                    lengthText = String(lengthNumber)
                                }
                            ), in: 4...40, step: 1)
                            
                            TextField("",
                                      text: Binding(
                                        get: { String(lengthNumber) },
                                        set: { newVal in
                                            if let val = Int(newVal), (4...40).contains(val) {
                                                lengthNumber = val
                                            }
                                        }
                                      ))
                            .frame(width: 50)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .keyboardType(.numberPad)
                        }
                    }
                    
                    Toggle("Minuscules", isOn: $minState)
                    Toggle("Majuscules", isOn: $majState)
                    Toggle("Symboles", isOn: $symState)
                    Toggle("Chiffres", isOn: $chiState)
                }
                
                Section(header: Text("Générer un mot de passe pour un site")) {
                    TextField("Nom du site", text: $siteName)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                    
                    if !generatedValue.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                TextField("Valeur générée", text: $generatedValue)
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
                            Text("Sécurité : " + securityLabel)
                                .foregroundColor(securityColor)
                                .foregroundColor(.secondary)
                        }
                        .padding(.top, 4)
                    }
                }
            }
            .navigationTitle("TheCode")
            .onChange(of: scenePhase) { newPhase in
                if newPhase != .active {
                    // L'utilisateur a quitté l'app
                    showRealKey = false
                    siteName = ""
                    generatedValue = ""
                }
            }
        }
        .onChange(of: encodingKey) { _ in generatePassword() }
        .onChange(of: lengthNumber) { _ in generatePassword() }
        .onChange(of: minState) { _ in generatePassword() }
        .onChange(of: majState) { _ in generatePassword() }
        .onChange(of: symState) { _ in generatePassword() }
        .onChange(of: chiState) { _ in generatePassword() }
        .onChange(of: siteName) { _ in generatePassword() }
    }
    
    private func generatePassword() {
        if (siteName == "" || encodingKey == "" || (!minState && !majState && !symState && !chiState)) {
            return;
        }
        
        var utils = PasswordUtils()
        utils.minState = minState
        utils.majState = majState
        utils.symState = symState
        utils.chiState = chiState
        utils.longueur = lengthNumber
        utils.modifBase()
        
        let result = utils.modification(siteName + encodingKey)
        generatedValue = result.code
        securityLabel = result.label
        securityColor = result.color
    }
    
}
