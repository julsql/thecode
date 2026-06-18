//
//  DomainNormalizerTests.swift
//  thecode-macosTests
//
//  Teste la normalisation de domaine de l'extension AutoFill macOS. La PSL
//  n'est pas embarquée dans le bundle de test : `DomainNormalizer` retombe
//  alors sur sa liste de suffixes intégrée (embeddedFallback), qui couvre les
//  suffixes utilisés ici (.com, .co.uk, .fr…). Le but est qu'un même site
//  donne toujours le même domaine canonique, donc le même mot de passe.
//

import Testing
import AuthenticationServices

struct DomainNormalizerTests {

    // MARK: - registrableDomain

    @Test func stripsWwwSubdomain() async throws {
        #expect(DomainNormalizer.registrableDomain("www.instagram.com") == "instagram.com")
    }

    @Test func keepsBareRegistrableDomain() async throws {
        #expect(DomainNormalizer.registrableDomain("instagram.com") == "instagram.com")
    }

    @Test func collapsesDeepSubdomains() async throws {
        #expect(DomainNormalizer.registrableDomain("a.b.c.example.com") == "example.com")
    }

    @Test func handlesMultiLevelPublicSuffix() async throws {
        // co.uk est un suffixe public : le domaine enregistrable garde un cran
        // de plus que le suffixe.
        #expect(DomainNormalizer.registrableDomain("shop.example.co.uk") == "example.co.uk")
    }

    @Test func isCaseInsensitive() async throws {
        #expect(DomainNormalizer.registrableDomain("WWW.Example.FR") == "example.fr")
    }

    @Test func sameSiteWithAndWithoutWwwMatch() async throws {
        // Propriété centrale : www et apex doivent produire le même domaine,
        // sinon les deux donneraient des mots de passe différents.
        #expect(
            DomainNormalizer.registrableDomain("www.github.com")
                == DomainNormalizer.registrableDomain("github.com")
        )
    }

    @Test func singleLabelIsReturnedAsIs() async throws {
        #expect(DomainNormalizer.registrableDomain("localhost") == "localhost")
    }

    // MARK: - normalize(serviceIdentifier:)

    @Test func normalizesDomainTypeIdentifier() async throws {
        let id = ASCredentialServiceIdentifier(identifier: "www.instagram.com", type: .domain)
        #expect(DomainNormalizer.normalize(id) == "instagram.com")
    }

    @Test func normalizesURLTypeIdentifier() async throws {
        let id = ASCredentialServiceIdentifier(
            identifier: "https://www.instagram.com/accounts/login",
            type: .URL
        )
        #expect(DomainNormalizer.normalize(id) == "instagram.com")
    }
}
