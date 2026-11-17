import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { AppState } from "react-native"
import type { CurrentUserDTO, ProfileDTO } from "@souki/shared"

import { ApiError, fetchMe, fetchProfile, login, logout, renewSession } from "@/lib/api"
import { clearAccessToken, getAccessToken, setAccessToken } from "@/lib/auth-token"
import { forgetGoogleAccount } from "@/lib/google-sign-in"

export type AuthStatus = "loading" | "guest" | "signedIn"

type AuthContextValue = {
  status: AuthStatus
  user: CurrentUserDTO | null
  profile: ProfileDTO | null
  /** Connexion e-mail ou telephone + mot de passe (comme le site). */
  signIn: (loginId: string, password: string, remember?: boolean) => Promise<void>
  /** Jeton recu apres la verification du code OTP. */
  acceptToken: (token: string) => Promise<void>
  /** Relit le compte et le profil (apres une modification). */
  refresh: () => Promise<void>
  /** Deconnexion de cet appareil (POST /auth/logout puis oubli du jeton). */
  signOut: () => Promise<void>
  /** Oubli local du jeton, sans appel (compte supprime, sessions revoquees). */
  forget: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Compte client de l'app : le jeton JWT est garde dans le Trousseau (lib/auth-token) et
 * envoye en `Authorization: Bearer`. Au demarrage, /auth/me dit si la session est encore
 * valable ; une reponse 401 renvoie en mode invite.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading")
  const [user, setUser] = useState<CurrentUserDTO | null>(null)
  const [profile, setProfile] = useState<ProfileDTO | null>(null)
  const lastRenewal = useRef(0)

  /**
   * Garde le client connecte : le jeton (24 h) est renouvele tant que la session n'a pas ete
   * fermee (« Se déconnecter », « Déconnecter tous les appareils », suppression du compte).
   * Renvoie false seulement si le serveur dit que la session est fermee.
   */
  const renew = useCallback(async () => {
    try {
      const result = await renewSession()
      if (result?.access_token) await setAccessToken(result.access_token)
      lastRenewal.current = Date.now()
      return true
    } catch (error) {
      // 401 : session fermee. Hors connexion, ou back-end pas encore a jour (404) : on garde le jeton.
      return !(error instanceof ApiError && error.status === 401)
    }
  }, [])

  const forget = useCallback(async () => {
    await clearAccessToken()
    setUser(null)
    setProfile(null)
    setStatus("guest")
  }, [])

  const refresh = useCallback(async () => {
    const token = await getAccessToken()
    if (!token) {
      setStatus("guest")
      return
    }
    // Au lancement (et au plus une fois par heure ensuite) : renouvellement du jeton.
    if (Date.now() - lastRenewal.current > 60 * 60 * 1000 && !(await renew())) {
      await forget()
      return
    }
    try {
      const [me, nextProfile] = await Promise.all([fetchMe(), fetchProfile().catch(() => null)])
      setUser(me)
      setProfile(nextProfile)
      setStatus("signedIn")
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) await forget()
      // Hors connexion : on garde l'etat precedent (le jeton reste valable).
      else setStatus((current) => (current === "loading" ? "signedIn" : current))
    }
  }, [forget, renew])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const acceptToken = useCallback(
    async (token: string, persist = true) => {
      await setAccessToken(token, persist)
      // Jeton tout neuf (connexion, code) : pas besoin de le renouveler tout de suite.
      lastRenewal.current = Date.now()
      await refresh()
    },
    [refresh],
  )

  const signIn = useCallback(
    async (loginId: string, password: string, remember = true) => {
      const result = await login(loginId, password)
      await acceptToken(result.access_token, remember)
    },
    [acceptToken],
  )

  // Retour au premier plan : nouveau renouvellement s'il date de plus de 6 h.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || status !== "signedIn" || Date.now() - lastRenewal.current < 6 * 60 * 60 * 1000) return
      void renew().then((alive) => {
        if (!alive) void forget()
      })
    })
    return () => subscription.remove()
  }, [forget, renew, status])

  const signOut = useCallback(async () => {
    await logout().catch(() => undefined)
    // La feuille Google repropose tous les comptes à la prochaine connexion.
    await forgetGoogleAccount()
    await forget()
  }, [forget])

  const value = useMemo(
    () => ({ status, user, profile, signIn, acceptToken, refresh, signOut, forget }),
    [status, user, profile, signIn, acceptToken, refresh, signOut, forget],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext)
  if (!context) throw new Error("useAuth doit etre utilise dans AuthProvider")
  return context
}
