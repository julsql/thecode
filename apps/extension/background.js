if (typeof browser === "undefined" && typeof chrome !== "undefined") {
    var browser = chrome;
}

browser?.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
        if (request.action === 'checkSessionKey') {
            sendResponse({ hasSessionKey: !!sessionKey });
        }
        if (request.action === 'getSessionKey') {
            sendResponse({ sessionKey: sessionKey });
        }
        if (request.action === 'setSessionKey') {
            try {
                sessionKey = request.passphrase; // pas de salt → clé toujours identique
                sendResponse({ ok: true });
            } catch (e) {
                sendResponse({ ok: false, error: e.message });
            }
        } else if (request.action === 'clearSessionKey') {
            sessionKey = null;
            sendResponse({ ok: true });
        } else if (request.action === 'generatePassword') {
            const { options } = request;
            const res = await generatePasswordForUrl(request.url || '', options);
            sendResponse(res);
        } else {
            sendResponse({ error: 'action inconnue' });
        }
    })();
    return true;
});

// Code

let sessionKey = null;

async function generatePasswordForUrl(url, options = {}) {
    if (!sessionKey) {
        return { error: "Aucune clé de session définie. Ouvre l'extension et entre ta clé." };
    }
    try {
        const u = new URL(url);
        const hostname = u.hostname;

        const { length = 20, minState = true, majState = true, symState = true, chiState = true } = options;
        const { mdp, security, bits, color } = await coder(hostname, sessionKey, length, minState, majState, symState, chiState);

        return { password: mdp, site: hostname, security, bits, color };
    } catch (err) {
        return { error: err.message };
    }
}

async function coder(site, clef, longueur, minState, majState, symState, chiState) {
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
        mdp = await code(site, clef, base, longueur);
    }

    return {
        mdp: mdp,
        security: security.security,
        bits: bits,
        color: security.color
    };
}

function get_bits(base, longueur) {
    let nbChar = base.length;
    if (nbChar === 0) {
        return 0;
    }
    else {
        if (longueur === 15) {
            return Math.round(Math.log(Math.pow(nbChar, 14)) / Math.log(2));
        }
        else {
            return Math.round(Math.log(Math.pow(nbChar, longueur)) / Math.log(2));
        }
    }
}

function get_security(bits) {
    let color;
    let security;

    if (bits === 0) {
        security = "Aucune";
        color = "#FE0101";
    } else if (bits < 64) {
        security = "Très Faible";
        color = "#FE0101";
    } else if (bits < 80) {
        security = "Faible";
        color = "#FE4501";
    } else if (bits < 100) {
        security = "Moyenne";
        color = "#FE7601";
    } else if (bits < 126) {
        security = "Forte";
        color = "#53FE38";
    } else {
        security = "Très Forte";
        color = "#1CD001";
    }

    return {"security": security, "color": color}
}

async function code(site, clef, base, longueur) {
    const hexHash = await sha256(site + clef);
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

async function sha256(message) {
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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

if (typeof module !== "undefined") {
    module.exports = { coder, get_base, get_bits, get_security, code, sha256, dec2base };
}
