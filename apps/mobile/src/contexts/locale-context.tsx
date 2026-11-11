import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { I18nManager, Platform } from "react-native"
import { isRtlLocale, parseLocale, translate, translateUnit, type Locale, type TranslationVars } from "@souki/shared"

import { readItem, writeItem } from "@/lib/device-storage"

const LOCALE_KEY = "souki_lang"

type LocaleContextValue = {
  locale: Locale
  isRtl: boolean
  setLocale: (locale: Locale) => void
  /** Sens d'ecriture a poser sur la racine de chaque ecran (style `direction`). */
  direction: "ltr" | "rtl"
  /** Alignement du texte : `left`/`right` restent absolus (voir swapLeftAndRightInRTL). */
  textAlign: "left" | "right"
  /** Sens des vues natives @expo/ui (prop `layoutDirection` de Host). */
  layoutDirection: "leftToRight" | "rightToLeft"
  /** Locale des dates et nombres (Intl). */
  dateLocale: "fr-MA" | "ar-MA"
  t: (french: string, vars?: TranslationVars) => string
  unit: (unit: string) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

if (Platform.OS !== "web") {
  I18nManager.allowRTL(true)
  // Les styles disent `left`/`right` au sens propre ; le sens vient de `direction`.
  I18nManager.swapLeftAndRightInRTL(false)
}

/**
 * Langue de l'app : francais par defaut, arabe standard en option (darija pour les noms de produits).
 * Le contenu bascule tout de suite via le style `direction` de la racine. I18nManager.forceRTL
 * aligne en plus les elements natifs (en-tete, geste retour) au prochain lancement d'une build
 * EAS ; Expo Go remet ce reglage a zero, d'ou le style explicite.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("fr")

  useEffect(() => {
    let active = true
    readItem(LOCALE_KEY).then((stored) => {
      if (active && stored) setLocaleState(parseLocale(stored))
    })
    return () => {
      active = false
    }
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    writeItem(LOCALE_KEY, next).catch(() => undefined)
    if (Platform.OS !== "web") I18nManager.forceRTL(isRtlLocale(next))
  }, [])

  const value = useMemo<LocaleContextValue>(() => {
    const isRtl = isRtlLocale(locale)
    return {
      locale,
      isRtl,
      setLocale,
      direction: isRtl ? "rtl" : "ltr",
      textAlign: isRtl ? "right" : "left",
      layoutDirection: isRtl ? "rightToLeft" : "leftToRight",
      dateLocale: isRtl ? "ar-MA" : "fr-MA",
      t: (french, vars) => translate(locale, french, vars),
      unit: (unit) => translateUnit(locale, unit),
    }
  }, [locale, setLocale])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const value = useContext(LocaleContext)
  if (!value) throw new Error("useLocale doit etre utilise dans LocaleProvider")
  return value
}
