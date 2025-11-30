//
//  CredentialProviderViewController.swift
//  thecode-autofill
//
//  Created by Juliette Debono on 30/11/2025.
//

import AuthenticationServices
import LocalAuthentication

let appGroupID = "group.fr.julsql.thecode.params"

class CredentialProviderViewController: ASCredentialProviderViewController {
    
    override func prepareCredentialList(
        for serviceIdentifiers: [ASCredentialServiceIdentifier]
    ) {
        let domain = serviceIdentifiers.first?.identifier ?? "default"
        providePasswordIfAuthentificate(domainName: domain)
    }

    override func provideCredentialWithoutUserInteraction(for credentialIdentity: ASPasswordCredentialIdentity) {
        let domain = credentialIdentity.serviceIdentifier.identifier
        providePasswordIfAuthentificate(domainName: domain)
    }
    
    private func providePasswordIfAuthentificate(domainName: String) {
        authenticateUser { [weak self] success in
                guard success else {
                    // L'utilisateur n'a pas été authentifié
                    self?.extensionContext.cancelRequest(withError: NSError(domain: ASExtensionErrorDomain,
                                                                           code: ASExtensionError.userCanceled.rawValue))
                    return
                }
                // Auth réussi : générer et remplir le mot de passe
            self?.providePassword(domainName: domainName)
            }
    }

    private func providePassword(siteName: String) {
        let password = generatePassword(domainName: domainName)

        let credential = ASPasswordCredential(
            user: "",
            password: password
        )

        self.extensionContext.completeRequest(
            withSelectedCredential: credential,
            completionHandler: nil
        )
    }
    
    private func generatePassword(domainName: String) -> String {
        let defaults = UserDefaults(suiteName: appGroupID)
        let minState = defaults?.bool(forKey: "minState") ?? true
        let majState = defaults?.bool(forKey: "majState") ?? true
        let symState = defaults?.bool(forKey: "symState") ?? true
        let chiState = defaults?.bool(forKey: "chiState") ?? true
        let lengthNumber = defaults?.integer(forKey: "lengthNumber") ?? 20
        let encodingKey = defaults?.string(forKey: "encodingKey") ?? "Aucune valeur"
        
        if (domainName == "" || encodingKey == "" || (!minState && !majState && !symState && !chiState)) {
            return "";
        }
        
        let utils = PasswordUtils()
        utils.minState = minState
        utils.majState = majState
        utils.symState = symState
        utils.chiState = chiState
        utils.longueur = lengthNumber
        
        let result = utils.generatePassword(input: domainName + encodingKey)
        return result.code
    }

    override func prepareInterfaceToProvideCredential(for credentialIdentity: ASPasswordCredentialIdentity) {
        // Ne rien faire -> on n’affiche aucune UI
        // Et appeler directement provideCredentialWithoutUserInteraction
        provideCredentialWithoutUserInteraction(for: credentialIdentity)
    }
    
    private func authenticateUser(completion: @escaping (Bool) -> Void) {
        let context = LAContext()
        var error: NSError?

        // Vérifie si le dispositif supporte Face ID / Touch ID
        if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
            let reason = "Authentifiez-vous pour générer un mot de passe"

            context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, authError in
                DispatchQueue.main.async {
                    completion(success)
                }
            }
        } else {
            // Pas de biométrie disponible : on autorise ou pas selon le besoin
            DispatchQueue.main.async {
                completion(true)
            }
        }
    }

}
