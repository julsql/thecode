//
//  AppleAuthTests.swift
//  « Se connecter avec Apple » côté Mac : le même calcul que sur iOS. Le
//  détail (appels à l'API compris) est couvert par les tests iOS.
//

import Foundation
import Testing

@testable import TheCode_for_Mac

struct AppleAuthTests {

    @Test func hashedNonceIsLowercaseHexSHA256() {
        #expect(
            AppleAuth.hashedNonce("abc")
                == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
    }

    @Test func rawNonceIsFresh() {
        #expect(AppleAuth.makeRawNonce() != AppleAuth.makeRawNonce())
    }

    @Test func apiBodySendsRawNonce() {
        let body = AppleAuth.apiBody(
            identityToken: "jwt", rawNonce: "raw", lang: "en", deviceLabel: "Mac")
        #expect(body["identity_token"] as? String == "jwt")
        #expect(body["nonce"] as? String == "raw")
        #expect(body["device_label"] as? String == "Mac")
        #expect(body["authorization_code"] == nil)
    }

    @Test func apiBodySendsAuthorizationCode() {
        let body = AppleAuth.apiBody(
            identityToken: "jwt", rawNonce: "raw", lang: "en", authorizationCode: "c-1")
        #expect(body["authorization_code"] as? String == "c-1")
    }

    @Test func authorizationCodeIsReadAsUTF8OrEmpty() {
        #expect(AppleAuth.authorizationCode(from: Data("c.1".utf8)) == "c.1")
        #expect(AppleAuth.authorizationCode(from: nil) == "")
    }

    @Test func appleEnabledOnlyWhenTrue() {
        #expect(AppleAuth.isEnabled(registration: ["appleEnabled": true]))
        #expect(!AppleAuth.isEnabled(registration: ["appleEnabled": false]))
        #expect(!AppleAuth.isEnabled(registration: [:]))
    }
}
