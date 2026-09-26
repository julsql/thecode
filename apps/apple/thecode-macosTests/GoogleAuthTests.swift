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

    @Test func buttonHiddenWithoutClientID() {
        // L'app hôte est construite sans identifiant : la clef reste vide.
        #expect(GoogleAuth.configured() == nil)
    }
}
