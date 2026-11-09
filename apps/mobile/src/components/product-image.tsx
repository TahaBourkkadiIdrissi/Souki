import { Image, type ImageStyle } from "expo-image"
import { View, type StyleProp } from "react-native"

import { SITE_URL } from "@/lib/config"
import { palette } from "@/theme"

type ProductImageProps = {
  uri: string
  style?: StyleProp<ImageStyle>
  /**
   * `cover` (par defaut) : la photo remplit le cadre.
   * `inset` (design system 2027) : pour une illustration sur fond blanc, produit entier, 10 % de
   * marge, fond blanc fondu dans le vert pale (`multiply`). Une vraie photo reste en `cover`,
   * comme sur le site (apps/client : isIllustrationImage).
   */
  variant?: "cover" | "inset"
}

/** Chemin relatif du site (« /images/legumes/tomate.png ») -> adresse complete sur souki.io. */
function absolute(uri: string): string {
  return uri.startsWith("/") ? `${SITE_URL}${uri}` : uri
}

/**
 * Illustration detouree sur fond blanc : seulement les images locales du site (/images/…),
 * exactement la regle de apps/client/lib/catalogue.ts. Les photos du catalogue (Pixabay,
 * photos de l'admin) ont un vrai decor : elles remplissent le cadre.
 */
function isIllustration(uri: string): boolean {
  return uri.startsWith("/images/") || uri.startsWith(`${SITE_URL}/images/`)
}

/** Photo produit (memes photos que le site) : cache disque, fondu court, fond photo-bg pendant le chargement. */
export function ProductImage({ uri, style, variant = "cover" }: ProductImageProps) {
  const source = absolute(uri)
  if (variant === "inset" && isIllustration(uri)) {
    return (
      // collapsible={false} : la transition zoom (Link.AppleZoom) exige un seul enfant natif.
      <View collapsable={false} style={[{ backgroundColor: palette.photoBg, padding: "10%" }, style]}>
        <Image
          source={{ uri: source }}
          style={{ flex: 1, mixBlendMode: "multiply" }}
          contentFit="contain"
          transition={150}
          recyclingKey={source}
          accessibilityIgnoresInvertColors
        />
      </View>
    )
  }
  if (variant === "inset") {
    // Vraie photo : elle remplit le cadre (le conteneur garde un seul enfant natif pour le zoom).
    return (
      <View collapsable={false} style={[{ backgroundColor: palette.photoBg, overflow: "hidden" }, style]}>
        <Image source={{ uri: source }} style={{ flex: 1 }} contentFit="cover" transition={150} recyclingKey={source} accessibilityIgnoresInvertColors />
      </View>
    )
  }
  return (
    <Image
      source={{ uri: source }}
      style={[{ backgroundColor: palette.photoBg }, style]}
      contentFit="cover"
      transition={150}
      recyclingKey={source}
      accessibilityIgnoresInvertColors
    />
  )
}
