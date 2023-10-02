package fr.juliette.thecode;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.ClipboardManager;
import android.content.DialogInterface;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Environment;
import android.support.v7.app.AppCompatActivity;
import android.support.v7.app.AppCompatDelegate;
import android.text.Editable;
import android.text.SpannableString;
import android.text.TextWatcher;
import android.text.method.LinkMovementMethod;
import android.text.util.Linkify;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.SeekBar;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.math.BigInteger;
import java.security.MessageDigest;

public class MainActivity extends AppCompatActivity {

    // MARK : Introduction des connexions

    TextView securiteTextView;
    TextView longueurTextView;

    EditText siteEditText;
    EditText clefEditText;
    EditText motPasseEditText;

    Button questionButton;
    Button copierButton;

    Switch minSwitch;
    Switch majSwitch;
    Switch symSwitch;
    Switch chiSwitch;

    SeekBar longueurSeekBar;
    SeekBar securiteSeekBar;

    private String fileName = "modeSombre.txt";

    @SuppressLint({"SetTextI18n", "ResourceType"})
    public void onCreate(Bundle savedInstanceState) {

        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // MARK : Connexion avec élément graphiques

        securiteTextView = findViewById(R.id.securiteTextView);
        longueurTextView = findViewById(R.id.longueurTextView);

        clefEditText = findViewById(R.id.clefEditText);
        siteEditText = findViewById(R.id.siteEditText);
        motPasseEditText = findViewById(R.id.motPasseEditText);

        questionButton = findViewById(R.id.questionButton);
        copierButton = findViewById(R.id.copierButton);

        minSwitch = findViewById(R.id.minSwitch);
        majSwitch = findViewById(R.id.majSwitch);
        symSwitch = findViewById(R.id.symSwitch);
        chiSwitch = findViewById(R.id.chiSwitch);

        securiteSeekBar = findViewById(R.id.securiteSeekBar);
        longueurSeekBar = findViewById(R.id.longueurSeekBar);

        // MARK : Connexion avec fonctions

        clefEditText.addTextChangedListener(textWatcher);
        siteEditText.addTextChangedListener(textWatcher);

        longueurSeekBar.setOnSeekBarChangeListener(longueurListener);
        securiteSeekBar.setOnSeekBarChangeListener(securiteListener);

        //clefEditText.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);

        lancer();

    }
    
    // MARK : Initialisations

    private String base = "";
    private static boolean darkMode;

    // MARK : Fonctions

    private void lancer() {

        File mFile = new File(Environment.getExternalStorageDirectory().getPath() + "/Android/data/" + getPackageName() + "/files/" + fileName);

        String text = read(mFile);

        int actualMode = AppCompatDelegate.getDefaultNightMode(); // 1 : Mode Sombre, 2 : Mode clair
        
        darkMode = "DARK".equals(text);

        if (darkMode == (actualMode == 2)){
            setDarkMode();
        }
    }

    private String setDarkMode() {

        File mFile = new File(Environment.getExternalStorageDirectory().getPath() + "/Android/data/" + getPackageName() + "/files/" + fileName);

        String message;

        if (!darkMode){
            AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES);
            message = "Mode clair activé";
            write("LIGHT", mFile);
        }
        else {
            AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO);
            message = "Mode sombre activé";
            write("DARK", mFile);
        }

        startActivity(new Intent(getApplicationContext(), MainActivity.class));

        finish();

        return message;
    }


    private void write(String text, File mFile) {
        try {
            // Flux interne
            FileOutputStream output = openFileOutput(fileName, MODE_PRIVATE);

            // On écrit dans le flux interne

            output.write(text.getBytes());

            if(output != null)
                output.close();

            // Si le fichier est lisible et qu'on peut écrire dedans
            if(Environment.MEDIA_MOUNTED.equals(Environment.getExternalStorageState())
                    && !Environment.MEDIA_MOUNTED_READ_ONLY.equals(Environment.getExternalStorageState())) {
                // On crée un nouveau fichier. Si le fichier existe déjà, il ne sera pas créé
                mFile.createNewFile();
                output = new FileOutputStream(mFile);
                String darkName = "DARK";
                output.write(darkName.getBytes());
                if(output != null)
                    output.close();
            }
        }
        catch (FileNotFoundException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }


    private String read(File mFile) {
        String text = "";
        try{
            FileInputStream input = openFileInput(fileName);
            int value;

            // On utilise un StringBuffer pour construire la chaîne au fur et à mesure
            StringBuffer lu = new StringBuffer();
            // On lit les caractères les uns après les autres
            while ((value = input.read()) != -1) {
                // On écrit dans le fichier le caractère lu
                lu.append((char) value);
            }

            text = lu.toString();

            if (input != null)
                input.close();

            if (Environment.MEDIA_MOUNTED.equals(Environment.getExternalStorageState())) {
                lu = new StringBuffer();
                try {
                    input = new FileInputStream(mFile);
                } catch (FileNotFoundException ex) {
                    ex.printStackTrace();
                }
                while ((value = input.read()) != -1)
                    lu.append((char) value);

                text = lu.toString();

                if (input != null)
                    input.close();
            }
        }catch (FileNotFoundException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        }
        return text;
    }


    private void copier(java.lang.String mot) {
        // Copie le mot dans le presse papier

        if (mot != null) {
            ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            assert clipboard != null;
            android.content.ClipData clip = android.content.ClipData.newPlainText("Mot de passe", mot);
            clipboard.setPrimaryClip(clip);
        }
    }


    private String dec2Base(BigInteger x, String base) {
        // Convertit un BigInteger dans une base ayant base comme support

        BigInteger b = new BigInteger(String.valueOf(base.length()));
        StringBuilder result = new StringBuilder(base.charAt(x.mod(b).intValue()));
        BigInteger un = new BigInteger("1");
        BigInteger deux = new BigInteger("2");
        x = (x.divide(b)).subtract(un);

        while (! (x.add(deux)).equals(un)) {
            int inter = x.mod(b).intValue();
            result.insert(0, base.charAt(inter));
            x = (x.divide(b)).subtract(un);
        }

        return result.toString();
    }


    @SuppressLint("SetTextI18n")
    private void generer() {
        // Génère le mot de passe

        modifBase();
        motPasseEditText.setText("Il manque des valeurs");

        if (clefEditText.getText().toString().length() == 0 || siteEditText.getText().toString().length() == 0) {
            // Rien dans site ou dans clef
        } else if (!(minSwitch.isChecked() || majSwitch.isChecked() || chiSwitch.isChecked() || symSwitch.isChecked())) {
            // Aucun checkbuttons cliqués : Toast pour prévenir

            Toast.makeText(MainActivity.this, "Aucun type de caractères n'est coché", Toast.LENGTH_LONG).show();
        } else {
            // On peut générer le mot de passe

            String clef = clefEditText.getText().toString();
            String site = siteEditText.getText().toString();
            String[] result = modification(site + clef);

            motPasseEditText.setText(result[0]);
        }
        modifSecurite();
    }


    private void modifBase() {
        // Modifie la base suivant les caractères cochés

        base = "";
        if (minSwitch.isChecked()) {
            base += "portezcviuxwhskyajgblndqfm";
        }
        if (majSwitch.isChecked()) {
            base += "THEQUICKBROWNFXJMPSVLAZYDG";
        }
        if (symSwitch.isChecked()) {
            base += "@#&!)-%;<:*$+=/?>(";
        }
        if (chiSwitch.isChecked()) {
            base += "567438921";
        }
    }


    @SuppressLint("SetTextI18n")
    private void modifSecurite() {
        // Modifie la sécurité en fonction des paramètres cochés

        int len2 = longueurSeekBar.getProgress();
        int len = len2 * len2 + 3 * len2 + 10;
        longueurTextView.setText("Longueur : " + len);

        int nb_carac = base.length();

        int bits = (int) ((Math.round(Math.log(Math.pow(nb_carac, len)) / Math.log(2))));
        if (bits == 0) {
            securiteSeekBar.setProgress(bits);
        } else {
            securiteSeekBar.setProgress(bits - 32);
        }
        String[] result = securite(bits);
        securiteTextView.setText(result[0] + bits + " bits");
        securiteTextView.setTextColor(Color.parseColor(result[1]));
    }


    private String[] modification(String mot) {
        // Modifie le site et la clef en un mot de passe (mot = site + clef)

        int len = longueurSeekBar.getProgress();
        int len2 = len * len + 3 * len + 10;

        BigInteger code = new BigInteger(sha256(mot), 16);
        int nb_carac = base.length();


        String code2 = dec2Base(code, base).substring(0, len2);
        System.out.println("=========CODE FINAL==========");
        System.out.println(code2);

        int bits = (int) ((Math.round(Math.log(Math.pow(nb_carac, code2.length())) / Math.log(2))));
        String[] result = securite(bits);
        if (bits == 0) {
            code2 = "";
        }
        return new String[]{code2, result[0] + bits + " bits", Integer.toString(bits), result[1]};
    }


    private String[] securite(int bits) {
        // Renvoie la bonne couleur ainsi que la sécurité suivant le nombre de bits

        String secure;
        String color;
        if (bits == 0) {
            secure = " Aucune ";
            color = "#FE0101";
        } else if (bits < 64) {
            secure = " Très Faible ";
            color = "#FE0101";
        } else if (bits < 80) {
            secure = " Faible ";
            color = "#FE4501";
        } else if (bits < 100) {
            secure = " Moyenne ";
            color = "#FE7601";
        } else if (bits < 126) {
            secure = " Forte ";
            color = "#53FE38";
        } else {
            secure = " Très Forte ";
            color = "#1CD001";
        }
        return new String[]{secure, color};
    }


    private static String sha256(String mot) {
        // Modifie mot en un chiffre en hexadécimal suivant la fonction de hachage sha256

        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(mot.getBytes("UTF-8"));
            StringBuilder hexString = new StringBuilder();

            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }
    }


    // MARK : Actions

    @SuppressLint({"SetTextI18n", "ResourceAsColor", "ResourceType"})
    public void questionChange(View view) {
        // TextView Message Informatif

        final TextView message = new TextView(MainActivity.this);
        message.setText(getString(R.string.info_questions));
        message.setTextSize(15);
        message.setTextColor(Color.parseColor(getString(R.color.colorText)));
        message.setPadding(50, 0, 50, 0);

        // Questions dans les CheckButtons
        String[] questions = {"nom de jeune fille de votre mère", "nom de votre premier animal de compagnie",
                "rue de votre maison d'enfance", "pas de question"};
        final boolean[] checkedItems = {false, false, false, false};

        // Création alert box
        AlertDialog.Builder builder = new AlertDialog.Builder(MainActivity.this, R.style.AlertDialogCustom)
                .setView(message) // Connexion avec message
                .setTitle("Question personnelle :") // Titre
                .setNegativeButton("Annuler", null) // Bouton Annuler
                .setMultiChoiceItems(questions, checkedItems, new DialogInterface.OnMultiChoiceClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which, boolean isChecked) {
                        if (checkedItems[0]) {
                            clefEditText.setHint("nom jeune fille mère");
                            clefEditText.setText("");
                            dialog.cancel();
                        } else if (checkedItems[1]) {
                            clefEditText.setHint("nom premier animal de compagnie");
                            clefEditText.setText("");
                            dialog.cancel();
                        } else if (checkedItems[2]) {
                            clefEditText.setHint("rue maison enfance");
                            clefEditText.setText("");
                            dialog.cancel();
                        } else if (checkedItems[3]) {
                            clefEditText.setHint("mot clef");
                            clefEditText.setText("");
                            dialog.cancel();
                        }
                    }
                });
        builder.show(); // Monter Alert box
    }

    public void copierChange(View view) {
        java.lang.String code = motPasseEditText.getText().toString();
        if (!(code.length() == 0) && !(code.equals("Il manque des valeurs"))) {
            copier(code);
            Toast.makeText(MainActivity.this, "Mot de passe copié dans le presse-papier", Toast.LENGTH_LONG).show();
        } else {
            Toast.makeText(MainActivity.this, "Vous n'avez aucun mot de passe à copier", Toast.LENGTH_LONG).show();
        }
    }

    public void checkChange(View view) {
        // Switch Changé

        generer();
    }

    private TextWatcher textWatcher = new TextWatcher() {
        //Text Watch : génère le mot de passe quand on a fini de modifier le texte
        @Override
        public void beforeTextChanged(CharSequence charSequence, int i, int i1, int i2) {
        }

        @Override
        public void onTextChanged(CharSequence charSequence, int i, int i1, int i2) {
        }

        @Override
        public void afterTextChanged(Editable editable) {
            generer();
        }
    };


    private SeekBar.OnSeekBarChangeListener longueurListener = new SeekBar.OnSeekBarChangeListener() {
        @SuppressLint("SetTextI18n")
        @Override
        public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
            // Longueur Slider en changement

            generer();
        }

        @Override
        public void onStartTrackingTouch(SeekBar seekBar) {

        }

        @Override
        public void onStopTrackingTouch(SeekBar longueur) {

        }
    };


    private SeekBar.OnSeekBarChangeListener securiteListener = new SeekBar.OnSeekBarChangeListener() {
        @SuppressLint("SetTextI18n")
        @Override
        public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
            // Sécurité Slider en changement

            int bits = securiteSeekBar.getProgress() + 32;
            String[] result = securite(bits);
            securiteTextView.setText(result[0] + bits + " bits");
            securiteTextView.setTextColor(Color.parseColor(result[1]));
        }

        @Override
        public void onStartTrackingTouch(SeekBar seekBar) {

        }

        @SuppressLint("SetTextI18n")
        @Override
        public void onStopTrackingTouch(SeekBar seekBar) {
            // Sécurité Slider une fois changée

            int bits = securiteSeekBar.getProgress() + 32;
            if (bits < 42) {
                longueurSeekBar.setProgress(0);
                minSwitch.setChecked(false);
                majSwitch.setChecked(false);
                symSwitch.setChecked(false);
                chiSwitch.setChecked(true);
            } else if (bits < 47) {
                longueurSeekBar.setProgress(0);
                minSwitch.setChecked(false);
                majSwitch.setChecked(false);
                symSwitch.setChecked(true);
                chiSwitch.setChecked(false);
            } else if (bits < 48) {
                longueurSeekBar.setProgress(0);
                minSwitch.setChecked(true);
                majSwitch.setChecked(false);
                symSwitch.setChecked(false);
                chiSwitch.setChecked(false);
            } else if (bits < 51) {
                longueurSeekBar.setProgress(0);
                minSwitch.setChecked(false);
                majSwitch.setChecked(false);
                symSwitch.setChecked(true);
                chiSwitch.setChecked(true);
            } else if (bits < 55) {
                longueurSeekBar.setProgress(0);
                minSwitch.setChecked(true);
                majSwitch.setChecked(false);
                symSwitch.setChecked(false);
                chiSwitch.setChecked(true);
            } else if (bits < 57) {
                longueurSeekBar.setProgress(0);
                minSwitch.setChecked(true);
                majSwitch.setChecked(false);
                symSwitch.setChecked(true);
                chiSwitch.setChecked(false);
            } else if (bits < 61) {
                longueurSeekBar.setProgress(0);
                minSwitch.setChecked(true);
                majSwitch.setChecked(true);
                symSwitch.setChecked(false);
                chiSwitch.setChecked(false);
            } else if (bits < 63) {
                longueurSeekBar.setProgress(0);
                minSwitch.setChecked(true);
                majSwitch.setChecked(true);
                symSwitch.setChecked(true);
                chiSwitch.setChecked(false);
            } else if (bits < 66) {
                longueurSeekBar.setProgress(0);
                minSwitch.setChecked(true);
                majSwitch.setChecked(true);
                symSwitch.setChecked(true);
                chiSwitch.setChecked(true);
            } else if (bits < 67) {
                longueurSeekBar.setProgress(1);
                minSwitch.setChecked(true);
                majSwitch.setChecked(false);
                symSwitch.setChecked(false);
                chiSwitch.setChecked(false);
            } else if (bits < 72) {
                longueurSeekBar.setProgress(1);
                minSwitch.setChecked(false);
                majSwitch.setChecked(false);
                symSwitch.setChecked(true);
                chiSwitch.setChecked(true);
            } else if (bits < 76) {
                longueurSeekBar.setProgress(1);
                minSwitch.setChecked(true);
                majSwitch.setChecked(false);
                symSwitch.setChecked(false);
                chiSwitch.setChecked(true);
            } else if (bits < 80) {
                longueurSeekBar.setProgress(1);
                minSwitch.setChecked(true);
                majSwitch.setChecked(false);
                symSwitch.setChecked(true);
                chiSwitch.setChecked(false);
            } else if (bits < 86) {
                longueurSeekBar.setProgress(1);
                minSwitch.setChecked(true);
                majSwitch.setChecked(true);
                symSwitch.setChecked(false);
                chiSwitch.setChecked(false);
            } else if (bits < 88) {
                longueurSeekBar.setProgress(1);
                minSwitch.setChecked(true);
                majSwitch.setChecked(true);
                symSwitch.setChecked(true);
                chiSwitch.setChecked(false);
            } else if (bits < 94) {
                longueurSeekBar.setProgress(1);
                minSwitch.setChecked(true);
                majSwitch.setChecked(true);
                symSwitch.setChecked(true);
                chiSwitch.setChecked(true);
            } else if (bits < 95) {
                longueurSeekBar.setProgress(2);
                minSwitch.setChecked(true);
                majSwitch.setChecked(false);
                symSwitch.setChecked(false);
                chiSwitch.setChecked(false);
            } else if (bits < 103) {
                longueurSeekBar.setProgress(2);
                minSwitch.setChecked(false);
                majSwitch.setChecked(false);
                symSwitch.setChecked(true);
                chiSwitch.setChecked(true);
            } else if (bits < 109) {
                longueurSeekBar.setProgress(2);
                minSwitch.setChecked(true);
                majSwitch.setChecked(false);
                symSwitch.setChecked(false);
                chiSwitch.setChecked(true);
            } else if (bits < 114) {
                longueurSeekBar.setProgress(2);
                minSwitch.setChecked(true);
                majSwitch.setChecked(false);
                symSwitch.setChecked(true);
                chiSwitch.setChecked(false);
            } else if (bits < 115) {
                longueurSeekBar.setProgress(2);
                minSwitch.setChecked(true);
                majSwitch.setChecked(true);
                symSwitch.setChecked(false);
                chiSwitch.setChecked(false);
            } else if (bits < 123) {
                longueurSeekBar.setProgress(2);
                minSwitch.setChecked(true);
                majSwitch.setChecked(false);
                symSwitch.setChecked(true);
                chiSwitch.setChecked(true);
            } else if (bits < 126) {
                longueurSeekBar.setProgress(2);
                minSwitch.setChecked(true);
                majSwitch.setChecked(true);
                symSwitch.setChecked(true);
                chiSwitch.setChecked(false);
            } else {
                longueurSeekBar.setProgress(2);
                minSwitch.setChecked(true);
                majSwitch.setChecked(true);
                symSwitch.setChecked(true);
                chiSwitch.setChecked(true);
            }
            generer();
        }
    };


    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        // Création menu

        super.onCreateOptionsMenu(menu);

        getMenuInflater().inflate(R.menu.menu_main, menu);

        if (darkMode){
            // Item light
            menu.findItem(R.id.darkmode).setIcon(R.drawable.light);
        }
        else {
            // Item night
            menu.findItem(R.id.darkmode).setIcon(R.drawable.night);
        }

        return true;
    }


    @SuppressLint("Assert")
    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        // Action boutons menu

        switch (item.getItemId()) {

            case R.id.darkmode:
                // DarkMode
                darkMode = !darkMode;
                String message  = setDarkMode();
                //Toast.makeText(MainActivity.this, message, Toast.LENGTH_LONG).show();
                break;

            case R.id.aide:
                // Aide lorsque bouton help est pressé

                final SpannableString s = new SpannableString(getString(R.string.info_app));
                Linkify.addLinks(s, Linkify.ALL);

                final AlertDialog d = new AlertDialog.Builder(this, R.style.AlertDialogCustom)
                        .setTitle("Informations")
                        .setPositiveButton(android.R.string.ok, null)
                        .setMessage(s)
                        .create();

                d.show();
                ((TextView) d.findViewById(android.R.id.message)).setMovementMethod(LinkMovementMethod.getInstance());
                break;

            case R.id.partager:
                // Partage le mot de passe lorsque shareButton est pressé
                java.lang.String code = motPasseEditText.getText().toString();

                if (!(code.length() == 0) && !(code.equals("Il manque des valeurs"))) {
                    java.lang.String site = siteEditText.getText().toString();
                    Intent share = new Intent(android.content.Intent.ACTION_SEND);
                    share.setType("text/plain");
                    share.putExtra(Intent.EXTRA_TEXT, "Mon mot de passe pour " + site + " est :\n" + code);
                    startActivity(Intent.createChooser(share, "Mot de passe"));
                } else {
                    Toast.makeText(MainActivity.this, "Vous n'avez aucun mot de passe à partager", Toast.LENGTH_LONG).show();
                }
                break;
        }
        return super.onOptionsItemSelected(item);
    }
}