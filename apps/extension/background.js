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
                sessionKey = request.passphrase;
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
        return { error: "Aucune clé de session définie. Ouvre l'extension TheCode et entre ta clé." };
    }
    try {
        const u = new URL(url);
        const hostname = u.hostname;

        const { length = 20, minState = true, majState = true, symState = true, chiState = true } = options;
        const { mdp, security, bits, color } = await generatePassword(hostname, sessionKey, length, minState, majState, symState, chiState);

        return { password: mdp, site: hostname, security, bits, color };
    } catch (err) {
        return { error: err.message };
    }
}

/**
 * Génère un mot de passe déterministe basé sur site + clef
 * et renvoie des informations de sécurité.
 */
async function generatePassword(site, key, length, useLower, useUpper, useSymbols, useNumbers) {
    const charsetGroups = buildCharset(useLower, useUpper, useSymbols, useNumbers);
    if (charsetGroups.length === 0 || (!site && !key)) {
        return buildPasswordResult(null, "Aucune", 0, "#FE0101");
    }

    const entropyBits = calculateEntropyBits(charsetGroups, length);
    const securityInfo = getSecurityLevel(entropyBits);

    const passwordSeed = await hashToBigInt(site + key);
    const rawPassword = convertToBase(passwordSeed, charsetGroups);
    const finalPassword = applyCharsetReplacement(passwordSeed, rawPassword.slice(0, length), charsetGroups);

    return buildPasswordResult(finalPassword, securityInfo.security, entropyBits, securityInfo.color);
}

/** ===================== */
/**        HELPERS        */
/** ===================== */

/**
 * Construit le résultat final d'un mot de passe.
 */
function buildPasswordResult(password, security, bits, color) {
    return { mdp: password, security, bits, color };
}

/**
 * Construit la base de caractères en fonction des options.
 */
function buildCharset(useLower, useUpper, useSymbols, useNumbers) {
    const lower = "portezcviuxwhskyajgblndqfm";
    const upper = "THEQUICKBROWNFXJMPSVLAZYDG";
    const symbols = "@#&!)-%;<:*$+=/?>(";
    const numbers = "567438921";

    return [
        useLower ? lower : "",
        useUpper ? upper : "",
        useSymbols ? symbols : "",
        useNumbers ? numbers : ""
    ].filter(Boolean);
}

/**
 * Calcule le nombre de bits d'entropie pour la longueur et la base données.
 */
function calculateEntropyBits(charsetGroups, length) {
    const totalChars = charsetGroups.reduce((sum, group) => sum + group.length, 0);
    if (totalChars === 0) return 0;

    return Math.round(length * Math.log2(totalChars));
}

/**
 * Détermine le niveau de sécurité en fonction des bits d'entropie.
 */
function getSecurityLevel(bits) {
    if (bits === 0) return { security: "Aucune", color: "#FE0101" };
    if (bits < 64) return { security: "Très Faible", color: "#FE0101" };
    if (bits < 80) return { security: "Faible", color: "#FE4501" };
    if (bits < 100) return { security: "Moyenne", color: "#FE7601" };
    if (bits < 126) return { security: "Forte", color: "#53FE38" };
    return { security: "Très Forte", color: "#1CD001" };
}

/**
 * Transforme une valeur en BigInt en une chaîne dans la base construite.
 */
function convertToBase(x, charsetGroups) {
    const charset = charsetGroups.join("");
    const base = BigInt(charset.length);

    let value = BigInt(x);
    let result = "";
    while (value >= 0) {
        const index = Number(value % base);
        result = charset.charAt(index) + result;
        value = (value / base) - 1n;
        if (value < 0) break;
    }
    return result;
}

/**
 * Remplace certains caractères du mot de passe pour garantir
 * qu'au moins un caractère de chaque groupe est présent.
 */
function applyCharsetReplacement(seed, password, charsetGroups) {
    const length = password.length;
    if (length < charsetGroups.length) {
        throw new Error(`Password must have at least ${charsetGroups.length} characters`);
    }

    let temp = seed;
    const positions = [];

    // Sélection des positions uniques
    for (let i = 0; i < charsetGroups.length; i++) {
        const pos = getUniquePosition(temp, positions, length);
        positions.push(pos);
        temp /= BigInt(length);
    }

    // Remplacement des caractères
    let result = password;
    temp = seed;
    positions.forEach((pos, i) => {
        const group = charsetGroups[i];
        const index = Number(temp % BigInt(group.length));
        result = result.slice(0, pos) + group[index] + result.slice(pos + 1);
        temp /= BigInt(group.length);
    });

    return result;
}

/**
 * Retourne une position unique non utilisée dans le tableau `usedPositions`.
 */
function getUniquePosition(seed, usedPositions, length) {
    let pos = Number(seed % BigInt(length));
    while (usedPositions.includes(pos)) {
        pos = (pos + 1) % length;
    }
    return pos;
}

/**
 * Renvoie le SHA-256 sous forme de BigInt.
 */
async function hashToBigInt(input) {
    const data = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hex = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
    return BigInt("0x" + hex);
}


if (typeof module !== "undefined") {
    module.exports = { generatePassword, buildPasswordResult, buildCharset, calculateEntropyBits, getSecurityLevel, convertToBase, applyCharsetReplacement, getUniquePosition, hashToBigInt };
}
