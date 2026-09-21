package fr.juliette.thecode;

import android.content.Context;
import java.io.FileInputStream;
import java.io.FileOutputStream;

public class FileDarkMode {

    Context context;
    String fileName;

    public FileDarkMode(Context context, String fileName) {
        this.context = context;
        this.fileName = fileName;
    }

    // Fonction pour écrire du texte dans un fichier
    public void write(String text) {
        try {
            FileOutputStream fos = this.context.openFileOutput(this.fileName, Context.MODE_PRIVATE);
            fos.write(text.getBytes());
            fos.close();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // Fonction pour lire le contenu d'un fichier
    public String read() {
        StringBuilder stringBuilder = new StringBuilder();
        try {
            FileInputStream fis = this.context.openFileInput(this.fileName);
            int content;
            while ((content = fis.read()) != -1) {
                stringBuilder.append((char) content);
            }
            fis.close();
        } catch (Exception e) {
            e.printStackTrace();
        }
        return stringBuilder.toString();
    }
}
