import { Suspense } from "react"
import type { Metadata } from "next"
import "./globals.css"
import { AuthProvider } from "@/contexts/auth-context"
import { ThemeProvider } from "@/components/theme-provider"
import { RouteGuard } from "@/components/routing/route-guard"
import { Toaster } from "@/components/ui/sonner"
import { PwaServiceWorker } from "@/components/souki/pwa-service-worker"
export const metadata: Metadata = { title: "Souki Livreur", manifest: "/manifest.webmanifest" }
export default function Layout({children}: {children: React.ReactNode}) {
 return <html lang="fr" suppressHydrationWarning><body className="font-sans antialiased"><AuthProvider><ThemeProvider attribute="class" defaultTheme="light"><Suspense fallback={null}><RouteGuard>{children}</RouteGuard></Suspense><Toaster /><PwaServiceWorker /></ThemeProvider></AuthProvider></body></html>
}
