//
//  GoogleAuthTests.swift
//  « Continuer avec Google » côté Mac : le même client iOS, la même
//  redirection. Le détail est couvert par les tests iOS.
//

import Foundation
import Testing

@testable import TheCode_for_Mac

struct GoogleAuthTests {

    private let auth = GoogleAuth(clientID: "123-abc.apps.googleusercontent.com")

    @Test func redirectUsesReversedClientID() {
        #expect(auth.redirectURI == "com.googleusercontent.apps.123-abc:/oauth2redirect")
    }

    @Test func challengeIsBase64URLSHA256OfVerifier() {
        #expect(
            GoogleAuth.challenge(for: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r-wW1gFWFOEjXk")
                == "NPsYzawS-__wqk67X9gyb4dr3JBo3hnlEi5MNyD5jX0")
    }

    @Test func callbackStateIsChecked() throws {
        let url = URL(string: "com.googleusercontent.apps.123-abc:/oauth2redirect?state=s&code=c")!
        #expect(try GoogleAuth.code(from: url, expectedState: "s") == "c")
        #expect(throws: GoogleAuthError.stateMismatch) {
            try GoogleAuth.code(from: url, expectedState: "other")
        }
    }

    @Test func hostAppReadsTheConfiguredClientID() {
        // L'app hôte porte l'identifiant du projet : le bouton est proposé, et
        // la redirection suit l'identifiant.
        let auth = GoogleAuth.configured()
        #expect(auth != nil)
        #expect(auth?.clientID.hasSuffix(".apps.googleusercontent.com") == true)
    }
}
