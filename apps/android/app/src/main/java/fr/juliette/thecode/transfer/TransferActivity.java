package fr.juliette.thecode.transfer;

import android.Manifest;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;

import com.google.android.material.appbar.MaterialToolbar;
import com.google.common.util.concurrent.ListenableFuture;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import fr.juliette.thecode.Preferences;
import fr.juliette.thecode.R;
import fr.juliette.thecode.vault.Transfer;
import fr.juliette.thecode.vault.Vault;
import fr.juliette.thecode.vault.VaultEntry;

/**
 * Transfert du carnet par QR code.
 *
 * Le carnet se lit d'un ecran a l'autre, sans serveur et sans compte : c'est ce
 * qui rend la synchronisation facultative. Son contenu est chiffre avec une
 * clef derivee de la clef maitresse, donc une photo de l'ecran ne revele rien.
 */
public class TransferActivity extends AppCompatActivity {

    /** Les codes defilent : le lecteur d'en face les accumule. */
    private static final long CYCLE_MS = 1200;

    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final FragmentCollector collector = new FragmentCollector();

    private Preferences preferences;
    private ImageView qrImage;
    private PreviewView cameraPreview;
    private TextView status;

    private List<String> fragments;
    private int shown = 0;
    private Runnable cycle;

    private ActivityResultLauncher<String> cameraPermission;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_transfer);

        preferences = new Preferences(this);
        qrImage = findViewById(R.id.qrImage);
        cameraPreview = findViewById(R.id.cameraPreview);
        status = findViewById(R.id.transferStatus);

        MaterialToolbar toolbar = findViewById(R.id.transferToolbar);
        toolbar.setNavigationOnClickListener(v -> finish());

        cameraPermission = registerForActivityResult(
                new ActivityResultContracts.RequestPermission(), granted -> {
                    if (granted) startCamera();
                    else status.setText(R.string.transfer_no_camera);
                });

        ((Button) findViewById(R.id.showQr)).setOnClickListener(v -> showQr());
        ((Button) findViewById(R.id.scanQr)).setOnClickListener(v -> askCamera());
    }

    @Override
    protected void onDestroy() {
        if (cycle != null) main.removeCallbacks(cycle);
        worker.shutdownNow();
        super.onDestroy();
    }

    // --------------------------------------------------------- afficher

    private void showQr() {
        String masterKey = preferences.getEncodingKey();
        if (masterKey.isEmpty()) {
            status.setText(R.string.transfer_needs_key);
            return;
        }

        Vault vault = Vault.load(this);
        int live = 0;
        for (VaultEntry entry : vault.entries) {
            if (!entry.deleted) live++;
        }
        if (live == 0) {
            status.setText(R.string.transfer_empty);
            return;
        }

        cameraPreview.setVisibility(View.GONE);
        status.setText(R.string.transfer_working);

        // PBKDF2 a 600 000 iterations : jamais sur le fil qui dessine l'ecran.
        worker.execute(() -> {
            try {
                List<String> parts = Transfer.fragments(Transfer.exportVault(vault, masterKey));
                main.post(() -> startCycling(parts));
            } catch (Exception e) {
                main.post(() -> status.setText(R.string.transfer_too_big));
            }
        });
    }

    private void startCycling(List<String> parts) {
        fragments = parts;
        shown = 0;
        qrImage.setVisibility(View.VISIBLE);
        if (cycle != null) main.removeCallbacks(cycle);

        cycle = new Runnable() {
            @Override
            public void run() {
                render();
                if (fragments.size() > 1) {
                    shown = (shown + 1) % fragments.size();
                    main.postDelayed(this, CYCLE_MS);
                }
            }
        };
        cycle.run();
    }

    private void render() {
        Bitmap bitmap = QrRenderer.render(fragments.get(shown), 720);
        if (bitmap == null) {
            status.setText(R.string.transfer_too_big);
            qrImage.setVisibility(View.GONE);
            return;
        }
        qrImage.setImageBitmap(bitmap);
        status.setText(fragments.size() > 1
                ? getString(R.string.transfer_cycling, shown + 1, fragments.size())
                : "");
    }

    // ------------------------------------------------------------ lire

    private void askCamera() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED) {
            startCamera();
        } else {
            cameraPermission.launch(Manifest.permission.CAMERA);
        }
    }

    private void startCamera() {
        if (cycle != null) main.removeCallbacks(cycle);
        qrImage.setVisibility(View.GONE);
        cameraPreview.setVisibility(View.VISIBLE);
        collector.reset();
        status.setText("");

        ListenableFuture<ProcessCameraProvider> future = ProcessCameraProvider.getInstance(this);
        future.addListener(() -> {
            try {
                ProcessCameraProvider provider = future.get();

                Preview preview = new Preview.Builder().build();
                preview.setSurfaceProvider(cameraPreview.getSurfaceProvider());

                ImageAnalysis analysis = new ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build();
                analysis.setAnalyzer(worker, new QrAnalyzer(this::onCode));

                provider.unbindAll();
                provider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA,
                        preview, analysis);
            } catch (Exception e) {
                status.setText(R.string.transfer_no_camera);
                cameraPreview.setVisibility(View.GONE);
            }
        }, ContextCompat.getMainExecutor(this));
    }

    /** Appele depuis le fil d'analyse pour chaque code lu. */
    private void onCode(@NonNull String text) {
        String payload = collector.accept(text);
        main.post(() -> {
            if (payload == null) {
                if (collector.expected() > 1) {
                    status.setText(getString(R.string.transfer_progress,
                            collector.seenCount(), collector.expected()));
                }
                return;
            }
            merge(payload);
        });
    }

    private void merge(String payload) {
        cameraPreview.setVisibility(View.GONE);
        String masterKey = preferences.getEncodingKey();

        worker.execute(() -> {
            try {
                Vault incoming = Transfer.importVault(payload, masterKey);
                // Fusion et jamais substitution : un import qui ecraserait
                // effacerait les entrees creees ici.
                List<Vault.Conflict> conflicts = new java.util.ArrayList<>();
                Vault merged = Vault.merge(Vault.load(this), incoming, conflicts);
                merged.save(this);

                int kept = 0;
                for (VaultEntry entry : merged.entries) {
                    if (!entry.deleted) kept++;
                }
                final int live = kept;
                main.post(() -> status.setText(conflicts.isEmpty()
                        ? getString(R.string.transfer_merged, live)
                        : getString(R.string.transfer_merged_conflicts, live, conflicts.size())));
            } catch (Exception e) {
                main.post(() -> status.setText(R.string.transfer_unreadable));
            }
        });
    }
}
