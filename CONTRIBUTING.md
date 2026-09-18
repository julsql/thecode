# Contribuer à TheCode

## La règle qui prime sur toutes les autres

Les six implémentations doivent produire **exactement** le même mot de passe.
Un caractère d'écart et un utilisateur perd l'accès à ses comptes.

C'est pour cela que `shared/` existe, et pour cela que la conformité tourne sur
chaque pull request.

## `shared/` est la source de vérité

| Fichier                     | Rôle                                                         |
| --------------------------- | ------------------------------------------------------------ |
| `test-vectors.json`         | Vecteurs v1 **figés** — ces mots de passe sont en production |
| `canonical-site-cases.json` | Canonicalisation des domaines et divergences connues         |
| `public_suffix_list.dat`    | Liste des suffixes publics                                   |

Ces fichiers sont **copiés** vers chaque toolchain plutôt que référencés : Xcode
et Gradle gèrent mal les références hors projet. Après toute modification :

```sh
make sync-shared
```

`scripts/check-shared.sh` fait échouer la CI si une copie a dérivé. **Ne jamais
éditer une copie.**

## Si la conformité échoue

Corriger l'implémentation, **jamais le vecteur**. Un vecteur qui change est un
utilisateur qui perd ses mots de passe.

Pour les divergences déjà documentées dans `canonical-site-cases.json`, le test
verrouille le comportement **réel**, pas le comportement souhaité : les corriger
change les mots de passe des utilisateurs concernés, ce qui se fera avec le
carnet et un `siteKey` figé.

## Commandes

```sh
make setup                   # environnement local
make test                    # tout sauf les plateformes natives
make test-conformance        # vecteurs partagés, toutes implémentations
make test-conformance-apple  # nécessite un simulateur iOS
make test-e2e                # Playwright sur l'extension
make sync-shared             # après édition de shared/
npx lefthook install         # hooks git
```

## Commits

[Conventional Commits](https://www.conventionalcommits.org), en anglais. Le
scope est l'app touchée : `fix(extension):`, `feat(cli):`, `chore(shared):`.

`release-please` en dérive les versions et les changelogs, une PR de release par
app — les cycles de validation des stores sont trop différents pour être
couplés.

## Sécurité

- La clef maîtresse ne doit jamais être écrite sur disque ni sortir de
  l'extension. `security.spec.js` le vérifie.
- Aucun mot de passe généré n'est stocké, nulle part.
- Les secrets de signature n'entrent pas dans le dépôt : `.gitignore` et le hook
  `pre-commit` les bloquent.
- Une vulnérabilité de dépendance, même en développement, se corrige : la chaîne
  de build d'un gestionnaire de mots de passe est une cible.

## Releases

`release-please` ouvre **une seule PR de release** pour l'ensemble du dépôt, et
non une par application.

C'est délibéré : des PR séparées touchent toutes `.release-please-manifest.json`,
donc merger l'une mettait les autres en conflit. Et release-please ne rebase pas
ses propres PR quand `main` avance — il ne les régénère que si le contenu de la
release change. Le conflit restait donc à demeure.

Les **tags restent par composant** (`extension-v3.0.0`, `apple-v3.0.0`…) et les
workflows de publication se déclenchent par tag. Poser un tag ne publie pas :
chaque boutique garde son propre calendrier, ce que les délais de validation
d'Apple rendent indispensable.

**Ne jamais rebaser une PR de release à la main.** Si elle diverge, fermez-la et
relancez le workflow `release-please` : il la reconstruira proprement.
