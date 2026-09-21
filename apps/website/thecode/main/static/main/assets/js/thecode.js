function coder(site, clef, longueur, minState, majState, symState, chiState) {

    const base = get_base(minState, majState, symState, chiState);
    if (base === "") {
        return {
        mdp: null,
        security: "Aucune",
        bits: 0,
        color: "#FE0101"}
    }
    const bits = get_bits(base, longueur);
    const security = get_security(bits);
    let mdp = "";
    if (site !== "" && clef !== "") {
        mdp = code(site, clef, base, longueur);
        console.log(mdp);
    }

    return {
        mdp: mdp,
        security: security.secure,
        bits: bits,
        color: security.color};
}

function get_bits(base, longueur) {
    let nbChara = base.length;
    if (nbChara === 0) {
        return 0;
    }
    else {
        if (longueur === 15) {
            return Math.round(Math.log(Math.pow(nbChara, 14)) / Math.log(2));
        }
        else {
            return Math.round(Math.log(Math.pow(nbChara, longueur)) / Math.log(2));
        }
    }

}

function get_security(bits) {

    let couleur;
    let secure;

    if (bits === 0) {
        secure = "Aucune";
        couleur = "#FE0101";
    } else if (bits < 64) {
        secure = "Très Faible";
        couleur = "#FE0101";
    } else if (bits < 80) {
        secure = "Faible";
        couleur = "#FE4501";
    } else if (bits < 100) {
        secure = "Moyenne";
        couleur = "#FE7601";
    } else if (bits < 126) {
        secure = "Forte";
        couleur = "#53FE38";
    } else {
        secure = "Très Forte";
        couleur = "#1CD001";
    }

    return {"secure": secure, "color": couleur}
}

function code(site, clef, base, longueur) {
    const hexHash = sha256(site + clef);
    const resultint = BigInt("0x" + hexHash);
    const pass = dec2base(resultint, base);
    if (longueur === 15) {
        return pass.slice(0, 14);
    }
    return pass.slice(0, longueur);
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

function sha256(message) {
    try {
        const sjcl = require('sjcl');
        const myBitArray = sjcl.hash.sha256.hash(message)
        return sjcl.codec.hex.fromBits(myBitArray);
    } catch (error) {
        const myBitArray = sjcl.hash.sha256.hash(message)
        return sjcl.codec.hex.fromBits(myBitArray);
    }
}

function dec2base(x, base) {
    x = BigInt(x);
    const b = BigInt(base.length);
    let result = base[x % b];
    const un = BigInt(1);
    x = (x / b) - un;

    while (x > 0) {
        const inter = Number(x % b);
        result = base.charAt(inter) + result;
        x = (x / b) - un;
    }
    return result;
}

try {
    exports.coder = coder;
    exports.get_security = get_security;
} catch (error) {}
