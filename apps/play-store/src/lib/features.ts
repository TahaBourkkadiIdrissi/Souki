/**
 * Fonctions pas encore branchées : cachées dans l'app publiée. Google Play, comme l'App Store,
 * refuse les fonctions visibles mais inutilisables. Passer à `true` quand le back-end et la build
 * sont prêts.
 */

/**
 * Bouton « Continuer avec Apple » de l'iOS : jamais sur Android (Sign in with Apple n'y est pas
 * exigé). La connexion Google Android a son propre interrupteur : `googleSignInAvailable()`
 * (lib/google-sign-in.ts), actif dès que le client OAuth est configuré dans la build.
 */
export const SOCIAL_LOGIN_ENABLED = false

/** Paiement par carte CMI (pas encore de route de paiement). */
export const CARD_PAYMENT_ENABLED = false

/**
 * Envoi du jeton de notification de l'appareil au back-end (`POST /api/push/appareils`, table
 * t_mobile_push_devices) : le back-end envoie ensuite via Expo (FCM) à chaque changement de statut.
 */
export const PUSH_TOKEN_REGISTRATION_ENABLED = true

/**
 * Signalement des réponses de l'IA envoyé au back-end (`POST /api/assistant/signalements`, tâche A4).
 * Sans la route, le signalement part par WhatsApp à l'équipe (lib/ai-report.ts).
 */
export const AI_REPORT_ENDPOINT_ENABLED = false
