import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import { Poppins } from 'next/font/google'
// import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { AuthProvider } from '@/contexts/auth-context'
import { ThemeProvider } from "@/components/theme-provider"
import { MobilePullToRefresh } from "@/components/souki/mobile-pull-to-refresh"
import { PwaInstallPrompt } from "@/components/souki/pwa-install-prompt"
import { PwaServiceWorker } from "@/components/souki/pwa-service-worker"
import { RouteGuard } from "@/components/routing/route-guard"
import { PwaNavShell } from "@/components/souki/pwa-nav-shell"
import { Toaster } from "@/components/ui/sonner"

// Police unique du site : Poppins pour toutes les écritures (corps + titres).
// On charge les graisses 400→900 car l'UI utilise abondamment font-extrabold
// (800) et font-black (900) sur les titres.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-poppins',
  display: 'swap',
})

export const metadata: Metadata = {
  applicationName: 'SOUKI',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'SOUKI',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/pwa-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/pwa-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png' }],
  },
  title: 'SOUKI Fresh Market | Du champ au panier, le matin même',
  description: 'Légumes frais du marché de gros de Fès, livrés chez vous le matin même. Commandé ce soir avant 20h00, livré demain matin entre 8h et 13h.',
  keywords: ['légumes frais', 'marché de gros', 'Fès', 'Maroc', 'livraison', 'fruits', 'herbes'],
  authors: [{ name: 'SOUKI Fresh Market' }],
  openGraph: {
    title: 'SOUKI Fresh Market',
    description: 'Légumes frais du marché de gros, livrés chez vous le matin même.',
    type: 'website',
    locale: 'fr_MA',
  },
}

export const viewport: Viewport = {
  themeColor: '#1E8A3C',
  width: 'device-width',
  initialScale: 1,
  // Indispensable pour que env(safe-area-inset-*) renvoie de vraies valeurs
  // en mode standalone iOS (sinon = 0, et tout le travail safe-area est neutralise).
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="SOUKI" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        {/* Ecrans de demarrage iOS (sinon le lancement standalone affiche un ecran blanc). */}
        <link rel="apple-touch-startup-image" href="/splash/apple-splash-1290-2796.png" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/apple-splash-1179-2556.png" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/apple-splash-1170-2532.png" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/apple-splash-1125-2436.png" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/apple-splash-828-1792.png" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/apple-splash-750-1334.png" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/apple-splash-640-1136.png" media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
      </head>
      <body className={`${poppins.variable} font-sans antialiased overflow-x-hidden`}>
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <MobilePullToRefresh />
            <Suspense fallback={null}>
              <RouteGuard>{children}</RouteGuard>
            </Suspense>
            <PwaNavShell />
            <PwaServiceWorker />
            <PwaInstallPrompt />
            <Toaster position="top-center" richColors closeButton />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
