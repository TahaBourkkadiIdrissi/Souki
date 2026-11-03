"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

import { formatQuantity, productDescriptionFor } from "@/lib/catalogue"
import { LOCALE_COOKIE, formatQuantityAr, translate, unitAr, type Locale } from "@/lib/i18n"

type Vars = Record<string, string | number>

type LocaleContextValue = {
  locale: Locale
  isRtl: boolean
  setLocale: (locale: Locale) => void
  /** A poser sur les zones traduites : arabe de droite a gauche, le reste du site reste en francais. */
  zoneProps: { lang?: string; dir?: "rtl" | "ltr" }
  /** Traduit une phrase francaise ; sans traduction arabe, le francais reste affiche. */
  t: (french: string, vars?: Vars) => string
  /** Nom d'un produit : en darija (ecrit en arabe) sur le site arabe, sinon le nom francais. */
  productName: (product: { name: string; nameAr?: string | null }) => string
  /** Description de la fiche produit dans la langue du site (texte admin, sinon description par defaut). */
  productDescription: (product: { name: string; description?: string | null; descriptionAr?: string | null }) => string
  /** Unite (kg, lot, 250g) et quantite affichees dans la langue du site. */
  unitLabel: (unit: string) => string
  quantityLabel: (quantity: number, unit: string) => string
  /** Langue des dates (Intl) : "ar-MA" sur le site arabe, sinon "fr-MA". */
  dateLocale: string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

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
    (french: string, vars?: Vars) => translate(locale, french, vars),
    [locale],
  )

  const productName = useCallback(
    (product: { name: string; nameAr?: string | null }) => (locale === "ar" && product.nameAr ? product.nameAr : product.name),
    [locale],
  )

  const productDescription = useCallback(
    (product: { name: string; description?: string | null; descriptionAr?: string | null }) => productDescriptionFor(locale, product),
    [locale],
  )

  const unitLabel = useCallback((unit: string) => (locale === "ar" ? unitAr(unit) : unit), [locale])
  const quantityLabel = useCallback(
    (quantity: number, unit: string) => (locale === "ar" ? formatQuantityAr(quantity, unit) : formatQuantity(quantity, unit)),
    [locale],
  )

  const value = useMemo(() => ({
    locale,
    isRtl: locale === "ar",
    setLocale,
    t,
    productName,
    productDescription,
    unitLabel,
    quantityLabel,
    dateLocale: locale === "ar" ? "ar-MA" : "fr-MA",
    zoneProps: locale === "ar" ? { lang: "ar-MA", dir: "rtl" as const } : {},
  }), [locale, setLocale, t, productName, productDescription, unitLabel, quantityLabel])
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const value = useContext(LocaleContext)
  if (!value) throw new Error("useLocale doit etre utilise dans LocaleProvider")
  return value
}
