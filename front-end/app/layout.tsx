import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import { Poppins } from 'next/font/google'
// import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { AuthProvider } from '@/contexts/auth-context'
import { ThemeProvider } from "@/components/theme-provider"
import { MobilePullToRefresh } from "@/components/souki/mobile-pull-to-refresh"
import { PwaInstallPrompt } from "@/components/souki/pwa-install-prompt"
import { PwaLaunchOverlay } from "@/components/souki/pwa-launch-overlay"
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
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/pwa-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/pwa-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon-120.png', sizes: '120x120', type: 'image/png' },
      { url: '/apple-icon-152.png', sizes: '152x152', type: 'image/png' },
      { url: '/apple-icon-167.png', sizes: '167x167', type: 'image/png' },
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
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

/**
 * Appareils iOS couverts par un ecran de demarrage : [largeur CSS, hauteur CSS, DPR].
 * Les fichiers correspondants vivent dans public/splash/ (fond blanc opaque + logo).
 */
const APPLE_SPLASH_DEVICES: ReadonlyArray<readonly [number, number, number]> = [
  [320, 568, 2], [375, 667, 2], [414, 736, 3], [375, 812, 3],
  [414, 896, 2], [414, 896, 3], [390, 844, 3], [428, 926, 3],
  [393, 852, 3], [430, 932, 3], [402, 874, 3], [440, 956, 3],
  [768, 1024, 2], [810, 1080, 2], [820, 1180, 2], [834, 1112, 2],
  [834, 1194, 2], [1024, 1366, 2],
]

const APPLE_SPLASH_LINKS = APPLE_SPLASH_DEVICES.flatMap(([cssWidth, cssHeight, dpr]) =>
  (["portrait", "landscape"] as const).map((orientation) => {
    const [width, height] =
      orientation === "portrait"
        ? [cssWidth * dpr, cssHeight * dpr]
        : [cssHeight * dpr, cssWidth * dpr]
    return {
      href: `/splash/apple-splash-${width}-${height}.png`,
      media: `(device-width: ${cssWidth}px) and (device-height: ${cssHeight}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: ${orientation})`,
    }
  })
)

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
        {/*
          Amorcage de l'app installee, AVANT la premiere peinture — doit rester inline
          et synchrone. Deux roles :
          1. Basculer sur /pwa-welcome. Le manifest y demarre deja, mais une installation
             existante peut avoir l'ancien manifest en cache ; sans ce script, l'accueil
             web s'affiche un instant avant la redirection cote React (app/page.tsx).
          2. Poser data-souki-launch au premier ecran de la session, ce qui declenche
             l'animation d'entree (PwaLaunchOverlay) des le premier frame — et
             precharger son asset hero (la couronne) sans attendre l'hydratation.
          QA : le parametre ?souki-launch-preview rejoue l'animation dans un
          navigateur classique (sans standalone, sans consommer le drapeau de
          session) — le comportement standalone reste strictement identique.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var q=location.search.indexOf("souki-launch-preview")>-1;var m=window.matchMedia;var s=(m&&(m("(display-mode: standalone)").matches||m("(display-mode: fullscreen)").matches))||navigator.standalone===true;if(!s&&!q)return;if(location.pathname==="/"){location.replace("/pwa-welcome"+location.search+location.hash);return}if(q||!sessionStorage.getItem("souki-launched")){if(!q)sessionStorage.setItem("souki-launched","1");document.documentElement.setAttribute("data-souki-launch","");var l=document.createElement("link");l.rel="preload";l.as="image";l.href="/images/launch/wreath.webp";document.head.appendChild(l)}}catch(e){}})()`,
          }}
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="SOUKI" />
        {/* Les <link rel="apple-touch-icon"> sont emis par metadata.icons.apple ci-dessus. */}
        {/*
          Ecrans de demarrage iOS. Sans correspondance exacte, iOS n'affiche aucun
          splash et le lancement standalone montre un ecran noir : la couverture doit
          donc etre exhaustive (iPhone SE 1re gen -> 16 Pro Max, iPads, 2 orientations).
        */}
        {APPLE_SPLASH_LINKS.map(({ href, media }) => (
          <link key={href} rel="apple-touch-startup-image" href={href} media={media} />
        ))}
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
            {/* En dernier : doit recouvrir toute l'UI au lancement de l'app installee. */}
            <PwaLaunchOverlay />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
