import SafariServices

let appGroupID = "group.fr.julsql.thecode.params"

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        guard let item = context.inputItems.first as? NSExtensionItem else {
            respond(context: context, payload: ["error": "Pas d'item reçu"])
            return
        }

        // Manifest V3 → Safari envoie un dictionnaire sous SFExtensionMessageKey
        guard let message = item.userInfo?[SFExtensionMessageKey] as? [String: Any] else {
            respond(context: context, payload: ["error": "Message vide ou non décodable"])
            return
        }

        // Pour debug : affiche tout le message
        print("📩 Message brut reçu :", message)
        
        // Récupère l'action envoyée
        guard let action = message["action"] as? String else {
            respond(context: context, payload: ["error": "Clé 'message' absente ou mal typée"])
            return
        }

        print("📩 Action reçue :", action)

        switch action {
        case "getSharedValues":
            let defaults = UserDefaults(suiteName: appGroupID)
            let minState = defaults?.bool(forKey: "minState") ?? true
            let majState = defaults?.bool(forKey: "majState") ?? true
            let symState = defaults?.bool(forKey: "symState") ?? true
            let chiState = defaults?.bool(forKey: "chiState") ?? true
            let lengthNumber = defaults?.integer(forKey: "lengthNumber") ?? 20
            let encodingKey = defaults?.string(forKey: "encodingKey") ?? "Aucune valeur"
            respond(context: context, payload: [
                "minState": minState,
                "majState": majState,
                "symState": symState,
                "chiState": chiState,
                "lenghtNumber": lengthNumber,
                "encodingKey": encodingKey,
            ])

        default:
            respond(context: context, payload: ["error": "Action inconnue: \(action)"])
        }
    }

    private func respond(context: NSExtensionContext, payload: [String: Any]) {
        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: payload]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
}

enum SharedKey: String, CaseIterable {
    case minState
    case majState
    case symState
    case chiState
    case lenghtNumber
    case encodingKey
}
