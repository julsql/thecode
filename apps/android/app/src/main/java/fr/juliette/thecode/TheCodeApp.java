package fr.juliette.thecode;

import android.app.Application;

/**
 * Point d'entrée du processus, écrans comme service de remplissage : les
 * déclencheurs de la synchronisation automatique y sont branchés une fois,
 * pour qu'aucune écriture du carnet ne leur échappe.
 */
public class TheCodeApp extends Application {

    @Override
    public void onCreate() {
        super.onCreate();
        AutoSync.install(this);
    }
}
