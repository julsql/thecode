//
//  popup.js
//  thecode-extension-ios
//
//  Created by Juliette Debono on 29/09/2025.
//


document.addEventListener("DOMContentLoaded", () => {
    browser.runtime.sendNativeMessage({ action: 'getSharedValues' }, async (response) => {
            const minState = response.minState;
            const majState = response.majState;
            const symState = response.symState;
            const chiState = response.chiState;
            const lenghtNumber = response.lenghtNumber;
            const encodingKey = response.encodingKey;

            document.getElementById("minState").textContent = minState ? "Oui" : "Non";
            document.getElementById("majState").textContent = majState ? "Oui" : "Non";
            document.getElementById("symState").textContent = symState ? "Oui" : "Non";
            document.getElementById("chiState").textContent = chiState ? "Oui" : "Non";
            document.getElementById("lenghtNumber").textContent = lenghtNumber;
            document.getElementById("encodingKey").textContent = encodingKey ? "Une clef est définie" : "Pas de clef définie";
        if (!response) {
            document.getElementById("error").textContent = "Erreur : Erreur de lecture";
            return;
        }
    })
});
