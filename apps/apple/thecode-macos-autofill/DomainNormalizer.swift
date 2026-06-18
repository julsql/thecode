//
//  DomainNormalizer.swift
//  thecode-macos-autofill
//
//  Aligné sur la fonction `getRegistrableDomain` des extensions Safari :
//  on charge la même Public Suffix List depuis le bundle de l'extension
//  et on l'applique au serviceIdentifier reçu de macOS, qu'il soit URL
//  ou domaine, pour qu'instagram.com et www.instagram.com produisent
//  le même mot de passe.
//

import Foundation
import AuthenticationServices

/// Marqueur servant à localiser le bundle de l'extension sans dépendre d'une
/// classe métier (`DomainNormalizer` est un enum, or `Bundle(for:)` exige une
/// classe). Rend la normalisation testable en isolation.
private final class BundleToken {}

enum DomainNormalizer {

    /// Chargée une seule fois au premier accès. Lecture synchrone d'un
    /// fichier bundlé : pas de course possible avec la génération.
    private static let publicSuffixes: Set<String> = loadPublicSuffixes()

    /// Tente plusieurs chemins de bundle pour récupérer la PSL. Xcode 16
    /// (synchronized file system groups) place les ressources d'un
    /// `explicitFolders` à des emplacements différents selon le target —
    /// sur certains builds iOS le `.dat` se retrouve directement à la
    /// racine du bundle au lieu de `data/`. Si rien n'est trouvé on
    /// retombe sur une liste embarquée minimale (cf. `embeddedFallback`).
    private static func loadPublicSuffixes() -> Set<String> {
        let main = Bundle.main
        let own  = Bundle(for: BundleToken.self)

        let candidates: [URL?] = [
            main.url(forResource: "public_suffix_list",
                     withExtension: "dat",
                     subdirectory: "data"),
            main.url(forResource: "public_suffix_list",
                     withExtension: "dat",
                     subdirectory: "Resources/data"),
            main.url(forResource: "public_suffix_list",
                     withExtension: "dat"),
            own.url(forResource: "public_suffix_list",
                    withExtension: "dat",
                    subdirectory: "data"),
            own.url(forResource: "public_suffix_list",
                    withExtension: "dat",
                    subdirectory: "Resources/data"),
            own.url(forResource: "public_suffix_list",
                    withExtension: "dat"),
        ]

        for case let url? in candidates {
            guard let content = try? String(contentsOf: url, encoding: .utf8) else {
                continue
            }
            let parsed = parse(content)
            if !parsed.isEmpty {
                return parsed
            }
        }

        // Si on arrive ici c'est que Xcode n'a pas embarqué le .dat. On
        // retombe sur une liste minimale plutôt que de laisser passer
        // www.instagram.com en clair.
        return embeddedFallback
    }

    private static func parse(_ content: String) -> Set<String> {
        Set(content
            .split(separator: "\n", omittingEmptySubsequences: true)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty && !$0.hasPrefix("//") })
    }

    /// Sous-ensemble des suffixes publics ICANN les plus courants. Suffit à
    /// canoniser instagram.com, google.com, machin.co.uk, etc. au cas où le
    /// .dat serait absent du bundle. À garder lisible — pas un substitut
    /// complet à la PSL mais un filet de sécurité.
    private static let embeddedFallback: Set<String> = [
        // gTLDs historiques
        "com", "net", "org", "edu", "gov", "mil", "int", "info", "biz",
        "name", "pro", "aero", "coop", "museum", "asia", "jobs", "mobi",
        "post", "tel", "travel", "xxx",
        // ccTLDs et leurs second-levels les plus utilisés
        "fr", "com.fr", "asso.fr",
        "de", "uk", "co.uk", "ac.uk", "gov.uk", "org.uk",
        "us", "ca", "mx", "br", "com.br", "ar", "com.ar", "cl",
        "es", "it", "pt", "be", "nl", "lu", "ch", "at", "li",
        "se", "no", "fi", "dk", "is",
        "ie", "pl", "cz", "sk", "hu", "ro", "bg", "gr", "tr",
        "ru", "ua", "by",
        "cn", "com.cn", "jp", "co.jp", "kr", "co.kr", "tw", "com.tw",
        "hk", "sg", "in", "co.in", "au", "com.au", "nz", "co.nz",
        "za", "co.za",
        // gTLDs nouveaux populaires
        "io", "co", "me", "tv", "cc", "ai", "app", "dev", "xyz", "site",
        "online", "store", "tech", "blog", "cloud", "design", "page",
    ]

    /// Domaine canonique à hasher pour un `ASCredentialServiceIdentifier`.
    /// - URL  : on extrait le hostname avant d'appliquer la PSL.
    /// - domain : on l'applique directement.
    static func normalize(_ serviceIdentifier: ASCredentialServiceIdentifier) -> String {
        let raw = serviceIdentifier.identifier
        let hostname: String

        switch serviceIdentifier.type {
        case .URL:
            // Le système peut nous donner une URL complète avec scheme/path/query :
            // on garde uniquement le host.
            if let host = URLComponents(string: raw)?.host, !host.isEmpty {
                hostname = host
            } else if let host = URL(string: raw)?.host, !host.isEmpty {
                hostname = host
            } else {
                hostname = raw
            }
        case .domain:
            hostname = raw
        @unknown default:
            hostname = raw
        }

        return registrableDomain(hostname)
    }

    /// Retourne le « registrable domain » d'après la PSL, équivalent strict de
    /// `getRegistrableDomain` côté JavaScript.
    static func registrableDomain(_ hostname: String) -> String {
        let lower = hostname.lowercased()
        let parts = lower.split(separator: ".", omittingEmptySubsequences: false)
                         .map(String.init)
        guard parts.count >= 2 else { return lower }

        for i in 0..<parts.count {
            let candidate = parts[i...].joined(separator: ".")
            if publicSuffixes.contains(candidate) {
                // i == 0 : le hostname EST un public suffix (rare en pratique)
                // → on ne peut pas remonter d'un cran, on le rend tel quel.
                if i == 0 { return lower }
                return parts[(i - 1)...].joined(separator: ".")
            }
        }
        return lower
    }
}
