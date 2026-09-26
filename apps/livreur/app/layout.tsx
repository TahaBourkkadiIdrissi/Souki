import { BRAND_GREEN, brandIcons } from "@/lib/branding"
import { Suspense } from "react"
import type { Metadata, Viewport } from "next"
import "./globals.css"
import { AuthProvider } from "@/contexts/auth-context"
import { ThemeProvider } from "@/components/theme-provider"
import { RouteGuard } from "@/components/routing/route-guard"
import { Toaster } from "@/components/ui/sonner"
import { PwaServiceWorker } from "@/components/souki/pwa-service-worker"
export const metadata: Metadata = {
 title: "Souki Livreur",
 icons: brandIcons,
 appleWebApp: { capable: true, title: "SOUKI Livreur", statusBarStyle: "default" },
 manifest: "/manifest.webmanifest",
 robots: { index: false, follow: false },
}
export const viewport: Viewport = { themeColor: BRAND_GREEN, width: "device-width", initialScale: 1 }
export default function Layout({children}: {children: React.ReactNode}) {
 return <html lang="fr" suppressHydrationWarning><body className="font-sans antialiased"><AuthProvider><ThemeProvider attribute="class" defaultTheme="light"><Suspense fallback={null}><RouteGuard>{children}</RouteGuard></Suspense><Toaster /><PwaServiceWorker /></ThemeProvider></AuthProvider></body></html>
}
