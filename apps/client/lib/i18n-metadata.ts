import type { Metadata } from "next"
import { cookies } from "next/headers"
import { LOCALE_COOKIE, parseLocale, translate, type Locale } from "@/lib/i18n"

/** Langue choisie par le visiteur (cookie). Sans cookie (robots compris) : francais. */
export async function requestLocale(): Promise<Locale> {
  return parseLocale((await cookies()).get(LOCALE_COOKIE)?.value)
}

function translated<T>(locale: Locale, value: T): T {
  return (typeof value === "string" ? translate(locale, value) : value) as T
}

/**
 * Titre et description (page, Open Graph) traduits pour le visiteur qui a choisi l'arabe.
 * Les moteurs de recherche, sans cookie, indexent toujours la version francaise.
 */
export async function localizedMetadata(metadata: Metadata): Promise<Metadata> {
  const locale = await requestLocale()
  if (locale === "fr") return metadata
  return {
    ...metadata,
    title: translated(locale, metadata.title),
    description: translated(locale, metadata.description),
    openGraph: metadata.openGraph && {
      ...metadata.openGraph,
      title: translated(locale, metadata.openGraph.title),
      description: translated(locale, metadata.openGraph.description),
    },
  }
}
