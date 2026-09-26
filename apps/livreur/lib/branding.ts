import type { Metadata } from "next"

export const BRAND_PATH = "/brand/souki-2026"
export const BRAND_GREEN = "#005B43"

export const brandIcons: Metadata["icons"] = {
  icon: [
    { url: `${BRAND_PATH}/favicon.ico`, sizes: "16x16 32x32 48x48", type: "image/x-icon" },
    { url: `${BRAND_PATH}/favicon-16.png`, sizes: "16x16", type: "image/png" },
    { url: `${BRAND_PATH}/favicon-32.png`, sizes: "32x32", type: "image/png" },
    { url: `${BRAND_PATH}/favicon-48.png`, sizes: "48x48", type: "image/png" },
  ],
  shortcut: [{ url: `${BRAND_PATH}/favicon.ico`, type: "image/x-icon" }],
  apple: [{ url: `${BRAND_PATH}/apple-touch-icon.png`, sizes: "180x180", type: "image/png" }],
}

export const brandPwaIcons = [
  { src: `${BRAND_PATH}/pwa-192.png`, sizes: "192x192", type: "image/png", purpose: "any" as const },
  { src: `${BRAND_PATH}/pwa-512.png`, sizes: "512x512", type: "image/png", purpose: "any" as const },
  { src: `${BRAND_PATH}/pwa-maskable-192.png`, sizes: "192x192", type: "image/png", purpose: "maskable" as const },
  { src: `${BRAND_PATH}/pwa-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" as const },
]
