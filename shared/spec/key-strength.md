# Robustesse de la clef maîtresse

Toute la sécurité du carnet synchronisé repose sur la clef maîtresse : PBKDF2 à
600 000 itérations ralentit chaque essai, mais quelqu'un qui obtient la base
peut tout de même essayer hors ligne les clefs courantes. Une clef longue et
unique reste la seule vraie défense.

Chaque client affiche donc, près du champ de la clef, un conseil discret et un
indicateur de robustesse. Ce n'est qu'un guide : il **ne bloque jamais** la
définition de la clef.

## Conseil

- FR : « Choisissez une clef longue et unique, par exemple une phrase de
  plusieurs mots : elle protège tous vos mots de passe et votre carnet. »
- EN : "Choose a long, unique key, such as a phrase of several words: it
  protects all your passwords and your vault."

## Calcul

Fonction pure, identique sur toutes les plateformes, appliquée à la clef telle
que le client la retiendra (après son éventuelle normalisation, par exemple le
`trim` de l'extension).

- `n` : nombre de points de code Unicode (pas d'octets ni d'unités UTF-16).
- `mots` : nombre de suites maximales de caractères hors blancs, les blancs
  étant l'espace (U+0020), la tabulation, `\n` et `\r`.
- `classes` : nombre de catégories présentes parmi `a-z`, `A-Z`, `0-9` et
  « autre » (tout le reste : accents, espaces, symboles…). ASCII seulement pour
  les trois premières, afin que toutes les plateformes comptent pareil.

| Condition (dans l'ordre) | Niveau               |
| ------------------------ | -------------------- |
| `n = 0`                  | aucun (rien affiché) |
| `n < 10`                 | faible (`weak`)      |
| `n ≥ 16` ou `mots ≥ 4`   | robuste (`strong`)   |
| `classes ≥ 2`            | moyenne (`fair`)     |
| sinon                    | faible (`weak`)      |

Exemples : `soleil` → faible ; `soleilrouge` → faible (une seule classe) ;
`Soleil rouge` → moyenne ; `un chat va ici` → robuste (4 mots, 14 caractères) ;
`unephrasesansespace` → robuste (≥ 16).

## Affichage

- L'indicateur n'apparaît que pendant la saisie (champ focalisé) ou quand la
  clef est affichée en clair. Clef masquée et champ sans focus : rien, car le
  niveau trahirait une indication de longueur que les applications cachent
  délibérément.
- Le conseil accompagne l'indicateur, et s'affiche aussi tant qu'aucune clef
  n'est saisie.
- Annonce accessible : `aria-live="polite"` sur le web et l'extension,
  `contentDescription` / `accessibilityLabel` dans les applications.
- La clef n'est ni journalisée ni stockée par ce calcul, et rien ne passe par
  le réseau.
