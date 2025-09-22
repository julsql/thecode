if (typeof browser === "undefined") {
    var browser = chrome;
}

(function () {
    const BTN_CLASS = 'pw-suggester-btn';

    function createButtonFor(input) {
        // Si bouton déjà existant, ne rien faire
        if (input.__pwSuggesterBtn) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.innerText = '🔒';
        btn.className = BTN_CLASS;
        btn.style.position = 'absolute';
        btn.style.zIndex = 2147483647;
        btn.style.padding = '3px 6px';
        btn.style.fontSize = '13px';
        btn.style.cursor = 'pointer';

        // position relative to input
        const rect = input.getBoundingClientRect();
        btn.style.top = `${window.scrollY + rect.top}px`;
        btn.style.left = `${window.scrollX + rect.right + 6}px`;

        document.body.appendChild(btn);

        // Stocker la référence pour pouvoir le supprimer
        input.__pwSuggesterBtn = btn;

        // Listener click
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            browser.runtime.sendMessage({ action: 'generatePassword', url: location.href }, (response) => {
                if (!response) return alert("Pas de réponse du background !");
                if (response.error) return alert("Erreur : " + response.error);
                input.value = response.password;
                // Dispatch events pour que le site remarque le changement
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            });
        });

        // Supprimer le bouton quand l'input perd le focus
        input.addEventListener('blur', () => {
            // On attend un petit délai pour laisser le clic s'exécuter
            setTimeout(() => removeButton(input), 100);
        }, { once: true });
    }

    function removeButton(input) {
        const btn = input.__pwSuggesterBtn;
        if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
        delete input.__pwSuggesterBtn;
    }

    // Détection focus sur password
    document.addEventListener('focusin', (e) => {
        const target = e.target;
        if (target && target.tagName === 'INPUT' && target.type === 'password') {
            createButtonFor(target);
        }
    }, true);

    // Scan inputs existants et dynamiques
    function scanAddButtons() {
        document.querySelectorAll('input[type="password"]').forEach(inp => {
            if (!inp.__pwSuggesterBtn) {
                inp.addEventListener('mouseover', () => {
                    if (!inp.__pwSuggesterBtn) createButtonFor(inp);
                }, { once: true });
            }
        });
    }

    window.addEventListener('load', scanAddButtons);
    setInterval(scanAddButtons, 3000);
})();
