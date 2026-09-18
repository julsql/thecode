//
//  QrCode.swift
//  Affichage et lecture d'un QR code.
//
//  Génération par CoreImage et lecture par AVFoundation : les deux sont
//  fournis par le système. Contrairement au JavaScript, où l'encodeur est
//  écrit à la main faute de pouvoir embarquer quoi que ce soit dans
//  l'extension, il n'y a rien à ajouter ici.
//
//  Source unique : shared/apple/QrCode.swift
//

import AVFoundation
import Combine
import CoreImage
import SwiftUI

public enum QrCode {

    /// Rend l'image d'un QR code, ou `nil` si le contenu ne tient pas.
    ///
    /// Correction L, comme les autres implémentations : le code s'affiche sur
    /// un écran, il n'est ni imprimé ni abîmé, et L donne la plus grande
    /// capacité.
    public static func image(for text: String) -> CGImage? {
        guard let filter = CIFilter(name: "CIQRCodeGenerator") else { return nil }
        filter.setValue(Data(text.utf8), forKey: "inputMessage")
        filter.setValue("L", forKey: "inputCorrectionLevel")

        guard let output = filter.outputImage else { return nil }

        // Agrandi avant rendu : sans cela chaque module fait un pixel et
        // l'image sort floue une fois étirée à l'écran.
        let scaled = output.transformed(by: CGAffineTransform(scaleX: 10, y: 10))
        return CIContext().createCGImage(scaled, from: scaled.extent)
    }
}

// MARK: - Lecture

/// Lecteur de QR code adossé à la caméra.
///
/// Les carnets trop gros pour un seul code sont découpés : le lecteur accumule
/// les fragments jusqu'à les avoir tous. Un fragment lu deux fois est ignoré,
/// l'ordre n'a pas d'importance.
public final class QrScanner: NSObject, ObservableObject, AVCaptureMetadataOutputObjectsDelegate {

    @Published public private(set) var payload: String?
    @Published public private(set) var progress: String?
    @Published public private(set) var failure: String?

    public let session = AVCaptureSession()
    private var fragments: [Int: String] = [:]
    private var expected = 0

    public override init() {
        super.init()
    }

    /// Prépare la caméra. Ne démarre rien si l'utilisateur la refuse.
    public func start() {
        guard session.inputs.isEmpty else {
            resume()
            return
        }

        guard let device = AVCaptureDevice.default(for: .video),
            let input = try? AVCaptureDeviceInput(device: device),
            session.canAddInput(input)
        else {
            failure = L10nQr.t(
                "Aucune caméra disponible.", "No camera available.")
            return
        }
        session.addInput(input)

        let output = AVCaptureMetadataOutput()
        guard session.canAddOutput(output) else {
            failure = L10nQr.t("Lecture impossible.", "Cannot read.")
            return
        }
        session.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: .main)
        output.metadataObjectTypes = [.qr]

        resume()
    }

    public func stop() {
        guard session.isRunning else { return }
        // Hors du fil principal : arrêter une session bloque le temps que la
        // caméra se libère.
        DispatchQueue.global(qos: .userInitiated).async { [session] in session.stopRunning() }
    }

    private func resume() {
        guard !session.isRunning else { return }
        DispatchQueue.global(qos: .userInitiated).async { [session] in session.startRunning() }
    }

    public func metadataOutput(
        _ output: AVCaptureMetadataOutput,
        didOutput metadataObjects: [AVMetadataObject],
        from connection: AVCaptureConnection
    ) {
        for object in metadataObjects {
            guard let readable = object as? AVMetadataMachineReadableCodeObject,
                let text = readable.stringValue
            else { continue }
            accept(text)
        }
    }

    /// Accepte un code lu. Exposé pour que l'assemblage soit testable sans caméra.
    public func accept(_ text: String) {
        if text.hasPrefix("TC1.") {
            payload = text
            stop()
            return
        }

        guard text.hasPrefix("TC1m.") else {
            // Un QR qui ne vient pas de TheCode : on n'en dit rien et on
            // continue, l'utilisateur vise peut-être encore.
            return
        }

        let parts = text.split(separator: ".", maxSplits: 3, omittingEmptySubsequences: false)
        guard parts.count == 4, let index = Int(parts[1]), let total = Int(parts[2]),
            total > 0, index >= 0, index < total
        else { return }

        expected = total
        fragments[index] = String(parts[3])

        guard fragments.count == total else {
            progress = L10nQr.t(
                "Fragment \(fragments.count) sur \(total)…",
                "Fragment \(fragments.count) of \(total)…")
            return
        }

        let joined = (0..<total).compactMap { fragments[$0] }.joined()
        payload = "TC1." + joined
        progress = nil
        stop()
    }

    public func reset() {
        payload = nil
        progress = nil
        failure = nil
        fragments = [:]
        expected = 0
    }
}

/// Localisation minimale, dupliquée ici parce que ce fichier est partagé par
/// des cibles qui ne voient pas toutes le même L10n.
enum L10nQr {
    static func t(_ fr: String, _ en: String) -> String {
        (Locale.preferredLanguages.first?.lowercased().hasPrefix("fr") ?? false) ? fr : en
    }
}
