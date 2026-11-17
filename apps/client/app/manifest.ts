import { BRAND_GREEN, brandPwaIcons } from "@/lib/branding"
import type { MetadataRoute } from "next"

import { ANDROID_APP_ID, ANDROID_APP_PUBLISHED, PLAY_STORE_URL } from "@/lib/store-apps"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SOUKI Fresh Market",
    short_name: "SOUKI",
    description: "Legumes frais du marche de gros de Fes, livres chez vous le matin meme.",
    lang: "fr",
    dir: "ltr",
    categories: ["shopping", "food"],
    // L'app installee demarre directement sur l'accueil PWA : demarrer sur "/"
    // affichait l'accueil web une fraction de seconde avant la redirection client.
    // Le scope reste "/" pour que tout le site reste dans l'app.
    start_url: "/pwa-welcome",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#FFFFFF",
    theme_color: BRAND_GREEN,
    icons: brandPwaIcons,
    // App Android publiée : Chrome propose l'app Google Play au lieu d'installer la PWA.
    ...(ANDROID_APP_PUBLISHED
      ? { related_applications: [{ platform: "play", url: PLAY_STORE_URL, id: ANDROID_APP_ID }], prefer_related_applications: true }
      : {}),
    screenshots: [
      { src: "/screenshots/home-narrow.png", sizes: "375x812", type: "image/png", form_factor: "narrow", label: "Votre marché frais avec Souki" },
      { src: "/screenshots/home-wide.png", sizes: "1280x800", type: "image/png", form_factor: "wide", label: "Accueil Souki" },
    ],
    shortcuts: [
      { name: "Catalogue", short_name: "Catalogue", url: "/catalogue" },
      { name: "Mes commandes", short_name: "Commandes", url: "/historique" },
      { name: "Mon Wallet", short_name: "Wallet", url: "/wallet" },
    ],
  }
}
