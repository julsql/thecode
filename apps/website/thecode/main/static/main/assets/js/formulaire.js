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
const securityInput = document.querySelector('#security');

const mdpOutput = document.querySelector('#mdp');
securityOutput = document.querySelector('#couleur');

function chargerScript(url, callback) {
  const script = document.createElement('script');
  script.src = url;
  script.onload = callback;
  document.head.appendChild(script);
}

function coder(site, clef, longueur, minState, majState, symState, chiState) {
    let result;
    chargerScript('static/main/assets/js/thecode.js', function() {
      // Vous pouvez maintenant utiliser les fonctions du fichier 'autreFichier.js'
       result = coder(site, clef, longueur, minState, majState, symState, chiState);
    });
    return result;
}



function get_security(bits) {
    let result;
    chargerScript('static/main/assets/js/thecode.js', function() {
      // Vous pouvez maintenant utiliser les fonctions du fichier 'autreFichier.js'
       result = get_security(bits);
    });
    return result;
}

// Ajoute un écouteur d'événements "change" à l'élément de formulaire
formulaireInput.addEventListener('change', () => {
    // Code à exécuter lorsque la valeur du formulaire est modifiée

    const result = coder(siteInput.value, clefInput.value, longueurInput.value, minusculesInput.checked, majusculesInput.checked, symbolesInput.checked, chiffresInput.checked);

    if (result !== undefined) {
        mdpOutput.value = result.mdp;
        securityOutput.textContent = result.security + ', ' + result.bits + ' bits';
        securityOutput.style.color = result.color;
        securityInput.value = result.bits;
    } else {
        securityOutput.value = "";
    }
});

// Ajoute un écouteur d'événements "change" à l'élément de formulaire
securityInput.addEventListener('change', () => {
    // Code à exécuter lorsque la bar de sécurité est modifiée
    update_security(securityInput.value);
});

// Définit la fonction à exécuter
function update_security(bits) {

    const resultSecurity = get_security(bits);
    const secure = resultSecurity.secure;
    const color = resultSecurity.color;

     if (secure == null) {
        securityOutput.value = "";
    }
    else {
        securityOutput.textContent = secure + ', ' + bits + ' bits';
        securityOutput.style.color = color;
        securityInput.value = bits;
    }

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
    let longueur;
    let minState;
    let majState;
    let symState;
    let chiState;

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
    if (longueurInput.value === 15) {
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
