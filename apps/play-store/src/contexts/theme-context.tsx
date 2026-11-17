import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { Appearance, Platform, useColorScheme } from "react-native"
import * as SystemUI from "expo-system-ui"

import { readJson, writeJson } from "@/lib/local-store"
import { applyColorScheme, palette, type ColorScheme } from "@/theme"

export type ThemePreference = "system" | "light" | "dark"

const THEME_KEY = "souki.theme.v1"

type ThemeContextValue = {
  /** Thème affiché. */
  scheme: ColorScheme
  /** Choix de l'utilisateur dans Compte > Thème. */
  preference: ThemePreference
  setPreference: (preference: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function parsePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system"
}

/** Style des icônes de la barre d'état sur un fond de l'app (hors en-tête vert). */
export function statusBarStyleFor(scheme: ColorScheme): "light" | "dark" {
  return scheme === "dark" ? "light" : "dark"
}

/**
 * Thème clair / sombre (décision 2 du design : sombre dès la v1). Suit le réglage du téléphone,
 * sauf choix contraire dans Compte > Thème. Les couleurs sont appliquées AVANT le rendu des
 * écrans, puis tout ce qui est en dessous est redessiné (clé = thème) : les écrans lisent
 * `palette` / `colors` au rendu. Les contextes au-dessus (compte, panier, favoris) gardent leur état.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme()
  const [preference, setPreferenceState] = useState<ThemePreference>(() => parsePreference(readJson<unknown>(THEME_KEY, "system")))
  const scheme: ColorScheme = preference === "system" ? (system === "dark" ? "dark" : "light") : preference

  // Synchrone : les couleurs du bon thème doivent être en place avant que les enfants se dessinent.
  applyColorScheme(scheme)

  useEffect(() => {
    // Fond de la fenêtre Android : pas d'éclair clair derrière un écran sombre (transitions, clavier).
    SystemUI.setBackgroundColorAsync(palette.cream).catch(() => undefined)
  }, [scheme])

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    writeJson(THEME_KEY, next)
    if (Platform.OS !== "web") {
      // Les éléments natifs (dialogues, sélecteurs) suivent le même thème que l'app.
      try {
        Appearance.setColorScheme(next === "system" ? "unspecified" : next)
      } catch {
        // Ancienne version de React Native : les éléments natifs suivent le téléphone.
      }
    }
  }, [])

  useEffect(() => {
    if (Platform.OS === "web" || preference === "system") return
    try {
      Appearance.setColorScheme(preference)
    } catch {
      // idem
    }
  }, [preference])

  const value = useMemo(() => ({ scheme, preference, setPreference }), [scheme, preference, setPreference])

  return (
    <ThemeContext.Provider value={value}>
      <Fragment key={scheme}>{children}</Fragment>
    </ThemeContext.Provider>
  )
}

export function useAppTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useAppTheme doit être utilisé dans ThemeProvider")
  return context
}
