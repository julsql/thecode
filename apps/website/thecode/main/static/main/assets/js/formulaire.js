// Récupération des éléments

const formulaireInput = document.querySelector('#my_form');

const clefInput = document.querySelector('#id_clef');
const siteInput = document.querySelector('#id_site');

const minusculesInput = document.querySelector('#id_minuscules');
const majusculesInput = document.querySelector('#id_majuscules');
const symbolesInput = document.querySelector('#id_symboles');
const chiffresInput = document.querySelector('#id_chiffres');

const longueurInput = document.querySelector('#id_longueur');
const longueurValueOutput = document.querySelector('#longueur-value');
const securiteInput = document.querySelector('#securite');

const mdpOutput = document.querySelector('#mdp');
securiteOutput = document.querySelector('#couleur');

// Ajoute un écouteur d'événements "change" à l'élément de formulaire
formulaireInput.addEventListener('change', () => {
    // Code à exécuter lorsque la valeur du formulaire est modifiée

    const result = coder(siteInput.value, clefInput.value, longueurInput.value, minusculesInput.checked, majusculesInput.checked, symbolesInput.checked, chiffresInput.checked);

    mdpOutput.value = result.mdp;
    console.log(result.securite);

    if (result.securite == "") {
        securiteOutput.value = "";
    }
    else {
        securiteOutput.textContent = result.securite + ', ' + result.bits + ' bits';
        securiteOutput.style.color = result.color;
        securiteInput.value = result.bits;
    }
});

// Définit la fonction à exécuter
function coder(site, clef, longueur, minState, majState, symState, chiState) {

    console.log(site, clef, longueur, minState, majState, symState, chiState);

    const base = get_base(minState, majState, symState, chiState);
    if (base == "") {
        return {
        mdp: null,
        securite: "Aucune",
        bits: 0,
        color: "#FE0101"}
    }
    const bits = get_bits(base, longueur);
    const securite = get_securite(bits);
    let mdp = "";
    if (site != "" && clef != "") {
        mdp = code(site, clef, base, longueur);
        console.log(mdp);
    }

    return {
        mdp: mdp,
        securite: securite.secure,
        bits: bits,
        color: securite.color};
}

function dec2base(x, base) {
    const b = BigInt(base.length);
    let result = base[x % b];
    const un = BigInt(1);
    const deux = BigInt(2);
    x = (x / b) - un;

    while (x + deux !== un) {
        const inter = Number(x % b);
        result = base.charAt(inter) + result;
        x = (x / b) - un;
    }

    return result;
}

function sha256(message) {

    const myBitArray = sjcl.hash.sha256.hash(message)
    const myHash = sjcl.codec.hex.fromBits(myBitArray)

    return myHash;
}

function code(site, clef, base, longueur) {
    const hexHash = sha256(site + clef);
    const resultint = BigInt("0x" + hexHash);
    const pass = dec2base(resultint, base);
    if (longueur == 15) {
        return pass.slice(0, 14);
    }
    return pass.slice(0, longueur);
}

function get_bits(base, longueur) {
    nb_carac = base.length;
    if (nb_carac == 0) {
        return 0;
    }
    else {
        if (longueur == 15) {
            return Math.round(Math.log(Math.pow(nb_carac, 14)) / Math.log(2));
        }
        else {
            return Math.round(Math.log(Math.pow(nb_carac, longueur)) / Math.log(2));
        }
    }

}

function get_securite(bits) {

    let color = "";
    let secure = "";

    if (bits == 0) {
        secure = "Aucune";
        couleur = "#FE0101";
    }
    else if (bits < 64) {
        secure = "Très Faible";
        couleur = "#FE0101";
    }
    else if (bits < 80) {
        secure = "Faible";
        couleur = "#FE4501";
    }
    else if (bits < 100) {
        secure = "Moyenne";
        couleur = "#FE7601";
    }
    else if (bits < 126) {
        secure = "Forte";
        couleur = "#53FE38";
    }
    else {
        secure = "Très Forte";
        couleur = "#1CD001";
    }

    return {"secure": secure, "color": couleur}
}

function get_base(minState, majState, symState, chiState) {

    let base = "";
    if (minState) {
        base += "portezcviuxwhskyajgblndqfm";
    }
    if (majState) {
        base += "THEQUICKBROWNFXJMPSVLAZYDG";
    }
    if (symState) {
        base += "@#&!)-%;<:*$+=/?>(";
    }
    if (chiState) {
        base += "567438921";
    }
    return base;
}

// Ajoute un écouteur d'événements "change" à l'élément de formulaire
securite.addEventListener('change', () => {
    // Code à exécuter lorsque la bar de sécurité est modifiée
    update_securite(securite.value);
});

// Définit la fonction à exécuter
function update_securite(bits) {
    console.log("Sécurité : " + bits);

    const resultSecurite = get_securite(bits);
    const secure = resultSecurite.secure;
    console.log(resultSecurite);
    const color = resultSecurite.color;

     if (secure == null) {
        securiteOutput.value = "";
    }
    else {
        securiteOutput.textContent = secure + ', ' + bits + ' bits';
        console.log(color);
        securiteOutput.style.color = color;
        securiteInput.value = bits;
    }

    console.log("bits: ")
    console.log(bits);
    const resultState = changeSecureRange(bits);
    longueurInput.value = resultState.longueur;
    minusculesInput.checked = resultState.minState;
    majusculesInput.checked = resultState.majState;
    symbolesInput.checked = resultState.symState;
    chiffresInput.checked = resultState.chiState;

    changeLongueurLabel();

    const resultMdp = coder(siteInput.value, clefInput.value, longueurInput.value, minusculesInput.checked, majusculesInput.checked, symbolesInput.checked, chiffresInput.checked);

    mdpOutput.value = resultMdp.mdp;
}

function changeSecureRange(bits) {
    let longueur = 0;
    let minState = false;
    let majState = false;
    let symState = false;
    let chiState = false;

    if (bits < 42) {
        longueur = 10
        minState = false;
        majState = false;
        symState = false;
        chiState = true;
    }
    else if (bits < 47) {
        longueur = 10
        minState = false;
        majState = false;
        symState = true;
        chiState = false;
    }
    else if (bits < 48) {
        longueur = 10
        minState = true;
        majState = false;
        symState = false;
        chiState = false;
    }
    else if (bits < 51) {
        longueur = 10
        minState = false;
        majState = false;
        symState = true;
        chiState = true;
    }
    else if (bits < 55) {
        longueur = 10
        minState = true;
        majState = false;
        symState = false;
        chiState = true;
    }
    else if (bits < 57) {
        longueur = 10
        minState = true;
        majState = false;
        symState = true;
        chiState = false;
    }
    else if (bits < 61) {
        longueur = 10
        minState = true;
        majState = true;
        symState = false;
        chiState = false;
    }
    else if (bits < 63) {
        longueur = 10
        minState = true;
        majState = true;
        symState = true;
        chiState = false;
    }
    else if (bits < 66) {
        longueur = 10
        minState = true;
        majState = true;
        symState = true;
        chiState = true;
    }
    else if (bits < 67) {
        longueur = 15
        minState = true;
        majState = false;
        symState = false;
        chiState = false;
    }
    else if (bits < 72) {
        longueur = 15
        minState = false;
        majState = false;
        symState = true;
        chiState = true;
    }
    else if (bits < 76) {
        longueur = 15
        minState = true;
        majState = false;
        symState = false;
        chiState = true;
    }
    else if (bits < 80) {
        longueur = 15
        minState = true;
        majState = false;
        symState = true;
        chiState = false;
    }
    else if (bits < 86) {
        longueur = 15
        minState = true;
        majState = true;
        symState = false;
        chiState = false;
    }
    else if (bits < 88) {
        longueur = 15
        minState = true;
        majState = true;
        symState = true;
        chiState = false;
    }
    else if (bits < 94) {
        longueur = 15
        minState = true;
        majState = true;
        symState = true;
        chiState = true;
    }
    else if (bits < 95) {
        longueur = 20
        minState = true;
        majState = false;
        symState = false;
        chiState = false;
    }
    else if (bits < 103) {
        longueur = 20
        minState = false;
        majState = false;
        symState = true;
        chiState = true;
    }
    else if (bits < 109) {
        longueur = 20
        minState = true;
        majState = false;
        symState = false;
        chiState = true;
    }
    else if (bits < 114) {
        longueur = 20
        minState = true;
        majState = false;
        symState = true;
        chiState = false;
    }
    else if (bits < 115) {
        longueur = 20
        minState = true;
        majState = true;
        symState = false;
        chiState = false;
    }
    else if (bits < 123) {
        longueur = 20
        minState = true;
        majState = false;
        symState = true;
        chiState = true;
    }
    else if (bits < 126) {
        longueur = 20
        minState = true;
        majState = true;
        symState = true;
        chiState = false;
    }
    else {
        longueur = 20;
        minState = true;
        majState = true;
        symState = true;
        chiState = true;
    }

    return {"longueur": longueur, "minState": minState, "majState": majState, "symState": symState, "chiState": chiState};
}

function changeLongueurLabel() {
    if (longueurInput.value == 15) {
        longueurValueOutput.value = 14;
    }
    else {
        longueurValueOutput.value = longueurInput.value;
    }
}

// Mise à jour de l'output avec la valeur de l'input range
longueurInput.addEventListener('input', () => {
    changeLongueurLabel();
});

function togglePassword() {
  if (clefInput.type === "password") {
    clefInput.type = "text";
  } else {
    clefInput.type = "password";
  }
}
