//
//  TransferView.swift
//  Transfert du carnet : afficher un QR, ou en lire un.
//
//  Le QR se lit d'un écran à l'autre, sans serveur et sans compte. Son contenu
//  est chiffré avec une clef dérivée de la clef maîtresse : une photo de
//  l'écran ne révèle rien.
//

import AVFoundation
import Combine
import SwiftUI

#if canImport(UIKit)
    import UIKit
#endif

public struct TransferView: View {

    /// La clef maîtresse chiffre le carnet. Sans elle il n'y a rien à montrer.
    let masterKey: String

    @Binding var isPresented: Bool

    @State private var fragments: [String] = []
    @State private var shown = 0
    @State private var status: String?
    @State private var scanning = false

    @StateObject private var scanner = QrScanner()

    /// Les fragments défilent en boucle : le lecteur les accumule jusqu'à les
    /// avoir tous, et l'ordre n'a pas d'importance.
    private let tick = Timer.publish(every: 1.2, on: .main, in: .common).autoconnect()

    public init(masterKey: String, isPresented: Binding<Bool>) {
        self.masterKey = masterKey
        self._isPresented = isPresented
    }

    public var body: some View {
        VStack(spacing: 16) {
            Text(L10nQr.t("Transférer le carnet", "Transfer the vault"))
                .font(.headline)

            if scanning {
                scannerBody
            } else {
                senderBody
            }

            if let status {
                Text(status)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            Button(L10nQr.t("Fermer", "Close")) {
                scanner.stop()
                isPresented = false
            }
        }
        .padding()
        .onDisappear { scanner.stop() }
        .onReceive(tick) { _ in
            guard fragments.count > 1 else { return }
            shown = (shown + 1) % fragments.count
        }
        .onChange(of: scanner.payload) { payload in
            guard let payload else { return }
            receive(payload)
        }
    }

    private var senderBody: some View {
        VStack(spacing: 12) {
            if fragments.isEmpty {
                Text(
                    L10nQr.t(
                        "Le contenu est chiffré : une photo de l'écran ne révèle rien.",
                        "The content is encrypted: a photo of the screen reveals nothing.")
                )
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            } else if let image = QrCode.image(for: fragments[shown]) {
                Image(decorative: image, scale: 1)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: 280, maxHeight: 280)
                    // Marge blanche : sans elle, un lecteur ne trouve pas les
                    // bords du code.
                    .padding(12)
                    .background(Color.white)

                if fragments.count > 1 {
                    Text(
                        L10nQr.t(
                            "Code \(shown + 1) sur \(fragments.count) — laissez défiler",
                            "Code \(shown + 1) of \(fragments.count) — let it cycle")
                    )
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
            }

            Button(L10nQr.t("Afficher le QR code", "Show the QR code"), action: show)
            Button(L10nQr.t("Lire un QR code", "Read a QR code")) {
                scanner.reset()
                scanning = true
                scanner.start()
            }
        }
    }

    private var scannerBody: some View {
        VStack(spacing: 12) {
            CameraPreview(session: scanner.session)
                .frame(maxWidth: 280, maxHeight: 280)

            if let failure = scanner.failure {
                Text(failure).font(.footnote).foregroundStyle(.red)
            } else if let progress = scanner.progress {
                Text(progress).font(.footnote).foregroundStyle(.secondary)
            }

            Button(L10nQr.t("Arrêter", "Stop")) {
                scanner.stop()
                scanning = false
            }
        }
    }

    // MARK: - Actions

    private func show() {
        guard !masterKey.isEmpty else {
            status = L10nQr.t(
                "Définissez d'abord votre clef maîtresse.", "Set your master key first.")
            return
        }

        let vault = VaultStore.load()
        guard !vault.entries.filter({ $0.deleted != true }).isEmpty else {
            status = L10nQr.t(
                "Le carnet est vide, il n'y a rien à transférer.",
                "The vault is empty, there is nothing to transfer.")
            return
        }

        do {
            fragments = Transfer.fragments(try Transfer.exportVault(vault, masterKey: masterKey))
            shown = 0
            status = nil
        } catch {
            status = L10nQr.t("Impossible de préparer le carnet.", "Could not prepare the vault.")
        }
    }

    private func receive(_ payload: String) {
        scanning = false
        do {
            let incoming = try Transfer.importVault(payload, masterKey: masterKey)
            // Fusion et jamais substitution : un import qui écraserait
            // effacerait les entrées créées ici.
            let (merged, conflicts) = Vault.merge(VaultStore.load(), incoming)
            try VaultStore.save(merged)

            let kept = merged.entries.filter { $0.deleted != true }.count
            status =
                conflicts.isEmpty
                ? L10nQr.t(
                    "Carnet fusionné : \(kept) entrées.", "Vault merged: \(kept) entries.")
                : L10nQr.t(
                    "Carnet fusionné : \(kept) entrées, \(conflicts.count) à vérifier.",
                    "Vault merged: \(kept) entries, \(conflicts.count) to check.")
        } catch {
            status = L10nQr.t(
                "Lecture impossible : ce code vient-il d'une autre clef maîtresse ?",
                "Cannot read: does this code come from another master key?")
        }
        scanner.reset()
    }
}

// MARK: - Aperçu caméra

#if canImport(UIKit)
    /// Aperçu de la caméra. AVCaptureVideoPreviewLayer n'a pas d'équivalent
    /// SwiftUI : on enveloppe une vue système.
    struct CameraPreview: UIViewRepresentable {
        let session: AVCaptureSession

        func makeUIView(context: Context) -> PreviewView {
            let view = PreviewView()
            view.layer.session = session
            view.layer.videoGravity = .resizeAspectFill
            return view
        }

        func updateUIView(_ view: PreviewView, context: Context) {}

        final class PreviewView: UIView {
            override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
            override var layer: AVCaptureVideoPreviewLayer {
                super.layer as! AVCaptureVideoPreviewLayer
            }
        }
    }
#else
    struct CameraPreview: NSViewRepresentable {
        let session: AVCaptureSession

        func makeNSView(context: Context) -> NSView {
            let view = NSView()
            view.wantsLayer = true
            let preview = AVCaptureVideoPreviewLayer(session: session)
            preview.videoGravity = .resizeAspectFill
            view.layer = preview
            return view
        }

        func updateNSView(_ view: NSView, context: Context) {}
    }
#endif
