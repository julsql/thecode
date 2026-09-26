//
//  GoogleAuthTests.swift
//  « Continuer avec Google » : PKCE, adresses et lecture des réponses.
//

import Foundation
import Testing

@testable import TheCode

struct GoogleAuthTests {

    private let auth = GoogleAuth(clientID: "123-abc.apps.googleusercontent.com")

    private func query(_ url: URL) -> [String: String] {
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        return Dictionary(uniqueKeysWithValues: items.map { ($0.name, $0.value ?? "") })
    }

    // MARK: - Configuration

    @Test func redirectUsesReversedClientID() {
        #expect(auth.callbackScheme == "com.googleusercontent.apps.123-abc")
        #expect(auth.redirectURI == "com.googleusercontent.apps.123-abc:/oauth2redirect")
    }

    @Test func missingClientIDHidesTheButton() {
        // Le bundle de test n'a pas la clef.
        #expect(GoogleAuth.configured(in: Bundle(for: BundleToken.self)) == nil)
    }

    // MARK: - PKCE

    @Test func challengeIsBase64URLSHA256OfVerifier() {
        #expect(
            GoogleAuth.challenge(for: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r-wW1gFWFOEjXk")
                == "NPsYzawS-__wqk67X9gyb4dr3JBo3hnlEi5MNyD5jX0")
    }

    @Test func verifierIsFreshAndWithinRFCBounds() {
        let a = GoogleAuth.makeVerifier()
        let b = GoogleAuth.makeVerifier()
        #expect(a != b)
        #expect((43...128).contains(a.count))
        #expect(a.allSatisfy { $0.isLetter || $0.isNumber || "-._~".contains($0) })
    }

    // MARK: - Page de consentement

    @Test func authorizationURLCarriesPKCEAndState() {
        let url = auth.authorizationURL(state: "s1", verifier: "v1")
        let q = query(url)
        #expect(url.absoluteString.hasPrefix("https://accounts.google.com/o/oauth2/v2/auth?"))
        #expect(q["client_id"] == auth.clientID)
        #expect(q["redirect_uri"] == auth.redirectURI)
        #expect(q["response_type"] == "code")
        #expect(q["scope"] == "openid email")
        #expect(q["code_challenge"] == GoogleAuth.challenge(for: "v1"))
        #expect(q["code_challenge_method"] == "S256")
        #expect(q["state"] == "s1")
    }

    // MARK: - Redirection

    @Test func callbackYieldsCode() throws {
        let url = URL(string: "com.googleusercontent.apps.123-abc:/oauth2redirect?state=s1&code=4/xyz")!
        #expect(try GoogleAuth.code(from: url, expectedState: "s1") == "4/xyz")
    }

    @Test func callbackWithOtherStateIsRejected() {
        let url = URL(string: "com.googleusercontent.apps.123-abc:/oauth2redirect?state=evil&code=c")!
        #expect(throws: GoogleAuthError.stateMismatch) {
            try GoogleAuth.code(from: url, expectedState: "s1")
        }
    }

    @Test func deniedAccessIsACancellation() {
        let url = URL(
            string: "com.googleusercontent.apps.123-abc:/oauth2redirect?state=s1&error=access_denied")!
        #expect(throws: GoogleAuthError.cancelled) {
            try GoogleAuth.code(from: url, expectedState: "s1")
        }
    }

    @Test func otherProviderErrorIsReported() {
        let url = URL(
            string: "com.googleusercontent.apps.123-abc:/oauth2redirect?state=s1&error=server_error")!
        #expect(throws: GoogleAuthError.provider("server_error")) {
            try GoogleAuth.code(from: url, expectedState: "s1")
        }
    }

    @Test func callbackWithoutCodeIsRejected() {
        let url = URL(string: "com.googleusercontent.apps.123-abc:/oauth2redirect?state=s1")!
        #expect(throws: GoogleAuthError.missingCode) {
            try GoogleAuth.code(from: url, expectedState: "s1")
        }
    }

    // MARK: - Échange du code

    @Test func tokenRequestBodyIsFormEncodedWithoutSecret() {
        let body = String(decoding: auth.tokenRequestBody(code: "4/a b", verifier: "v1"), as: UTF8.self)
        #expect(
            body
                == "client_id=123-abc.apps.googleusercontent.com&code=4%2Fa%20b&code_verifier=v1"
                + "&grant_type=authorization_code"
                + "&redirect_uri=com.googleusercontent.apps.123-abc%3A%2Foauth2redirect")
        #expect(!body.contains("client_secret"))
    }

    @Test func tokenResponseYieldsIdToken() throws {
        let data = Data(#"{"access_token":"a","id_token":"eyJ.x.y","expires_in":3599}"#.utf8)
        #expect(try GoogleAuth.idToken(fromTokenResponse: data) == "eyJ.x.y")
    }

    @Test func tokenErrorIsReported() {
        let data = Data(#"{"error":"invalid_grant","error_description":"Bad Request"}"#.utf8)
        #expect(throws: GoogleAuthError.provider("invalid_grant: Bad Request")) {
            try GoogleAuth.idToken(fromTokenResponse: data)
        }
    }

    @Test func tokenResponseWithoutIdTokenIsRejected() {
        #expect(throws: GoogleAuthError.missingIdToken) {
            try GoogleAuth.idToken(fromTokenResponse: Data(#"{"access_token":"a"}"#.utf8))
        }
    }

    // MARK: - Appel à l'API

    @Test func apiBodyOmitsEmptyOptionalFields() {
        let body = GoogleAuth.apiBody(idToken: "t", lang: "fr")
        #expect(body.count == 2)
        #expect(body["id_token"] as? String == "t")
        #expect(body["lang"] as? String == "fr")
    }

    @Test func apiBodyCarriesInviteCodeAndDevice() {
        let body = GoogleAuth.apiBody(
            idToken: "t", lang: "en", deviceLabel: "iPhone", inviteCode: "CODE")
        #expect(body["invite_code"] as? String == "CODE")
        #expect(body["device_label"] as? String == "iPhone")
    }

    @Test func googleSignInPostsTokenAndStoresSessionTokens() async throws {
        let transport = RecordingTransport(
            body: #"{"access_token":"acc","refresh_token":"ref","expires_in":900}"#)
        let creds = try await Sync(transport: transport).googleSignIn(
            endpoint: "https://api.test", idToken: "idt", lang: "fr")

        #expect(creds == SyncCredentials(
            endpoint: "https://api.test", accessToken: "acc", refreshToken: "ref"))
        #expect(transport.url == "https://api.test/v1/auth/google")
        #expect(transport.method == "POST")
        let sent = try JSONSerialization.jsonObject(with: transport.body ?? Data()) as? [String: Any]
        #expect(sent?["id_token"] as? String == "idt")
        #expect(sent?["lang"] as? String == "fr")
    }
}

private final class BundleToken {}

private final class RecordingTransport: SyncTransport, @unchecked Sendable {
    let response: Data
    var url: String?
    var method: String?
    var body: Data?

    init(body: String) { response = Data(body.utf8) }

    func send(url: String, method: String, body: Data?, bearer: String?) async throws
        -> SyncResponse
    {
        self.url = url
        self.method = method
        self.body = body
        return SyncResponse(status: 200, body: response)
    }
}
