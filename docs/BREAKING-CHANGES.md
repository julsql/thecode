# Ruptures de compatibilité

Ce fichier ne liste que les changements qui **modifient un mot de passe déjà
généré**. Tout le reste va dans les CHANGELOG des applications.

## Lot 1 — Canonicalisation unifiée

**Impact : Android, site web, CLI. Extension et apps Apple : aucun.**

### Android

`DomainNormalizer` utilisait une heuristique « deux derniers labels » au lieu de
la Public Suffix List. Les comptes suivants voyaient leur mot de passe changer
selon l'appareil :

| Site                    | Android (avant) | Partout ailleurs        |
| ----------------------- | --------------- | ----------------------- |
| `example.co.uk`         | `co.uk`         | `example.co.uk`         |
| `shop.example.co.uk`    | `co.uk`         | `example.co.uk`         |
| `example.com.br`        | `com.br`        | `example.com.br`        |
| `foo.github.io`         | `github.io`     | `foo.github.io`         |
| `test.s3.amazonaws.com` | `amazonaws.com` | `test.s3.amazonaws.com` |
| `192.168.1.1`           | `1.1`           | `192.168.1.1`           |

Android utilise désormais la PSL. **Les mots de passe de ces comptes changent
sur Android** — ils deviennent ceux que donnaient déjà les autres plateformes.

Autrement dit : Android ne diverge plus. Si tu utilisais déjà un de ces comptes
depuis l'extension ou l'iPhone, c'est le mot de passe correct qui s'applique
enfin partout.

### Site web et CLI

Aucune canonicalisation n'existait : la saisie était hashée telle quelle.
`https://www.google.com/login`, `www.google.com` et `google.com` donnaient trois
mots de passe différents. Ils convergent désormais vers `google.com`.

Une saisie qui ne ressemble pas à un hôte (`serveur perso`, `banque`) reste
inchangée : le champ est libre et sert parfois d'étiquette.

### Retrouver un ancien mot de passe

L'ancienne valeur reste calculable : il suffit de saisir le site sous sa forme
d'avant (`co.uk`, `www.google.com`…) dans le CLI ou sur le site web, qui
laissent les libellés non canonicalisables intacts.
