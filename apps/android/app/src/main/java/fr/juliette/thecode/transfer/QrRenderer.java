package fr.juliette.thecode.transfer;

import android.graphics.Bitmap;
import android.graphics.Color;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;

import java.util.EnumMap;
import java.util.Map;

/**
 * Rend un QR code en image.
 *
 * Correction L, comme les autres implementations : le code s'affiche sur un
 * ecran, il n'est ni imprime ni abime, et L donne la plus grande capacite.
 */
public final class QrRenderer {

    /** Marge blanche, en modules. Sans elle, aucun lecteur ne trouve les bords. */
    private static final int QUIET_ZONE = 4;

    private QrRenderer() {}

    @Nullable
    public static Bitmap render(@NonNull String text, int sizePx) {
        Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
        hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.L);
        hints.put(EncodeHintType.MARGIN, QUIET_ZONE);
        hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");

        try {
            BitMatrix matrix = new QRCodeWriter()
                    .encode(text, BarcodeFormat.QR_CODE, sizePx, sizePx, hints);

            int width = matrix.getWidth();
            int height = matrix.getHeight();
            int[] pixels = new int[width * height];
            for (int y = 0; y < height; y++) {
                for (int x = 0; x < width; x++) {
                    pixels[y * width + x] = matrix.get(x, y) ? Color.BLACK : Color.WHITE;
                }
            }

            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            bitmap.setPixels(pixels, 0, width, 0, 0, width, height);
            return bitmap;
        } catch (WriterException e) {
            // Contenu trop long : rendre null plutot qu'un code tronque, que
            // rien ne saurait relire.
            return null;
        }
    }
}
