//
//  AppleAuthTests.swift
//  « Se connecter avec Apple » : nonce, corps de l'appel, activation.
//

import Foundation
import Testing

@testable import TheCode

struct AppleAuthTests {

    // MARK: - Nonce

    @Test func hashedNonceIsLowercaseHexSHA256() {
        #expect(
            AppleAuth.hashedNonce("abc")
                == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
    }

    @Test func rawNonceIsFreshBase64URL() {
        let a = AppleAuth.makeRawNonce()
        let b = AppleAuth.makeRawNonce()
        #expect(a != b)
        #expect(a.count == 43)
        #expect(a.allSatisfy { $0.isLetter || $0.isNumber || "-_".contains($0) })
    }

    // MARK: - Jeton

    @Test func identityTokenIsReadAsUTF8() throws {
        #expect(try AppleAuth.identityToken(from: Data("eyJ.a.b".utf8)) == "eyJ.a.b")
    }

    @Test func missingOrEmptyIdentityTokenIsAnError() {
        #expect(throws: AppleAuthError.missingIdentityToken) {
            try AppleAuth.identityToken(from: nil)
        }
        #expect(throws: AppleAuthError.missingIdentityToken) {
            try AppleAuth.identityToken(from: Data())
        }
    }

    // MARK: - Corps de l'appel

    @Test func apiBodySendsRawNonce() {
        let body = AppleAuth.apiBody(
            identityToken: "jwt", rawNonce: "raw", lang: "fr", deviceLabel: "iPhone")
        #expect(body["identity_token"] as? String == "jwt")
        #expect(body["nonce"] as? String == "raw")
        #expect(body["lang"] as? String == "fr")
        #expect(body["device_label"] as? String == "iPhone")
    }

    @Test func apiBodyOmitsEmptyDeviceLabel() {
        let body = AppleAuth.apiBody(identityToken: "jwt", rawNonce: "raw", lang: "en")
        #expect(body["device_label"] == nil)
        #expect(body.count == 3)
    }

    // MARK: - Activation

    @Test func appleEnabledOnlyWhenTrue() throws {
        func parse(_ json: String) throws -> Bool {
            let body = try JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any]
            return AppleAuth.isEnabled(registration: body ?? [:])
        }
        #expect(try parse(#"{"appleEnabled":true}"#))
        #expect(try !parse(#"{"appleEnabled":false}"#))
        #expect(try !parse(#"{"googleClientId":"x"}"#))
        #expect(try !parse(#"{"appleEnabled":1}"#))
        #expect(try !parse(#"{"appleEnabled":"true"}"#))
    }

    // MARK: - Appels

    @Test func appleSignInPostsTokenAndRawNonce() async throws {
        let transport = RecordingTransport(
            body: #"{"access_token":"acc","refresh_token":"ref","expires_in":900}"#)
        let creds = try await Sync(transport: transport).appleSignIn(
            endpoint: "https://api.test", identityToken: "jwt", rawNonce: "raw", lang: "fr",
            deviceLabel: "iPhone")

        #expect(creds == SyncCredentials(
            endpoint: "https://api.test", accessToken: "acc", refreshToken: "ref"))
        #expect(transport.url == "https://api.test/v1/auth/apple")
        #expect(transport.method == "POST")
        let sent = try JSONSerialization.jsonObject(with: transport.body ?? Data()) as? [String: Any]
        #expect(sent?["identity_token"] as? String == "jwt")
        #expect(sent?["nonce"] as? String == "raw")
        #expect(sent?["lang"] as? String == "fr")
        #expect(sent?["device_label"] as? String == "iPhone")
    }

    @Test func appleEnabledReadsRegistration() async {
        let transport = RecordingTransport(body: #"{"appleEnabled":true,"freeSlots":2}"#)
        #expect(await Sync(transport: transport).appleEnabled(endpoint: "https://api.test"))
        #expect(transport.url == "https://api.test/v1/auth/registration")
        #expect(transport.method == "GET")
    }

    @Test func appleHiddenWhenRegistrationFails() async {
        let transport = RecordingTransport(body: #"{"detail":"boom"}"#, status: 500)
        #expect(await !Sync(transport: transport).appleEnabled(endpoint: "https://api.test"))
    }
}

private final class RecordingTransport: SyncTransport, @unchecked Sendable {
    let response: Data
    let status: Int
    var url: String?
    var method: String?
    var body: Data?

    init(body: String, status: Int = 200) {
        response = Data(body.utf8)
        self.status = status
    }

    func send(url: String, method: String, body: Data?, bearer: String?) async throws
        -> SyncResponse
    {
        self.url = url
        self.method = method
        self.body = body
        return SyncResponse(status: status, body: response)
    }
}
