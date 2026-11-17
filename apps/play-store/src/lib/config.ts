import Constants from "expo-constants"

const DEFAULT_API_BASE_URL = "https://souki.io/backend"

/** URL de l'API (app.config.ts -> extra.apiBaseUrl, surchargeable par EXPO_PUBLIC_API_BASE_URL). */
export const API_BASE_URL: string = (
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) || DEFAULT_API_BASE_URL
).replace(/\/+$/, "")

/** Site public : liens partages, pages A propos, FAQ, confidentialite. */
export const SITE_URL = "https://souki.io"
