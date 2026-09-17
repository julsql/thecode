package fr.juliette.thecode;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.app.AppCompatDelegate;

/**
 * Splash : applique le mode (sombre / clair / système) puis ouvre MainActivity.
 */
public class LaunchActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        applyStoredTheme();
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_launch);

        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            startActivity(new Intent(LaunchActivity.this, MainActivity.class));
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
            finish();
        }, 600);
    }

    private void applyStoredTheme() {
        Preferences prefs = new Preferences(this);
        String mode = prefs.getDarkMode();
        switch (mode) {
            case "DARK":
                AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES);
                break;
            case "LIGHT":
                AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO);
                break;
            default:
                AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM);
        }
    }
}
