package fr.juliette.thecode.transfer;

import android.graphics.ImageFormat;

import androidx.annotation.NonNull;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageProxy;

import com.google.zxing.BinaryBitmap;
import com.google.zxing.DecodeHintType;
import com.google.zxing.PlanarYUVLuminanceSource;
import com.google.zxing.ReaderException;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.qrcode.QRCodeReader;

import java.nio.ByteBuffer;
import java.util.EnumMap;
import java.util.Map;

/**
 * Cherche un QR code dans chaque image de la camera.
 *
 * On lit le seul plan de luminance : un QR est noir et blanc, la couleur
 * n'apporte rien et la convertir couterait une copie par image.
 */
final class QrAnalyzer implements ImageAnalysis.Analyzer {

    /** Recoit le contenu de chaque code lu, depuis le fil d'analyse. */
    interface OnCode {
        void found(@NonNull String text);
    }

    private final QRCodeReader reader = new QRCodeReader();
    private final Map<DecodeHintType, Object> hints = new EnumMap<>(DecodeHintType.class);
    private final OnCode listener;

    QrAnalyzer(@NonNull OnCode listener) {
        this.listener = listener;
        hints.put(DecodeHintType.TRY_HARDER, Boolean.TRUE);
    }

    @Override
    public void analyze(@NonNull ImageProxy image) {
        if (image.getFormat() != ImageFormat.YUV_420_888) {
            image.close();
            return;
        }

        try {
            ByteBuffer buffer = image.getPlanes()[0].getBuffer();
            byte[] luminance = new byte[buffer.remaining()];
            buffer.get(luminance);

            PlanarYUVLuminanceSource source = new PlanarYUVLuminanceSource(
                    luminance, image.getPlanes()[0].getRowStride(), image.getHeight(),
                    0, 0, image.getWidth(), image.getHeight(), false);

            listener.found(reader.decode(new BinaryBitmap(new HybridBinarizer(source)), hints)
                    .getText());
        } catch (ReaderException e) {
            // Aucun code dans cette image : c'est le cas courant, la camera
            // filme en continu.
        } catch (Exception e) {
            // Image inexploitable : on passe a la suivante plutot que de
            // couper la lecture.
        } finally {
            image.close();
        }
    }
}
