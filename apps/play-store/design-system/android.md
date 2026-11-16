# Android

Ce qui change par rapport à l'iOS, et pourquoi.

## Correspondance des tokens

| SOUKI 2027 (iOS) | Rôle Android | Écart volontaire |
|---|---|---|
| `souki900` | `primary` | En sombre : `mint300`. |
| `softFill` | `primary-container` | |
| `market700` | `secondary` | `market600` ne peut pas être un rôle M3 : le blanc dessus est à 4,4:1. |
| `market600` | `motion` | Rôle SOUKI, hors M3. |
| `pale50` | `secondary-container` | |
| `orange700` / `orange500` | `tertiary` / `tertiary-container` | L'encre sur l'orange devient `on-tertiary-container`. |
| `red600` | `error` | |
| `cream`, `white`, `section`, `line` | `surface`, `surface-container-lowest`, `surface-container`, `outline-variant` | |
| `ink900`, `ink500`, `ink400` | `on-surface`, `on-surface-variant`, `outline` | `ink500` assombri d'un cran. |
| rayons 8, 14, 18, 22, 24, 30, 40 | 8, 12, 16, 16, 20, 28, 32 | Échelle M3 pour s'aligner sur les composants natifs. |
| `touchMin` 44 | `touch-min` 48 | Exigence Android. |
| verre dépoli (`glass`) | `surface-container` opaque | Le flou coûte trop sur l'entrée de gamme. |

## Navigation

- **Barre de navigation** du bas, variante courte (64 dp, `nav-bar`), libellés toujours visibles : Accueil, Produits, Panier, Commandes, Compte. La variante courte rend 16 dp aux écrans de 640 dp de haut.
- **Mini-barre panier** (`cart-bar`) au-dessus dès le premier produit, sauf sur Panier et la fiche produit.
- **Top app bar** grande qui se replie sur les onglets, petite dans les sous-écrans. En-tête vert sur l'accueil seulement.
- **Bord à bord** : le contenu passe sous les barres système ; la barre de navigation ajoute l'inset bas (gestes ou 3 boutons).
- **Retour prédictif** : l'écran se réduit à 90 %, coins `radius-xl`, et laisse voir l'écran précédent ; les feuilles descendent sous le doigt ; la recherche se referme dans sa barre.

## Transitions

| Passage | Motif | Durée | Courbe | Version allégée |
|---|---|---|---|---|
| Carte produit vers fiche | container transform | `duration-screen` | `ease-emphasized` | fondu 160 ms |
| Étapes (checkout, onboarding) | shared axis X, 30 dp | `duration-slow` | `ease-emphasized` | fondu 160 ms |
| Entre onglets | fade through | `duration-base` | `ease-standard` | coupe franche |
| Feuille du bas | montée | `duration-base` | `ease-emphasized-decelerate` | identique |
| Ajout au panier | enfoncement + badge | `duration-press` | `spring-spatial-fast` | sans rebond |
| Compte à rebours | roulement chiffre par chiffre | `duration-fast` | `ease-souki-out` | changement sec |

## Retours haptiques

Toujours doublés d'un retour visuel.

| Action | Constante |
|---|---|
| Ajout au panier | `CONFIRM` |
| Quantité + ou − | `SEGMENT_TICK` |
| Suppression d'une ligne (seuil du glisser) | `GESTURE_END` |
| Favori | `CONTEXT_CLICK` |
| Appui long sur une carte | `LONG_PRESS` |
| Erreur de saisie | `REJECT` |
| Chiffre du code | `KEYBOARD_TAP` |
| Fin de l'intro | `CLOCK_TICK` |
| Commande validée | `CONFIRM` |

## Notifications

La permission n'est jamais demandée à l'ouverture ni pendant l'onboarding : un écran d'explication, puis la demande système, après la première commande validée. Canaux : Suivi de commande, Abonnements, Compte et sécurité, Nouveautés (désactivé par défaut).
