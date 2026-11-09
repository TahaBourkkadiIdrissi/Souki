import { Easing } from "react-native-reanimated"

/**
 * Langage de mouvement SOUKI (skill expo-animation) : courbes fortes en sortie, ressorts
 * avec la vitesse du doigt, durees courtes. Les animations frequentes restent sous 150 ms.
 */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1)
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1)

/** Ressorts (forme « designer » de Reanimated : duree percue + amortissement). */
export const SPRING_SETTLE = { duration: 400, dampingRatio: 1 } as const
export const SPRING_SNAP = { duration: 350, dampingRatio: 0.75 } as const
/** Petit rebond des confirmations (badge, quantite, coeur). */
export const SPRING_POP = { duration: 300, dampingRatio: 0.55 } as const

/** Durees du design system 2027 (tokens.json > duration). Plafond : DUR_SLOW. */
export const DUR_PRESS = 120
export const DUR_FAST = 160
export const DUR_BASE = 240
export const DUR_SLOW = 300

/** Courbe `ease-out` du design system, pour tout ce qui n'est pas sous le doigt. */
export const EASE_OUT_2027 = Easing.bezier(0.16, 1, 0.3, 1)

/** Ressort quand le doigt est implique (`ease-spring` : damping 16, stiffness 220). */
export const SPRING_FINGER = { damping: 16, stiffness: 220 } as const

/** Enfoncement de tout ce qui se touche (PressableScale). */
export const PRESS_SCALE = 0.97
