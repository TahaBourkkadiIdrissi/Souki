import { BRAND_GREEN, brandIcons } from "@/lib/branding"
import { Suspense } from "react"
import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import "./globals.css"
import { AuthProvider } from "@/contexts/auth-context"
import { ThemeProvider } from "@/components/theme-provider"
import { RouteGuard } from "@/components/routing/route-guard"
import { Toaster } from "@/components/ui/sonner"

// Meme police que le site client : Poppins auto-hebergee (declaree dans --font-sans).
const poppins = localFont({
  src: [
    { path: "../public/fonts/poppins-400.woff2", weight: "400" },
    { path: "../public/fonts/poppins-600.woff2", weight: "600" },
    { path: "../public/fonts/poppins-700.woff2", weight: "700" },
    { path: "../public/fonts/poppins-800.woff2", weight: "800" },
    { path: "../public/fonts/poppins-900.woff2", weight: "900" },
  ],
  variable: "--font-poppins",
  display: "swap",
})

export const metadata: Metadata = {
 title: "Souki Admin",
 icons: brandIcons,
 robots: { index: false, follow: false },
}
export const viewport: Viewport = { themeColor: BRAND_GREEN, width: "device-width", initialScale: 1 }
export default function Layout({children}: {children: React.ReactNode}) {
 return <html lang="fr" suppressHydrationWarning><body className={`${poppins.variable} font-sans antialiased`}><AuthProvider><ThemeProvider attribute="class" defaultTheme="light"><Suspense fallback={null}><RouteGuard>{children}</RouteGuard></Suspense><Toaster /></ThemeProvider></AuthProvider></body></html>
}
