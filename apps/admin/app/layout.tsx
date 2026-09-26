import { BRAND_GREEN, brandIcons } from "@/lib/branding"
import { Suspense } from "react"
import type { Metadata, Viewport } from "next"
import "./globals.css"
import { AuthProvider } from "@/contexts/auth-context"
import { ThemeProvider } from "@/components/theme-provider"
import { RouteGuard } from "@/components/routing/route-guard"
import { Toaster } from "@/components/ui/sonner"

export const metadata: Metadata = { title: "Souki Admin", icons: brandIcons, }
export const viewport: Viewport = { themeColor: BRAND_GREEN, width: "device-width", initialScale: 1 }
export default function Layout({children}: {children: React.ReactNode}) {
 return <html lang="fr" suppressHydrationWarning><body className="font-sans antialiased"><AuthProvider><ThemeProvider attribute="class" defaultTheme="light"><Suspense fallback={null}><RouteGuard>{children}</RouteGuard></Suspense><Toaster /></ThemeProvider></AuthProvider></body></html>
}
