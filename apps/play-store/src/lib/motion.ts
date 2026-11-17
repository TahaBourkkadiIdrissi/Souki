import { Easing } from "react-native-reanimated"

/**
 * Langage de mouvement SOUKI Android (tokens.json > duration, easing, spring) : courbes
 * Material 3 pour les écrans, courbe SOUKI pour ce qui entre, ressorts M3 Expressive pour ce
 * qui suit le doigt. Calme : les animations fréquentes restent sous 150 ms, aucune n'empêche
 * d'agir, et « Supprimer les animations » d'Android les remplace par des fondus courts.
 */

/** Courbe SOUKI 2027 (`ease-souki-out`) : tout ce qui entre et n'est pas sous le doigt. */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1)
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1)
export const EASE_OUT_2027 = Easing.bezier(0.16, 1, 0.3, 1)

/** M3 emphasized : transitions d'écran (container transform, shared axis). */
export const EASE_EMPHASIZED = Easing.bezier(0.2, 0, 0, 1)
/** M3 emphasized decelerate : ce qui entre à l'écran (feuille, snackbar). */
export const EASE_EMPHASIZED_DECELERATE = Easing.bezier(0.05, 0.7, 0.1, 1)
/** M3 emphasized accelerate : ce qui quitte l'écran. */
export const EASE_EMPHASIZED_ACCELERATE = Easing.bezier(0.3, 0, 0.8, 0.15)
/** M3 standard : changements d'état sur place (couleur, opacité). */
export const EASE_STANDARD = Easing.bezier(0.2, 0, 0, 1)

/** Les ressorts M3 donnent raideur et taux d'amortissement : damping = taux × 2 × √raideur (masse 1). */
/** Ressorts (forme « designer » de Reanimated : durée perçue + amortissement). */
export const SPRING_SETTLE = { duration: 400, dampingRatio: 1 } as const
export const SPRING_SNAP = { duration: 350, dampingRatio: 0.75 } as const
/** Petit rebond des confirmations (badge, quantité, cœur). */
export const SPRING_POP = { duration: 300, dampingRatio: 0.55 } as const

/** Durées (tokens.json > duration). Plafond des interactions : DUR_SLOW ; DUR_SCREEN pour carte → fiche. */
export const DUR_PRESS = 120
export const DUR_FAST = 160
export const DUR_BASE = 240
export const DUR_SLOW = 300
export const DUR_SCREEN = 400
/** Écart de la cascade d'entrée des sections (montée de 14 dp). */
export const DUR_STAGGER = 40

/** Ce que le doigt tient : feuille, glisser pour supprimer, retour prédictif (`spring-finger`). */
export const SPRING_FINGER = { damping: 16, stiffness: 220 } as const
/** M3 Expressive spatial rapide : quantité, badge du panier. */
export const SPRING_SPATIAL_FAST = { stiffness: 1400, damping: 67, mass: 1 } as const
/** M3 Expressive spatial standard : FAB qui se réduit, indicateur d'onglet. */
export const SPRING_SPATIAL = { stiffness: 700, damping: 48, mass: 1 } as const
/** M3 Expressive effets : couleur et opacité, sans rebond. */
export const SPRING_EFFECTS = { stiffness: 1600, damping: 80, mass: 1 } as const

/** Enfoncement de tout ce qui se touche (`press-scale`). */
export const PRESS_SCALE = 0.97
