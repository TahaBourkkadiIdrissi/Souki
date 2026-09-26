import type { MetadataRoute } from "next"
import { BRAND_GREEN, brandPwaIcons } from "@/lib/branding"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Souki Livreur",
    short_name: "Souki Livreur",
    start_url: "/livreur",
    scope: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: BRAND_GREEN,
    icons: brandPwaIcons,
  }
}
