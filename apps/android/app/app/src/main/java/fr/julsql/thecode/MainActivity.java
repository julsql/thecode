package fr.julsql.thecode;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.ClipboardManager;
import android.content.DialogInterface;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.app.AppCompatDelegate;
import androidx.appcompat.widget.SwitchCompat;

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
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends AppCompatActivity {

    // MARK : Introduction des connexions

    TextView securiteTextView;
    TextView longueurTextView;

    EditText siteEditText;
    EditText clefEditText;
    EditText motPasseEditText;

    Button questionButton;
    Button copierButton;

    SwitchCompat minSwitch;
    SwitchCompat majSwitch;
    SwitchCompat symSwitch;
    SwitchCompat chiSwitch;

    SeekBar longueurSeekBar;
    SeekBar securiteSeekBar;

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

    private static boolean darkMode;
    FileDarkMode fileDarkMode = new FileDarkMode(this, "modeSombre.txt");
    Code code = new Code();

    // MARK : Fonctions

    private void lancer() {

        String text = fileDarkMode.read();

        int actualMode = AppCompatDelegate.getDefaultNightMode(); // 1 : Mode Sombre, 2 : Mode clair
        
        darkMode = "DARK".equals(text);

        if (darkMode == (actualMode == 2)){
            setDarkMode();
        }
    }

    private void setDarkMode() {
        if (!darkMode){
            AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES);
            fileDarkMode.write("LIGHT");
        }
        else {
            AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO);
            fileDarkMode.write("DARK");
        }

        startActivity(new Intent(getApplicationContext(), MainActivity.class));
        finish();
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


    @SuppressLint("SetTextI18n")
    private void generate() {
        // Génère le mot de passe
        motPasseEditText.setText("Il manque des valeurs");

        if (clefEditText.getText().toString().isEmpty() || siteEditText.getText().toString().isEmpty()) {
            // Rien dans site ou dans clef
        } else if (!(minSwitch.isChecked() || majSwitch.isChecked() || chiSwitch.isChecked() || symSwitch.isChecked())) {
            // Aucun checkbuttons cliqués : Toast pour prévenir

            Toast.makeText(MainActivity.this, "Aucun type de caractères n'est coché", Toast.LENGTH_LONG).show();
        } else {
            // On peut générer le mot de passe

            String clef = clefEditText.getText().toString();
            String site = siteEditText.getText().toString();
            updateCode();
            String result = code.getCode(clef, site);

            motPasseEditText.setText(result);
        }
        modifySecurity();
    }

    private void updateCode() {
        code.setMinState(minSwitch.isChecked());
        code.setMajState(majSwitch.isChecked());
        code.setSymState(symSwitch.isChecked());
        code.setChiState(chiSwitch.isChecked());
        code.setLength(longueurSeekBar.getProgress());
        code.setColor();
        code.setSafety();
    }

    private void updateValue() {
        longueurSeekBar.setProgress(code.getLength());
        minSwitch.setChecked(code.isMinState());
        majSwitch.setChecked(code.isMajState());
        symSwitch.setChecked(code.isSymState());
        chiSwitch.setChecked(code.isChiState());
    }


    @SuppressLint("SetTextI18n")
    private void modifySecurity() {
        // Modifie la sécurité en fonction des paramètres cochés
        updateCode();
        int bits = code.getBits();
        if (bits == 0) {
            securiteSeekBar.setProgress(bits);
        } else {
            securiteSeekBar.setProgress(bits - 32);
        }
        modifySecurity(bits);
    }

    @SuppressLint("SetTextI18n")
    private void modifySecurity(int bits) {
        // Modifie la sécurité en fonction des paramètres cochés
        longueurTextView.setText("Longueur : " + code.getBigLength());

        securiteTextView.setText(code.getSafety() + bits + " bits");
        securiteTextView.setTextColor(code.getColor());
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
        String[] hints = {"nom jeune fille mère", "nom premier animal de compagnie",
                "rue maison enfance", "mot clef"};
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
                            clefEditText.setHint(hints[0]);
                        } else if (checkedItems[1]) {
                            clefEditText.setHint(hints[1]);
                        } else if (checkedItems[2]) {
                            clefEditText.setHint(hints[2]);
                        } else if (checkedItems[3]) {
                            clefEditText.setHint(hints[3]);
                        }
                        clefEditText.setText("");
                        dialog.cancel();
                    }
                });
        builder.show(); // Monter Alert box
    }

    public void copierChange(View view) {
        java.lang.String code = motPasseEditText.getText().toString();
        if (!(code.isEmpty()) && !(code.equals("Il manque des valeurs"))) {
            copier(code);
            Toast.makeText(MainActivity.this, "Mot de passe copié dans le presse-papier", Toast.LENGTH_LONG).show();
        } else {
            Toast.makeText(MainActivity.this, "Vous n'avez aucun mot de passe à copier", Toast.LENGTH_LONG).show();
        }
    }

    public void checkChange(View view) {
        // Switch Changé
        generate();
    }

    private final TextWatcher textWatcher = new TextWatcher() {
        //Text Watch : génère le mot de passe quand on a fini de modifier le texte
        @Override
        public void beforeTextChanged(CharSequence charSequence, int i, int i1, int i2) {
        }

        @Override
        public void onTextChanged(CharSequence charSequence, int i, int i1, int i2) {
        }

        @Override
        public void afterTextChanged(Editable editable) {
            generate();
        }
    };


    private final SeekBar.OnSeekBarChangeListener longueurListener = new SeekBar.OnSeekBarChangeListener() {
        @SuppressLint("SetTextI18n")
        @Override
        public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
            // Longueur Slider en changement
            generate();
        }

        @Override
        public void onStartTrackingTouch(SeekBar seekBar) {

        }

        @Override
        public void onStopTrackingTouch(SeekBar longueur) {

        }
    };


    private final SeekBar.OnSeekBarChangeListener securiteListener = new SeekBar.OnSeekBarChangeListener() {
        @SuppressLint("SetTextI18n")
        @Override
        public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
            // Sécurité Slider en changement

            int bits = securiteSeekBar.getProgress() + 32;
            modifySecurity(bits);
        }

        @Override
        public void onStartTrackingTouch(SeekBar seekBar) {

        }

        @SuppressLint("SetTextI18n")
        @Override
        public void onStopTrackingTouch(SeekBar seekBar) {
            // Sécurité Slider une fois changée

            int bits = securiteSeekBar.getProgress() + 32;
            code.setBits(bits);
            updateValue();
            generate();
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


    @SuppressLint({"Assert", "NonConstantResourceId"})
    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        // Action boutons menu

        switch (item.getItemId()) {

            case R.id.darkmode:
                // DarkMode
                darkMode = !darkMode;
                setDarkMode();
                break;

            case R.id.aide:
                // Aide lorsque bouton help est pressé

                final SpannableString s = new SpannableString(getString(R.string.info_app));
                Linkify.addLinks(s, Linkify.ALL);

                final AlertDialog d = new AlertDialog.Builder(this, R.style.AlertDialogCustom)
                        .setTitle("Information")
                        .setPositiveButton(android.R.string.ok, null)
                        .setMessage(s)
                        .create();

                d.show();
                ((TextView) d.findViewById(android.R.id.message)).setMovementMethod(LinkMovementMethod.getInstance());
                break;

            case R.id.partager:
                // Partage le mot de passe lorsque shareButton est pressé
                java.lang.String code = motPasseEditText.getText().toString();

                if (!(code.isEmpty()) && !(code.equals("Il manque des valeurs"))) {
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