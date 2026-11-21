import { BRAND_GREEN, BRAND_PATH, brandIcons } from "@/lib/branding"
import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import localFont from 'next/font/local'
import { Tajawal } from 'next/font/google'
import Script from 'next/script'
import { cookies } from 'next/headers'
import { SITE_URL } from '@/lib/seo'
import './globals.css'
import { AuthProvider } from '@/contexts/auth-context'
import { LocaleProvider } from '@/contexts/locale-context'
import { LOCALE_COOKIE, parseLocale } from '@/lib/i18n'
import { ThemeProvider } from "@/components/theme-provider"
import { MobilePullToRefresh } from "@/components/souki/mobile-pull-to-refresh"
import { PwaInstallPrompt } from "@/components/souki/pwa-install-prompt"
import { PwaLaunchOverlay } from "@/components/souki/pwa-launch-overlay"
import { PwaServiceWorker } from "@/components/souki/pwa-service-worker"
import { RouteGuard } from "@/components/routing/route-guard"
import { PwaNavShell } from "@/components/souki/pwa-nav-shell"
import { Toaster } from "@/components/ui/sonner"
import { WebVitals } from "@/components/souki/web-vitals"
import { localizedMetadata } from "@/lib/i18n-metadata"

const analyticsEnabled = Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) &&
  (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_GA_DEBUG === "true")

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

// Police arabe des zones traduites (Poppins n'a pas de glyphes arabes). Telechargee au build et
// servie par le site, comme Poppins ; preload desactive car le francais reste la langue par defaut.
const tajawal = Tajawal({
  subsets: ['arabic'],
  weight: ['400', '500', '700', '800'],
  variable: '--font-arabic',
  display: 'swap',
  preload: false,
})

const metadata: Metadata = {
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
  description: 'Légumes frais du marché de gros de Fès. Commandez de 8h à 1h du matin, livraison entre 8h et 15h à la date confirmée.',
  keywords: ['légumes frais', 'marché de gros', 'Fès', 'Maroc', 'livraison', 'fruits', 'herbes'],
  authors: [{ name: 'SOUKI Fresh Market' }],
  openGraph: {
    title: 'SOUKI Fresh Market',
    description: 'Légumes frais du marché de gros, livrés chez vous entre 8h et 15h à la date confirmée.',
    type: 'website',
    locale: 'fr_MA',
    images: ['/opengraph-image'],
  },
  twitter: { card: 'summary_large_image' },
}

export function generateMetadata() {
  return localizedMetadata(metadata)
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
 * Les fichiers vivent dans public/brand/souki-2026/splash/ : fond vert SOUKI et sac blanc de 160 px,
 * soit le premier frame de l'animation d'entree (PwaLaunchOverlay). Generes par
 * tools/generate-pwa-splash.mjs.
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Francais par defaut ; l'arabe (droite a gauche) est un choix du visiteur, garde en cookie.
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value)
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.soukiInstallPrompt=e});window.addEventListener('appinstalled',function(){window.soukiInstallPrompt=null});` }} />
        {analyticsEnabled && (
          <Script id="souki-ga4" strategy="beforeInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config',${JSON.stringify(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID)},{debug_mode:${process.env.NEXT_PUBLIC_GA_DEBUG === "true"}||new URLSearchParams(location.search).get('ga_debug')==='1'});`}
          </Script>
        )}
        {[organizationSchema, websiteSchema, serviceSchema].map((schema) => (
          <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
        ))}
        {/*
          Amorcage de l'app installee, AVANT la premiere peinture — doit rester inline
          et synchrone. L'app Google Play (apps/play-store-pwa) est reconnue a son referent
          android-app://io.souki.app, retenu pour la session (souki-play-app, lib/pwa.ts).
          Aucune redirection vers /pwa-welcome : l'app demarre sur l'accueil "/".
          Role : poser data-souki-launch="day" ou "night" au premier ecran de la session, ce qui
             declenche l'animation d'entree (PwaLaunchOverlay) des le premier frame, et
             precharger ses images (sac, logo) sans attendre l'hydratation. « night » de 01h
             a 08h, heure du Maroc (commandes fermees, meme regle que lib/order-hours.ts).
          QA : le parametre ?souki-launch-preview rejoue l'animation dans un navigateur
          classique (sans standalone, sans consommer le drapeau de session) ;
          ?souki-launch-preview=night ou =day force la variante. Le comportement
          standalone reste identique (PWA installee et app Play Store).
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var q=location.search.indexOf("souki-launch-preview")>-1;var a=document.referrer.indexOf("android-app://io.souki.app")===0;if(a)sessionStorage.setItem("souki-play-app","1");var m=window.matchMedia;var s=a||(m&&(m("(display-mode: standalone)").matches||m("(display-mode: fullscreen)").matches))||navigator.standalone===true;if(!s&&!q)return;if(q||!sessionStorage.getItem("souki-launched")){if(!q)sessionStorage.setItem("souki-launched","1");var d=new Date(),h=-1;try{h=d.getTime()>=Date.parse("2026-09-20T01:00:00Z")?d.getUTCHours():Number(new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Casablanca",hour:"2-digit",hourCycle:"h23"}).format(d))}catch(e){}var x=location.search;var n=x.indexOf("souki-launch-preview=night")>-1||(x.indexOf("souki-launch-preview=day")<0&&h>=1&&h<8);document.documentElement.setAttribute("data-souki-launch",n?"night":"day");["/brand/souki-2026/splash-symbol.png","/brand/souki-2026/horizontal.png"].forEach(function(u){var l=document.createElement("link");l.rel="preload";l.as="image";l.href=u;document.head.appendChild(l)})}}catch(e){}})()`,
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
      <body className={`${poppins.variable} ${tajawal.variable} font-sans antialiased overflow-x-hidden`}>
        {analyticsEnabled && (
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
        )}
        <LocaleProvider initialLocale={locale}>
        <AuthProvider>
          <WebVitals />
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
        </LocaleProvider>
      </body>
    </html>
  )
}
