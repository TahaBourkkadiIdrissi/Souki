import { Share } from "react-native"
import { productPath } from "@souki/shared"

import { SITE_URL } from "@/lib/config"

/** Feuille de partage iOS avec le lien public du produit (meme URL que le site). */
export function shareProduct(product: { id: number; name: string }, title: string) {
  const url = `${SITE_URL}${productPath(product)}`
  return Share.share({ url, message: `${title} — SOUKI\n${url}` }).catch(() => undefined)
}
