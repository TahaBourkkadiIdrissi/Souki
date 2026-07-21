import type { MetadataRoute } from "next"

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
    theme_color: "#1E8A3C",
    icons: [
      {
        src: "/pwa-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Catalogue", short_name: "Catalogue", url: "/catalogue" },
      { name: "Mes commandes", short_name: "Commandes", url: "/historique" },
      { name: "Mon Wallet", short_name: "Wallet", url: "/wallet" },
    ],
  }
}
