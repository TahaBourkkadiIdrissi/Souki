import { Platform } from "react-native"
import Constants, { ExecutionEnvironment } from "expo-constants"
import type { LoginResponseDTO } from "@souki/shared"

import { apiCall } from "@/lib/api"

/**
 * Connexion Google Android (PLAN-ANDROID.md, phase 4) : feuille système de Credential Manager
 * (« Continuer en tant que… »), qui renvoie un ID token dont le destinataire est le client OAuth
 * « Web » du projet Google SOUKI. Le back-end le vérifie déjà (`POST /auth/google`, clients mobiles
 * acceptés) et renvoie le même jeton SOUKI qu'une connexion par e-mail.
 *
 * Disponible seulement dans une vraie build (le module natif n'existe ni dans Expo Go ni sur le
 * web) et quand `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` est fourni à la build. Sinon le bouton est caché :
 * Google Play refuse un bouton qui ne marche pas.
 */
const webClientId = (Constants.expoConfig?.extra?.googleWebClientId as string | null | undefined) ?? null
const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient

type CredentialsModule = typeof import("react-native-credentials-manager")

function loadModule(): CredentialsModule | null {
  if (Platform.OS !== "android" || inExpoGo) return null
  try {
    // Chargé à la demande : absent d'Expo Go, il ferait planter l'app à l'import.
    return require("react-native-credentials-manager") as CredentialsModule
  } catch {
    return null
  }
}

export function googleSignInAvailable(): boolean {
  return Boolean(webClientId) && loadModule() !== null
}

export class GoogleSignInCancelled extends Error {
  constructor() {
    super("cancelled")
    this.name = "GoogleSignInCancelled"
  }
}

/**
 * Ouvre la feuille Google, puis échange l'ID token contre une session SOUKI.
 * Lève `GoogleSignInCancelled` si l'utilisateur ferme la feuille (rien à afficher).
 */
export async function signInWithGoogle(): Promise<LoginResponseDTO> {
  const module = loadModule()
  if (!module || !webClientId) throw new Error("Connexion Google indisponible dans cette version.")
  let idToken: string
  try {
    const credential = await module.signUpWithGoogle({ serverClientId: webClientId, autoSelectEnabled: false })
    idToken = credential.idToken
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : ""
    if (message.includes("cancel")) throw new GoogleSignInCancelled()
    throw error
  }
  return apiCall<LoginResponseDTO>("/auth/google", { method: "POST", body: { token: idToken, role: "CLIENT" }, auth: false })
}

/** À la déconnexion : oublie le compte choisi pour que la feuille repropose tous les comptes. */
export async function forgetGoogleAccount(): Promise<void> {
  try {
    await loadModule()?.signOut()
  } catch {
    // rien
  }
}
