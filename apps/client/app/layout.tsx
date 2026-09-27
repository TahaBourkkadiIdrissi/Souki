import { BRAND_GREEN, BRAND_PATH, brandIcons } from "@/lib/branding"
import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import localFont from 'next/font/local'
import Script from 'next/script'
import { SITE_URL } from '@/lib/seo'
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
const poppins = localFont({
  src: [
    {path: '../public/fonts/poppins-400.woff2', weight: '400'},
    {path: '../public/fonts/poppins-600.woff2', weight: '600'},
    {path: '../public/fonts/poppins-700.woff2', weight: '700'},
    {path: '../public/fonts/poppins-800.woff2', weight: '800'},
    {path: '../public/fonts/poppins-900.woff2', weight: '900'},
  ], variable: '--font-poppins', display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
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
  icons: brandIcons,
  title: 'SOUKI Fresh Market | Du champ au panier, le matin même',
  description: 'Légumes frais du marché de gros de Fès, livrés chez vous le lendemain. Commandé avant 20h00, livré demain entre 8h et 15h.',
  keywords: ['légumes frais', 'marché de gros', 'Fès', 'Maroc', 'livraison', 'fruits', 'herbes'],
  authors: [{ name: 'SOUKI Fresh Market' }],
  openGraph: {
    title: 'SOUKI Fresh Market',
    description: 'Légumes frais du marché de gros, livrés chez vous le lendemain entre 8h et 15h.',
    type: 'website',
    locale: 'fr_MA',
    images: ['/opengraph-image'],
  },
  twitter: { card: 'summary_large_image' },
}

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'SOUKI',
  url: SITE_URL,
  logo: `${SITE_URL}${BRAND_PATH}/horizontal.png`,
}

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'SOUKI',
  url: SITE_URL,
  inLanguage: 'fr-MA',
}

const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Livraison de légumes frais à Fès',
  provider: { '@type': 'Organization', name: 'SOUKI', url: SITE_URL },
  areaServed: { '@type': 'City', name: 'Fès' },
  serviceType: 'Livraison de produits frais',
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
      href: `${BRAND_PATH}/splash/apple-splash-${width}-${height}.png`,
      media: `(device-width: ${cssWidth}px) and (device-height: ${cssHeight}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: ${orientation})`,
    }
  })
)

export const viewport: Viewport = {
  themeColor: BRAND_GREEN,
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
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <Script id="souki-ga4" strategy="beforeInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config',${JSON.stringify(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID)});`}
          </Script>
        )}
        {[organizationSchema, websiteSchema, serviceSchema].map((schema) => (
          <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
        ))}
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
            __html: `(function(){try{var q=location.search.indexOf("souki-launch-preview")>-1;var m=window.matchMedia;var s=(m&&(m("(display-mode: standalone)").matches||m("(display-mode: fullscreen)").matches))||navigator.standalone===true;if(!s&&!q)return;if(location.pathname==="/"){location.replace("/pwa-welcome"+location.search+location.hash);return}if(q||!sessionStorage.getItem("souki-launched")){if(!q)sessionStorage.setItem("souki-launched","1");document.documentElement.setAttribute("data-souki-launch","");var l=document.createElement("link");l.rel="preload";l.as="image";l.href="/images/launch/wreath.webp";document.head.appendChild(l);var b=document.createElement("link");b.rel="preload";b.as="image";b.href="/brand/souki-2026/secondary.png";document.head.appendChild(b)}}catch(e){}})()`,
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
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
        )}
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
