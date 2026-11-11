/**
 * Fonctions pas encore branchees : cachees dans l'app publiee. Apple refuse les fonctions
 * visibles mais inutilisables (« Bientôt », regle 2.1 de l'App Store). Passer a `true` quand le
 * back-end et la build sont prets.
 */

/**
 * Connexion avec Apple et Google (B1, B2 + `expo-apple-authentication`). Les deux ensemble : des
 * qu'une connexion tierce est proposee, Apple exige aussi Sign in with Apple (regle 4.8).
 */
export const SOCIAL_LOGIN_ENABLED = false

/** Paiement par carte CMI (pas encore de route de paiement). */
export const CARD_PAYMENT_ENABLED = false
