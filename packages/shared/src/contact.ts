/**
 * Contact SOUKI (appel et WhatsApp), le meme numero partout : app iOS, site et PWA.
 * Donne par Salah eddine le 9 novembre 2026.
 */
export const SOUKI_PHONE = "+212703433954"
export const SOUKI_PHONE_DISPLAY = "+212 7 03 43 39 54"

/** Lien d'appel (`tel:`). */
export function soukiCallUrl(): string {
  return `tel:${SOUKI_PHONE}`
}

/** Conversation WhatsApp avec SOUKI, message pre-rempli facultatif. */
export function soukiWhatsAppUrl(message?: string): string {
  const base = `https://wa.me/${SOUKI_PHONE.replace(/^\+/, "")}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}
