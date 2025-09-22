// Références aux éléments de la popup
const passInput = document.getElementById('passphrase');
const setBtn = document.getElementById('setKey');
const clearBtn = document.getElementById('clearKey');
const statusDiv = document.getElementById('status');
const generateBtn = document.getElementById('generatePassword');
const site = document.getElementById('site');
const passwordResult = document.getElementById('passwordResult');
const passwordSecurity = document.getElementById('passwordSecurity');
const error = document.getElementById('error');
const siteContainer = document.getElementById('siteContainer');
const passwordResultContainer = document.getElementById('passwordResultContainer');
const passwordSecurityContainer = document.getElementById('passwordSecurityContainer');
const errorContainer = document.getElementById('errorContainer');

if (typeof browser === "undefined") {
    var browser = chrome;
}

// Chargement des paramètres sauvegardés
window.addEventListener('DOMContentLoaded', () => {
    hideResult();
    hideError();
    browser.runtime.sendMessage({ action: 'checkSessionKey' }, (resp) => {
        if (resp && resp.hasSessionKey) {
            statusDiv.style.color = 'green';
            statusDiv.textContent = 'Clé de session définie.';
            browser.runtime.sendMessage({ action: 'getSessionKey' }, (resp) => {
                passInput.value = resp.sessionKey;
            })
        }
    });

    browser.storage.local.get(
        ['length', 'minState', 'majState', 'chiState', 'symState'],
        data => {
            const defaultOptions = { length: 20, minState: true, majState: true, chiState: true, symState: true };
            const options = { ...defaultOptions, ...data };

            document.getElementById('length').value = options.length;
            document.getElementById('lowercase').checked = options.minState;
            document.getElementById('uppercase').checked = options.majState;
            document.getElementById('numbers').checked = options.chiState;
            document.getElementById('symbols').checked = options.symState;
        }
    );
});


// Définir la clé de session
setBtn.addEventListener('click', () => {
    setPassword();
});

// Déclenche setPassword() si on appuie sur "Entrée" dans passInput
passInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        setPassword();
    }
});

function setPassword() {
    const pass = passInput.value.trim();
    if (!pass) {
        return;
    }

    browser.runtime.sendMessage({ action: 'getSessionKey' }, (resp) => {
        if (pass === resp.sessionKey) {
            passInput.value = resp.sessionKey;
            return;
        }
    })

    statusDiv.style.color = 'black';
    statusDiv.textContent = 'Dérivation en cours...';

    browser.runtime.sendMessage({ action: 'setSessionKey', passphrase: pass }, (resp) => {
        if (resp && resp.ok) {
            statusDiv.style.color = 'green';
            statusDiv.textContent = 'Clé de session définie.';
            generatePassword();
        } else {
            statusDiv.style.color = 'red';
            statusDiv.textContent = 'Erreur: ' + (resp && resp.error || 'n/a');
        }
    });
}

// Effacer la clé de session
clearBtn.addEventListener('click', () => {
    browser.runtime.sendMessage({ action: 'clearSessionKey' }, (resp) => {
        if (resp && resp.ok) {
            statusDiv.style.color = 'black';
            statusDiv.textContent = 'Clé de session effacée.';
            passInput.value = '';
            hideResult();
            hideError();
        }
    });
});

// Copier le mot de passe
document.getElementById('copyPasswordBtn').addEventListener('click', () => {
    const pwd = document.getElementById('passwordResult').textContent;
    if (pwd) {
        navigator.clipboard.writeText(pwd).then(() => {
        });
    }
});

// Générer un mot de passe pour l'onglet actif avec les paramètres avancés
generateBtn.addEventListener('click', () => {
    generatePassword();
});

function generatePassword() {
    const length = parseInt(document.getElementById('length').value, 10);
    const minState = document.getElementById('lowercase').checked;
    const majState = document.getElementById('uppercase').checked;
    const chiState = document.getElementById('numbers').checked;
    const symState = document.getElementById('symbols').checked;

    // Sauvegarde automatique des options
    browser.storage.local.set({ length, minState, majState, chiState, symState });

    // Récupération de l'URL de l'onglet actif
    browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || !tabs.length) return;
        const tab = tabs[0];

        // Envoi du message au background pour générer le mot de passe
        browser.runtime.sendMessage(
            {
                action: 'generatePassword',
                url: tab.url,
                options: { length, minState, majState, chiState, symState }
            },
            (response) => {
                if (response.error) {
                    hideResult();
                    showError();
                    error.style.display = 'block';
                    error.textContent = response.error;
                } else if (response.password) {
                    hideError();
                    showResult();
                    site.textContent = response.site;
                    passwordResult.textContent = response.password;
                    passwordSecurity.style.color = response.color;
                    passwordSecurity.textContent = `${response.security} (${response.bits} bits)`;
                } else {
                    hideResult();
                    showError();
                    error.style.display = 'block';
                    error.textContent = 'Pas de réponse.';
                }
            }
        );
    });
}

function hideError() {
    errorContainer.style.display = 'none';
    error.textContent = '';
}

function showError() {
    errorContainer.style.display = 'block';
}

function hideResult() {
    siteContainer.style.display = 'none';
    site.textContent = '';
    passwordResultContainer.style.display = 'none';
    passwordResult.textContent = '';
    passwordSecurityContainer.style.display = 'none';
    passwordSecurity.textContent = '';
}

function showResult() {
    siteContainer.style.display = 'block';
    passwordResultContainer.style.display = 'block';
    passwordSecurityContainer.style.display = 'block';
}