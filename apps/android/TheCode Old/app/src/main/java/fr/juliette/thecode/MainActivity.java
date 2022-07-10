package fr.juliette.thecode;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.ClipboardManager;
import android.content.DialogInterface;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.support.annotation.RequiresApi;
import android.support.v7.app.AppCompatActivity;
import android.text.Editable;
import android.text.SpannableString;
import android.text.TextWatcher;
import android.text.method.LinkMovementMethod;
import android.text.util.Linkify;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.view.View.OnClickListener;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.SeekBar;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends AppCompatActivity {

    // Introduction des connexions

    Button genererButton = null;
    Button motButton = null;
    Button chiffreButton = null;
    Button questionButton = null;
    Button helpButton = null;
    Button copyButton = null;

    Switch minSwitch = null;
    Switch majSwitch = null;
    Switch symSwitch = null;
    Switch chiSwitch = null;

    EditText siteEditText = null;
    EditText clefEditText = null;
    EditText aEditText = null;
    EditText bEditText = null;
    EditText motPasseEditText = null;

    TextView securiteTextView = null;
    TextView longueurTextView = null;
    TextView clefTextView = null;

    SeekBar longueurSeekBar = null;
    SeekBar securiteSeekBar = null;

    ImageView separate = null;

    @RequiresApi(api = Build.VERSION_CODES.Q)
    @SuppressLint("SetTextI18n")
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // MARK : Outlets

        genererButton = findViewById(R.id.genererButton);
        motButton = findViewById(R.id.motButton);
        chiffreButton = findViewById(R.id.chiffreButton);
        questionButton = findViewById(R.id.questionButton);
        copyButton = findViewById(R.id.copyButton);
        helpButton = findViewById(R.id.helpButton);

        minSwitch = findViewById(R.id.minSwitch);
        majSwitch = findViewById(R.id.majSwitch);
        symSwitch = findViewById(R.id.symSwitch);
        chiSwitch = findViewById(R.id.chiSwitch);

        siteEditText = findViewById(R.id.siteEditText);
        clefEditText = findViewById(R.id.clefEditText);
        aEditText = findViewById(R.id.aEditText);
        bEditText = findViewById(R.id.bEditText);

        motPasseEditText = findViewById(R.id.motPasseEditText);
        securiteTextView = findViewById(R.id.securiteTextView);
        longueurTextView = findViewById(R.id.longueurTextView);
        clefTextView = findViewById(R.id.typedecodage);

        securiteSeekBar = findViewById(R.id.securiteSeekBar);
        longueurSeekBar = findViewById(R.id.longueurSeekBar);

        separate = findViewById(R.id.separate);

        genererButton.setOnClickListener(genererListener);
        copyButton.setOnClickListener(copyListener);
        helpButton.setOnClickListener(helpListener);
        motButton.setOnClickListener(motListener);
        chiffreButton.setOnClickListener(chiffreListener);
        questionButton.setOnClickListener(questionListener);


        minSwitch.setOnClickListener(minListener);
        majSwitch.setOnClickListener(majListener);
        symSwitch.setOnClickListener(symListener);
        chiSwitch.setOnClickListener(chiListener);

        longueurSeekBar.setOnSeekBarChangeListener(longueurListener);
        securiteSeekBar.setOnSeekBarChangeListener(securiteListener);

        //Text Watch : On text changed : génère le mot de passe

        TextWatcher textWatcher = new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence charSequence, int i, int i1, int i2) {
            }

            @Override
            public void onTextChanged(CharSequence charSequence, int i, int i1, int i2) {
            }

            @Override
            public void afterTextChanged(Editable editable) {
                if (sansgenerer) {
                    generer();
                }
            }
        };

        clefEditText.addTextChangedListener(textWatcher);
        aEditText.addTextChangedListener(textWatcher);
        bEditText.addTextChangedListener(textWatcher);
        siteEditText.addTextChangedListener(textWatcher);

        // MARK : On the beginning

        separate.setVisibility(View.GONE);
        lettre(true);
        modifSafety();
    }

    // MARK : Variables : Initialisation

    // public boolean modeProgrammateur = false;
    // public boolean chiffre = false;
    public boolean sansgenerer = false;
    public static String[] alphabets = {"pamqlsoziekdjfurythgnwbxvc", "wqapmloikxszedcjuyhnvfrtgb", "qaszdefrgthyjukilompcvbnxw", "nhybgtvfrcdexszwqajuiklopm", "mlkjhgfdsqwxcvbnpoiuytreza", "ijnbhuygvcftrdxwsezqakolpm", "poiuytrezamlkjhgfdsqnbvcxw", "wxcvbnqsdfghjklmazertyuiop", "unybtvrcexzwaqikolpmjhgfds", "oplmkjuiytghbnvcfdrezasqxw", "sezqadrftwxcgyvhubjinkolpm", "jfkdlsmqhgpaozieurytvcbxnw", "gftrhdyejsuzkqailompnwbxvc", "frgthyjukilompnbvcxwedzsaq", "gftryehdjsuziakqlopmnwbxvc", "mlkjhgfdsqxecrvtbynuiopwza", "pamqlsoziekdjfurythgnwbvcx", "jklmuiopdfghertyqsazwxcvbn", "vgfcbhdxnjwskiqazolmpertyu", "onbivucyxtwrezapgjhklmfdsq", "portezcviuxwhskyajgblndqfm", "qposidufygthjreklzmawnxbvc", "pwoxicuvbtynrmelzakjhgfdsq", "hajzkelrmtgyfudisoqpnbvxcw", "wqxscdvfbgnhjukilompytreza", "thequickbrownfxjmpsvlazydg", "abcdefghijklmnopqrstuvwxyz"};

    // MARK : Private Fonctions

    public void generer() {
        if (aEditText.getHint() == "a") {
            // Génère le mot de passe avec un codage chiffre
            if (!(aEditText.getText().toString().length() == 0 || bEditText.getText().toString().length() == 0 || siteEditText.getText().toString().length() == 0)) {
                int A = Integer.parseInt(aEditText.getText().toString());
                int B = Integer.parseInt(bEditText.getText().toString());
                String site = siteEditText.getText().toString().toLowerCase();

                if (A % 26 == 0) {
                    A = A+1;
                }
                String[] result = complexification(codeChiffre(longueur(site), A, B));

                if (result[2].equals("0")) {
                    Toast.makeText(MainActivity.this, "Aucun type de caractères n'est coché", Toast.LENGTH_LONG).show();
                }
                motPasseEditText.setText(result[0]);
                modifSafety();
            }
        } else {
            // Génère le mot de passe avec un codage lettre
            if (!(clefEditText.getText().toString().length() == 0 || siteEditText.getText().toString().length() == 0)) {
                String clef = (clefEditText.getText().toString()).toLowerCase();
                String site = siteEditText.getText().toString().toLowerCase();

                String[] result = complexification(codeLettre(longueur(site), clef));

                if (result[2].equals("0")) {
                    Toast.makeText(MainActivity.this, "Aucun type de caractères n'est coché", Toast.LENGTH_LONG).show();
                }
                motPasseEditText.setText(result[0]);
                modifSafety();
            }
        }
    }

    @SuppressLint("SetTextI18n")
    public void lettre(boolean bool) {
        if (bool) {
            clefTextView.setText("Clef :");
            aEditText.setHint("autre");
            clefEditText.setVisibility(View.VISIBLE);
            clefEditText.setText("");
            aEditText.setVisibility(View.GONE);
            bEditText.setVisibility(View.GONE);
        } else {
            clefTextView.setText("Clefs :");
            aEditText.setHint("a");
            aEditText.setVisibility(View.VISIBLE);
            bEditText.setVisibility(View.VISIBLE);
            clefEditText.setVisibility(View.GONE);
        }
    }

    public void copy(java.lang.String mot) {
        // copie le mot
        if (mot != null) {
            ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            assert clipboard != null;
            android.content.ClipData clip = android.content.ClipData.newPlainText("Copied Text", mot);
            clipboard.setPrimaryClip(clip);
        }
    }

    public static String codeLettre(String mot, final String clef) {
        // Code le mot avec la clef
        StringBuilder code = new StringBuilder();
        for (int i = 0; i < mot.length(); i++) {
            String alpha1 = alphabet(mot.charAt(1));
            String alpha2 = alphabet(mot.charAt(0));
            String alpha3 = alphabet(clef.charAt(0));
            code.append(alpha1.charAt((alpha2.indexOf(mot.charAt(i)) + alpha3.indexOf(clef.charAt(i % clef.length()))) % 26));
        }
        return code.toString();
    }

    public static String codeChiffre(String mot, int A, int B) {
        // Code le mot avec les clef A et B
        StringBuilder code = new StringBuilder();
        for (int i = 0; i < mot.length(); i++) {
            String alpha0 = alphabet(mot.charAt(0));
            String alpha1 = alphabet(alpha0.charAt(A % alpha0.length()));
            String alpha2 = alphabet(alpha0.charAt(B % alpha0.length()));
            code.append(alpha1.charAt((A * alpha2.indexOf(mot.charAt(i)) + B) % 26));
        }
        return code.toString();
    }

    public static String longueur(String site) {
        // Corrige la longueur du mot pour faire 20
        String L = alphabet(site.charAt(0));
        StringBuilder site2 = new StringBuilder();

        for (int i = 0; i < (site.length() * 2); i++) {
            if (i % 2 == 0) {
                site2.append(site.charAt(i / 2));
            } else {
                site2.append(L.charAt(i / 2));
            }
        }
        site = site2.toString();
        String T = alphabet(site.charAt(1));
        if (site.length() <= 20) {
            for (int i = 0; i < (20 - site.length()); i++) {
                site2.append(T.charAt(i));
            }
            site = site2.toString();
        } else {
            site = site.substring(0, 20);
        }
        return site;
    }

    public String[] safety(int bits) {
        // Renvoie la bonne couleur ainsi que la sécurité suivant le nombre de bits
        String secure;
        String color;
        if (bits < 64) {
            secure = " Très Faible ";
            color = "#FE0101";
        } else if (bits < 80) {
            secure = " Faible ";
            color = "#FE4501";
        } else if (bits < 100) {
            secure = " Moyenne ";
            color = "#FE7601";
        } else if (bits < 128) {
            secure = " Forte ";
            color = "#53FE38";
        } else {
            secure = " Très Forte ";
            color = "#1CD001";
        }
        return new String[]{secure, color};
    }

    @SuppressLint("SetTextI18n")
    public void modifSafety() {
        // Modifie la sécurité en fonction des paramètres cochés
        int len2 = longueurSeekBar.getProgress();
        int len = len2 * len2 + 3 * len2 + 10;
        longueurTextView.setText("Longueur : " + len);
        int nb_carac = 0;

        if (minSwitch.isChecked()) {
            nb_carac = nb_carac + 26;
        }
        if (majSwitch.isChecked()) {
            nb_carac = nb_carac + 26;
        }
        if (symSwitch.isChecked()) {
            nb_carac = nb_carac + 26;
        }
        if (chiSwitch.isChecked()) {
            nb_carac = nb_carac + 10;
        }

        int bits = (int) ((Math.round(Math.log(Math.pow(nb_carac, len)) / Math.log(2))));
        String[] result = safety(bits);
        securiteSeekBar.setProgress(bits - 33);
        securiteTextView.setText(result[0] + bits + " bits");
        securiteTextView.setTextColor(Color.parseColor(result[1]));
    }

    public static String alphabet(char letter) {
        // Génère un alphabet selon la lettre donnée
        return alphabets[alphabets[26].indexOf(letter)];
    }

    public String[] complexification(String code) {
        // Complexifie le mot de passe

        boolean minState = minSwitch.isChecked();
        boolean majState = majSwitch.isChecked();
        boolean symState = symSwitch.isChecked();
        boolean chiState = chiSwitch.isChecked();

        String alpha1 = alphabet(code.charAt(0)).toUpperCase();
        String alpha2 = alphabet(code.charAt(1));
        String symboles = "@#&!)-_%;:*$+=/?<>&-?($*@#";

        StringBuilder code2 = new StringBuilder();
        int len = code.length();
        int nb_carac;
        char lettrei;

        if (minState && !majState && !symState && !chiState) {
            nb_carac = 26;
            code2 = new StringBuilder(code);
        } else if (!minState && majState && !symState && !chiState) {
            nb_carac = 26;
            code2 = new StringBuilder(code.toUpperCase());
        } else if (!minState && !majState && symState && !chiState) {
            nb_carac = 26;
            for (int i = 0; i < len; i++) {
                lettrei = code.charAt(i);
                code2.append(symboles.charAt(alpha2.indexOf(lettrei)));
            }
        } else if (!minState && !majState && !symState && chiState) {
            nb_carac = 10;
            for (int i = 0; i < len; i++) {
                lettrei = code.charAt(i);
                code2.append(alpha2.indexOf(lettrei));
            }
        } else if (minState && majState && !symState && !chiState) {
            nb_carac = 52;
            for (int i = 0; i < len; i++) {
                if (i % 2 == 0) {
                    code = code.toLowerCase();
                } else {
                    code = code.toUpperCase();
                }
                lettrei = code.charAt(i);
                code2.append(lettrei);
            }
        } else if (minState && !majState && symState && !chiState) {
            nb_carac = 52;
            for (int i = 0; i < len; i++) {
                lettrei = code.charAt(i);
                if (i % 2 == 0) {
                    code2.append(symboles.charAt(alpha2.indexOf(lettrei)));
                } else {
                    code2.append(lettrei);
                }
            }
        } else if (minState && !majState && !symState) {
            nb_carac = 36;
            for (int i = 0; i < len; i++) {
                lettrei = code.charAt(i);
                if (i % 2 == 0) {
                    code2.append(lettrei);
                } else {
                    code2.append(alpha2.indexOf(lettrei));
                }
            }
        } else if (!minState && majState && symState && !chiState) {
            nb_carac = 52;
            code = code.toUpperCase();
            for (int i = 0; i < len; i++) {
                lettrei = code.charAt(i);
                if (i % 2 == 0) {
                    code2.append(symboles.charAt(alpha1.indexOf(lettrei)));
                } else {
                    code2.append(lettrei);
                }
            }
        } else if (!minState && majState && !symState) {
            nb_carac = 36;
            code = code.toUpperCase();
            for (int i = 0; i < len; i++) {
                lettrei = code.charAt(i);
                if (i % 2 == 0) {
                    code2.append(lettrei);
                } else {
                    code2.append(alpha1.indexOf(lettrei));
                }
            }
        } else if (!minState && !majState && symState) {
            nb_carac = 36;
            for (int i = 0; i < len; i++) {
                lettrei = code.charAt(i);
                if (i % 2 == 0) {
                    code2.append(symboles.charAt(alpha2.indexOf(lettrei)));
                } else {
                    code2.append(alpha2.indexOf(lettrei));
                }
            }
        } else if (minState && majState && symState && !chiState) {
            nb_carac = 78;
            for (int i = 0; i < len; i++) {
                if (i % 3 == 0) {
                    code = code.toLowerCase();
                    lettrei = code.charAt(i);
                    code2.append(symboles.charAt(alpha2.indexOf(lettrei)));
                } else if (i % 3 == 1) {
                    code = code.toLowerCase();
                    lettrei = code.charAt(i);
                    code2.append(lettrei);
                } else {
                    code = code.toUpperCase();
                    lettrei = code.charAt(i);
                    code2.append(lettrei);
                }
            }
        } else if (!minState && majState) {
            nb_carac = 62;
            for (int i = 0; i < len; i++) {
                if (i % 3 == 0) {
                    code = code.toLowerCase();
                    lettrei = code.charAt(i);
                    code2.append(alpha2.indexOf(lettrei));
                } else if (i % 3 == 1) {
                    code = code.toLowerCase();
                    lettrei = code.charAt(i);
                    code2.append(symboles.charAt(alpha2.indexOf(lettrei)));
                } else {
                    code = code.toUpperCase();
                    lettrei = code.charAt(i);
                    code2.append(lettrei);
                }
            }
        } else if (minState && !majState) {
            nb_carac = 62;
            for (int i = 0; i < len; i++) {
                lettrei = code.charAt(i);
                if (i % 3 == 0) {
                    code2.append(lettrei);
                } else if (i % 3 == 1) {
                    code2.append(symboles.charAt(alpha2.indexOf(lettrei)));
                } else {
                    code2.append(alpha2.indexOf(lettrei));
                }
            }
        } else if (minState && !symState) {
            nb_carac = 62;
            for (int i = 0; i < len; i++) {
                if (i % 3 == 0) {
                    code = code.toUpperCase();
                    lettrei = code.charAt(i);
                    code2.append(lettrei);
                } else if (i % 3 == 1) {
                    code = code.toLowerCase();
                    lettrei = code.charAt(i);
                    code2.append(lettrei);
                } else {
                    code = code.toLowerCase();
                    lettrei = code.charAt(i);
                    code2.append(alpha2.indexOf(lettrei));
                }
            }
        } else if (minState) {
            nb_carac = 88;
            for (int i = 0; i < len; i++) {
                if (i % 4 == 0) {
                    code = code.toLowerCase();
                    lettrei = code.charAt(i);
                    code2.append(symboles.charAt(alpha2.indexOf(lettrei)));
                } else if (i % 4 == 1) {
                    code = code.toLowerCase();
                    lettrei = code.charAt(i);
                    code2.append(lettrei);
                } else if (i % 4 == 2) {
                    code = code.toLowerCase();
                    lettrei = code.charAt(i);
                    code2.append(alpha2.indexOf(lettrei));
                } else {
                    code = code.toUpperCase();
                    lettrei = code.charAt(i);
                    code2.append(lettrei);
                }
            }
        } else {
            nb_carac = 0;
            code2 = new StringBuilder(code);
        }
        int len2 = longueurSeekBar.getProgress();
        int len3 = len2 * len2 + 3 * len2 + 10;
        String code3 = code2.toString().substring(0, len3);
        int bits = (int) ((Math.round(Math.log(Math.pow(nb_carac, code3.length())) / Math.log(2))));
        String[] result = safety(bits);
        if (bits == 0) {
            code3 = "";
        }
        return new String[]{code3, result[0] + bits + " bits", Integer.toString(bits), result[1]};
    }

    private void modeProgrammateurOn(){
        // Mode programmateur activé : régler paramètres
        AlertDialog.Builder builder = new AlertDialog.Builder(MainActivity.this);
        builder.setTitle("Choix des paramètres");
        String[] questions = {"Enlever le bouton générer"};
        final boolean[] checkedItems = {sansgenerer};
        builder.setMultiChoiceItems(questions, checkedItems, new DialogInterface.OnMultiChoiceClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which, boolean isChecked) {
                // Choix codage chiffre
                //chiffre = checkedItems[0];

                // Choix bouton générer
                sansgenerer = checkedItems[0];
            }
        });
        builder.setPositiveButton("OK", okListener(/*modeProgrammateur*/));
        // builder.setNegativeButton("Quitter Mode", okListener(false));
        AlertDialog dialog = builder.create();
        dialog.show();
    }

    // MARK : Actions

    private OnClickListener genererListener = new OnClickListener() {
        @RequiresApi(api = Build.VERSION_CODES.LOLLIPOP)
        @SuppressLint({"SetTextI18n", "WrongConstant"})
        @Override
        public void onClick(View v) {
            // Codage lorsque genererButton est pressé
            generer();
        }
    };

    private OnClickListener chiffreListener = new OnClickListener() {
        @SuppressLint("SetTextI18n")
        @Override
        public void onClick(View v) {
            lettre(false);
        }
    };

    private OnClickListener motListener = new OnClickListener() {
        @SuppressLint("SetTextI18n")
        @Override
        public void onClick(View v) {
            clefEditText.setHint("mot clef");
            lettre(true);
        }
    };

    private OnClickListener questionListener = new OnClickListener() {

        @SuppressLint("SetTextI18n")
        @Override
        public void onClick(View v) {


            AlertDialog.Builder builder = new AlertDialog.Builder(MainActivity.this);
            builder.setTitle("À quelle question voulez-vous répondre ?");
            String[] questions = {"nom jeune fille mère", "nom premier animal de compagnie", "rue maison enfance"};
            final boolean[] checkedItems = {false, false, false};
            builder.setMultiChoiceItems(questions, checkedItems, new DialogInterface.OnMultiChoiceClickListener() {
                @Override
                public void onClick(DialogInterface dialog, int which, boolean isChecked) {
                    if (checkedItems[0]) {
                        clefEditText.setHint("nom de jeune fille de votre mère");
                        lettre(true);
                        dialog.cancel();
                    } else if (checkedItems[1]) {
                        clefEditText.setHint("nom de votre premier animal de compagnie");
                        lettre(true);
                        dialog.cancel();
                    } else if (checkedItems[2]) {
                        clefEditText.setHint("rue de la maison de votre enfance");
                        lettre(true);
                        dialog.cancel();
                    }
                }
            });

            builder.setNegativeButton("Annuler", null);

            AlertDialog dialog = builder.create();
            dialog.show();
        }
    };

    private SeekBar.OnSeekBarChangeListener longueurListener = new SeekBar.OnSeekBarChangeListener() {
        @SuppressLint("SetTextI18n")
        @Override
        public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
            // Longueur Slider change
            modifSafety();
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
            // Sécurité Slider change
            int bits = securiteSeekBar.getProgress() + 33;
            String[] result = safety(bits);
            securiteTextView.setText(result[0] + bits + " bits");
            securiteTextView.setTextColor(Color.parseColor(result[1]));
        }

        @Override
        public void onStartTrackingTouch(SeekBar seekBar) {

        }

        @SuppressLint("SetTextI18n")
        @Override
        public void onStopTrackingTouch(SeekBar seekBar) {
            // Sécurité Slider change
            int bits = securiteSeekBar.getProgress() + 33;
            if (bits < 47) {
                longueurSeekBar.setProgress(0);
                minSwitch.setChecked(false);
                majSwitch.setChecked(false);
                symSwitch.setChecked(false);
                chiSwitch.setChecked(true);
            } else if (bits < 52) {
                longueurSeekBar.setProgress(0);
                minSwitch.setChecked(true);
                majSwitch.setChecked(false);
                symSwitch.setChecked(false);
                chiSwitch.setChecked(false);
            } else if (bits < 57) {
                longueurSeekBar.setProgress(0);
                minSwitch.setChecked(true);
                majSwitch.setChecked(false);
                symSwitch.setChecked(false);
                chiSwitch.setChecked(true);
            } else if (bits < 60) {
                longueurSeekBar.setProgress(0);
                minSwitch.setChecked(true);
                majSwitch.setChecked(true);
                symSwitch.setChecked(false);
                chiSwitch.setChecked(false);
            } else if (bits < 63) {
                longueurSeekBar.setProgress(0);
                minSwitch.setChecked(true);
                majSwitch.setChecked(true);
                symSwitch.setChecked(false);
                chiSwitch.setChecked(true);
            } else if (bits < 65) {
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
            } else if (bits < 72) {
                longueurSeekBar.setProgress(1);
                minSwitch.setChecked(true);
                majSwitch.setChecked(false);
                symSwitch.setChecked(false);
                chiSwitch.setChecked(false);
            } else if (bits < 80) {
                longueurSeekBar.setProgress(1);
                minSwitch.setChecked(true);
                majSwitch.setChecked(false);
                symSwitch.setChecked(false);
                chiSwitch.setChecked(true);
            } else if (bits < 83) {
                longueurSeekBar.setProgress(1);
                minSwitch.setChecked(true);
                majSwitch.setChecked(true);
                symSwitch.setChecked(false);
                chiSwitch.setChecked(false);
            } else if (bits < 88) {
                longueurSeekBar.setProgress(1);
                minSwitch.setChecked(true);
                majSwitch.setChecked(true);
                symSwitch.setChecked(false);
                chiSwitch.setChecked(true);
            } else if (bits < 90) {
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
            } else if (bits < 103) {
                longueurSeekBar.setProgress(2);
                minSwitch.setChecked(true);
                majSwitch.setChecked(false);
                symSwitch.setChecked(false);
                chiSwitch.setChecked(false);
            } else if (bits < 114) {
                longueurSeekBar.setProgress(2);
                minSwitch.setChecked(true);
                majSwitch.setChecked(false);
                symSwitch.setChecked(false);
                chiSwitch.setChecked(true);
            } else if (bits < 119) {
                longueurSeekBar.setProgress(2);
                minSwitch.setChecked(true);
                majSwitch.setChecked(true);
                symSwitch.setChecked(false);
                chiSwitch.setChecked(false);
            } else if (bits < 126) {
                longueurSeekBar.setProgress(2);
                minSwitch.setChecked(true);
                majSwitch.setChecked(true);
                symSwitch.setChecked(false);
                chiSwitch.setChecked(true);
            } else if (bits < 129) {
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
            modifSafety();
            generer();
        }
    };

    private OnClickListener minListener = new OnClickListener() {
        @RequiresApi(api = Build.VERSION_CODES.Q)
        @SuppressLint("SetTextI18n")
        @Override
        public void onClick(View v) {
            // Minuscules Switch Change
            modifSafety();
            generer();
        }
    };
    private OnClickListener majListener = new OnClickListener() {
        @RequiresApi(api = Build.VERSION_CODES.Q)
        @SuppressLint("SetTextI18n")
        @Override
        public void onClick(View v) {
            // Majuscules Switch Change
            modifSafety();
            generer();
        }
    };
    private OnClickListener symListener = new OnClickListener() {
        @RequiresApi(api = Build.VERSION_CODES.Q)
        @SuppressLint("SetTextI18n")
        @Override
        public void onClick(View v) {
            // Symboles Switch Change
            modifSafety();
            generer();
        }
    };
    private OnClickListener chiListener = new OnClickListener() {
        @RequiresApi(api = Build.VERSION_CODES.Q)
        @SuppressLint("SetTextI18n")
        @Override
        public void onClick(View v) {
            // Chiffres Switch Change
            modifSafety();
            generer();
        }
    };

    private OnClickListener helpListener = new OnClickListener() {
        @Override
        public void onClick(View v) {
            // Aide lorsque bouton help est pressé
            final SpannableString s = new SpannableString("     Vous pouvez choisir entre coder avec une clef dont vous devez vous souvenir, ou entrer des informations personnelles qui serviront de clef pour le codage, vous évitant de devoir vous souvenir d'une clef");
            Linkify.addLinks(s, Linkify.ALL);

            final AlertDialog d = new AlertDialog.Builder(MainActivity.this)
                    .setPositiveButton(android.R.string.ok, null)
                    .setMessage(s)
                    .create();

            d.show();
            ((TextView) d.findViewById(android.R.id.message)).setMovementMethod(LinkMovementMethod.getInstance());
        }
    };

    private OnClickListener copyListener = new OnClickListener() {
        @Override
        public void onClick(View v) {
            // Copie le mot de passe lorsque copyButton est pressé
            java.lang.String code = motPasseEditText.getText().toString();
            if (!(code.length() == 0) && !(code.equals("Il manque des valeurs"))) {
                copy(code);
                Toast.makeText(MainActivity.this, "Mot de passe copié dans le presse-papier", Toast.LENGTH_LONG).show();
            } else {
                Toast.makeText(MainActivity.this, "Vous n'avez aucun mot de passe à copier", Toast.LENGTH_LONG).show();
            }
        }
    };

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        // Création menu
        getMenuInflater().inflate(R.menu.menu_main, menu);
        return true;
    }

    @SuppressLint("Assert")
    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        // Action boutons menu

        switch (item.getItemId()){

            case R.id.aide :
                // Aide lorsque bouton help est pressé

                final SpannableString s = new SpannableString("     Cette application vous permet de générer des mots de passe, non pas aléatoirement, mais en fonction du nom du site où vous souhaitez vous connecter.\n\n     Par exemple, vous désirez changer le mot de passe de votre compte Google. Vous n’avez alors qu’à entrer dans 'google' dans « nom du site », puis choisir entre une clef ou une question (pour plus d'informations, cliquez sur le point d'interrogation à coté des boutons), les caractères souhaités, la longueur du mot de passe, enfin entrez la clef ou la réponse à la question, et le code sera généré.\n\n     Ensuite, pour le retrouver, vous n’avez qu’à reprendre l’application, toujours mettre 'google' dans nom du site, les mêmes informations, et vous obtiendrez le bon mot de passe.\n\n     Le bouton à côté du mot de passe généré sert à copier le mot de passe dans votre presse-papier\n\n     Pour plus d'information sur la sécurité des mots de passe, vous pouvez consulter ce site :\n  * https://www.ssi.gouv.fr/administration/precautions-elementaires/calculer-la-force-dun-mot-de-passe/");
                Linkify.addLinks(s, Linkify.ALL);

                final AlertDialog d = new AlertDialog.Builder(this)
                        .setPositiveButton(android.R.string.ok, null)
                        .setMessage(s)
                        .create();

                d.show();
                ((TextView) d.findViewById(android.R.id.message)).setMovementMethod(LinkMovementMethod.getInstance());

            case R.id.share :
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

            case R.id.settings :
                modeProgrammateurOn();
        }
        return super.onOptionsItemSelected(item);
    }

    private DialogInterface.OnClickListener okListener(/*final boolean mode*/) {
        // Changer paramètres lorsque boutons ok ou quitter sont cliqués
        return new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                if (sansgenerer){
                    genererButton.setVisibility(View.GONE);
                    separate.setVisibility(View.VISIBLE);
                }
                else{
                    genererButton.setVisibility(View.VISIBLE);
                    separate.setVisibility(View.GONE);
                }
            }
        };
    }
}
