import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import type { CurrentUserDTO, ProfileDTO } from "@souki/shared"

import { ApiError, fetchMe, fetchProfile, login, logout } from "@/lib/api"
import { clearAccessToken, getAccessToken, setAccessToken } from "@/lib/auth-token"

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
  }, [forget])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const acceptToken = useCallback(
    async (token: string, persist = true) => {
      await setAccessToken(token, persist)
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

  const signOut = useCallback(async () => {
    await logout().catch(() => undefined)
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
