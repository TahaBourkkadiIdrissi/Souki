/**
 * Apps mobiles SOUKI publiées sur les stores : Android = la PWA emballée pour Google Play
 * (apps/play-store-pwa, même identifiant io.souki.app), iOS = apps/mobile.
 *
 * Quand l'app Android est publiée sur Google Play (NEXT_PUBLIC_ANDROID_APP_PUBLISHED=true) :
 * - le manifeste PWA annonce l'app Play (`related_applications`, `prefer_related_applications`) :
 *   Chrome propose l'app du store au lieu d'installer la PWA ;
 * - l'invitation d'installation du site devient « Disponible sur Google Play » sur Android,
 *   y compris pour les clients qui ont déjà installé la PWA.
 * Le site souki.io reste le site web ; seule l'installation de la PWA est remplacée.
 */
export const ANDROID_APP_ID = "io.souki.app"
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_APP_ID}`
export const ANDROID_APP_PUBLISHED = process.env.NEXT_PUBLIC_ANDROID_APP_PUBLISHED === "true"

/**
 * Empreintes SHA-256 du certificat de signature de l'app Android (Play Console > Intégrité de
 * l'app > Signature de l'app), séparées par des virgules. Servent aux liens d'app vérifiés
 * (/.well-known/assetlinks.json). Ce ne sont pas des secrets.
 */
export function androidCertFingerprints(): string[] {
  return (process.env.ANDROID_APP_SHA256_FINGERPRINTS ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value))
}
