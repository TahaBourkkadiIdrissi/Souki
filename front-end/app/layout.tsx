import type { Metadata, Viewport } from 'next'
import { Inter, Poppins } from 'next/font/google'
// import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { AuthProvider } from '@/contexts/auth-context'
import { ThemeProvider } from "@/components/theme-provider"
import { MobilePullToRefresh } from "@/components/souki/mobile-pull-to-refresh"

const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-inter',
})

const poppins = Poppins({ 
  subsets: ["latin"],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
})

export const metadata: Metadata = {
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
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.variable} ${poppins.variable} font-sans antialiased`}>
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <MobilePullToRefresh />
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
