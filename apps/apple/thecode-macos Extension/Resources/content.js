if (typeof browser === "undefined") {
    var browser = chrome;
}

(function () {
    const MENU_CLASS = 'pw-suggester-menu';
    let listInput = [];

    function createMenuFor(input) {
        // Déjà créé ?
        if (input.__pwSuggesterMenu || listInput.includes(input)) return;
        listInput.push(input);

        // Demander une proposition au background
        browser.runtime.sendMessage({ action: 'generatePassword', url: location.href }, (response) => {
            
            const menu = document.createElement('div');
            menu.className = 'pw-suggester-menu';
            menu.style.position = 'absolute';
            menu.style.zIndex = 2147483647;
            menu.style.background = 'rgba(0,0,0,0.5';
            menu.style.borderRadius = '4px';
            menu.style.minWidth = '200px';
            menu.style.boxShadow = '0px 2px 6px rgba(0,0,0,0.2)';
            menu.style.cursor = 'default';
            menu.style.padding = '10px';
            menu.style.gap = '10px';
            menu.style.display = 'inline-flex';

            menu.style.backdropFilter = 'blur(3px)';
            menu.style.boxShadow = '0 4px 15px #0006';

            // Position sous l'input
            const rect = input.getBoundingClientRect();
            menu.style.top = `${window.scrollY + rect.bottom + 4}px`;
            menu.style.left = `${window.scrollX + rect.left}px`;

            document.body.appendChild(menu);
            input.__pwSuggesterMenu = menu;
            
            menu.innerHTML = ""; // Nettoyage
            const container = document.createElement('div');
            container.style.padding = '4px';
            container.style.borderRadius = '4px';
            container.style.display = 'flex';
            container.style.gap = '10px';

            // Logo TheCode
            const logo = document.createElement('img');
            logo.src = browser.runtime.getURL('images/128.png');
            logo.style.width = '18px';
            logo.style.height = '18px';
            logo.style.objectFit = 'contain';

            // ➤  AUCUNE CLEF DISPONIBLE
            if (!response || response.error) {
                const noKey = document.createElement('div');
                noKey.innerText = "Aucune clef n'est renseignée";
                noKey.style.color = '#eaeaeaff';
                noKey.style.cursor = 'default';
                noKey.style.fontFamily = 'font-family';
                noKey.style.fontSize = '14px';
                noKey.style.margin = "auto";
                container.appendChild(logo);
                container.appendChild(noKey);
                menu.appendChild(container);
                
                // Disparition quand input perd le focus
                input.addEventListener('blur', () => {
                    removeMenu(input);
                }, { once: true });
                return;
            }
            container.style.cursor = 'pointer';

            // Mot de passe cliquable
            const pwdText = document.createElement('span');
            pwdText.innerText = response.password;
            pwdText.style.flexGrow = "1";
            pwdText.style.margin = "auto";
            pwdText.style.whiteSpace = "nowrap";
            pwdText.style.cursor = "pointer";
            pwdText.style.fontFamily = 'font-family';
            pwdText.style.color = 'white';
            pwdText.style.fontSize = '14px';

            container.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log("coucou");
                input.value = response.password;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                removeMenu(input);
            });

            container.addEventListener('mouseover', () => {
                container.style.background = '#427ee7';
            });
            container.addEventListener('mouseout', () => {
                container.style.background = 'unset';
            });

            // Bouton copier
            const copyBtn = document.createElement('img');
            copyBtn.src = browser.runtime.getURL('images/copy.svg');
            copyBtn.style.height = '22px';
            copyBtn.style.objectFit = 'contain';
            copyBtn.style.background = "transparent";
            copyBtn.style.cursor = "pointer";
            copyBtn.style.border = "none";
            copyBtn.style.padding = '3px';
            copyBtn.style.borderRadius = '4px';
            copyBtn.style.margin = 'auto';

            // POPUP + BACKGROUND
            let popup
            function showCopiedPopup() {

                popup?.remove()

                // Popup
                popup = document.createElement('div');
                popup.innerText = "Mot de passe copié";
                popup.style.fontSize = '14px';
                popup.style.position = 'fixed';
                popup.style.bottom = '20px';
                popup.style.left = '50%';
                popup.style.transform = 'translate(-50%)';
                popup.style.padding = '14px 22px';
                popup.style.fontFamily = 'system-ui';
                popup.style.color = 'white';
                popup.style.fontSize = '15px';
                popup.style.zIndex = 2147483647;
                popup.style.background = 'rgba(0,0,0,0.5)';
                popup.style.borderRadius = '4px';
                popup.style.boxShadow = '0px 2px 6px rgba(0,0,0,0.2)';

                document.body.appendChild(popup);

                // Fade out + suppression après 1s
                setTimeout(() => {
                    setTimeout(() => popup.remove(), 1500);
                }, 50);
            }

            copyBtn.addEventListener('mouseover', () => {
                copyBtn.style.background = 'rgba(0,0,0,0.3)';
            });
            copyBtn.addEventListener('mouseout', () => {
                copyBtn.style.background = 'transparent';
            });

            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(response.password);
                showCopiedPopup();
            });

            // Assemblage du menu
            container.appendChild(logo);
            container.appendChild(pwdText);
            menu.appendChild(container);
            menu.appendChild(copyBtn);
            
            // Disparition quand input perd le focus
            input.addEventListener('blur', () => {
                setTimeout(() => removeMenu(input), 50);
            }, { once: true });
        });
    }

    function removeMenu(input) {
        const menu = input.__pwSuggesterMenu;
        if (menu && menu.parentNode) menu.parentNode.removeChild(menu);
        delete input.__pwSuggesterMenu;
        listInput = listInput.filter(e => e !== input);
    }
    
    // Focus sur input type=password → afficher menu
    document.addEventListener('focusin', (e) => {
        const target = e.target;
        if (target && target.tagName === 'INPUT' && target.type === 'password') {
            createMenuFor(target);
        }
    }, true);

    // Pour inputs créés dynamiquement
    function scanAddMenus() {
        document.querySelectorAll('input[type="password"]').forEach(inp => {
            if (!inp.__pwSuggesterMenu) {
                inp.addEventListener('focusin', () => {
                    if (!inp.__pwSuggesterMenu)
                        createMenuFor(inp);
                }, { once: true });
            }
        });
    }

    window.addEventListener('load', scanAddMenus);
    setInterval(scanAddMenus, 3000);
})();
