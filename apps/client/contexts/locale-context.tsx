"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

import { ARABIC, LOCALE_COOKIE, type Locale } from "@/lib/i18n"

type Vars = Record<string, string | number>

type LocaleContextValue = {
  locale: Locale
  isRtl: boolean
  setLocale: (locale: Locale) => void
  /** A poser sur les zones traduites : arabe de droite a gauche, le reste du site reste en francais. */
  zoneProps: { lang?: string; dir?: "rtl" | "ltr" }
  /** Traduit une phrase francaise ; sans traduction arabe, le francais reste affiche. */
  t: (french: string, vars?: Vars) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function interpolate(text: string, vars?: Vars) {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match))
}

/**
 * Langue du site client : francais ou arabe standard (de droite a gauche). La darija reste reservee aux noms des produits.
 * Le choix vit dans un cookie lu par le layout serveur, donc la page arrive deja dans la bonne langue.
 * Seules les zones traduites passent en arabe et de droite a gauche (zoneProps) : une page pas encore
 * traduite reste en francais, de gauche a droite, sans ponctuation inversee.
 */
export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
  }, [])

  const t = useCallback(
    (french: string, vars?: Vars) => interpolate(locale === "ar" ? ARABIC[french] ?? french : french, vars),
    [locale],
  )

  const value = useMemo(() => ({
    locale,
    isRtl: locale === "ar",
    setLocale,
    t,
    zoneProps: locale === "ar" ? { lang: "ar-MA", dir: "rtl" as const } : {},
  }), [locale, setLocale, t])
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const value = useContext(LocaleContext)
  if (!value) throw new Error("useLocale doit etre utilise dans LocaleProvider")
  return value
}
