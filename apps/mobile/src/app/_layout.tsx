import { useEffect, useState } from "react"
import { Stack } from "expo-router"
import { DefaultTheme, ThemeProvider } from "expo-router/react-navigation"
import { StatusBar } from "expo-status-bar"
import * as SplashScreen from "expo-splash-screen"
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  Poppins_900Black,
} from "@expo-google-fonts/poppins"
import { Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Tajawal_800ExtraBold, Tajawal_900Black } from "@expo-google-fonts/tajawal"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { QueryClientProvider } from "@tanstack/react-query"

import { LaunchIntro } from "@/components/launch-intro"
import { AuthProvider } from "@/contexts/auth-context"
import { CartProvider } from "@/contexts/cart-context"
import { FavoritesProvider } from "@/contexts/favorites-context"
import { LocaleProvider } from "@/contexts/locale-context"
import { queryClient } from "@/lib/query-client"
import { colors, palette } from "@/theme"

// L'ecran de lancement SOUKI reste affiche tant que les polices de la marque ne sont pas pretes.
SplashScreen.preventAutoHideAsync().catch(() => undefined)

const soukiTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: palette.green900,
    background: colors.background,
    card: colors.background,
    text: colors.label,
  },
}

/**
 * Racine de l'app : polices SOUKI (Poppins, Tajawal), donnees (React Query), langue,
 * panier et favoris enregistres sur le telephone, gestes. La pile racine porte les
 * onglets ; les ecrans modaux des phases suivantes (connexion, checkout) s'y ajouteront.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black,
    Tajawal_400Regular,
    Tajawal_500Medium,
    Tajawal_700Bold,
    Tajawal_800ExtraBold,
    Tajawal_900Black,
  })
  const ready = fontsLoaded || Boolean(fontError)
  // « Le marché se réveille » : une seule fois, au demarrage a froid (pas au retour au premier plan).
  const [introVisible, setIntroVisible] = useState(true)

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined)
  }, [ready])

  if (!ready) return null

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <LocaleProvider>
            <AuthProvider>
            <CartProvider>
              <FavoritesProvider>
                <ThemeProvider value={soukiTheme}>
                  <StatusBar style="dark" />
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="(tabs)" />
                    {/* Connexion, inscription, code OTP : plein ecran modal (design system 2027). */}
                    <Stack.Screen name="(auth)" options={{ presentation: "fullScreenModal" }} />
                    {/* Checkout en 4 etapes puis confirmation : plein ecran modal (EcranCheckout). */}
                    <Stack.Screen name="checkout" options={{ presentation: "fullScreenModal" }} />
                    <Stack.Screen name="commande-validee" options={{ presentation: "fullScreenModal", animation: "fade", gestureEnabled: false }} />
                    {/* S'abonner / Repeter une commande : feuille native (iOS 15+), ouverte depuis plusieurs onglets. */}
                    {/* IA-SOUKI : panier intelligent et commande vocale en plein ecran, discussion avec Souki en feuille. */}
                    <Stack.Screen name="panier-intelligent" options={{ presentation: "fullScreenModal" }} />
                    <Stack.Screen name="commande-vocale" options={{ presentation: "fullScreenModal" }} />
                    <Stack.Screen name="souki-chat" options={{ presentation: "modal" }} />
                    <Stack.Screen name="levee-restriction" options={{ presentation: "formSheet", sheetAllowedDetents: [0.6, 1], sheetGrabberVisible: true, sheetCornerRadius: 28 }} />
                    {/* Accord pour les assistants IA (regle Apple 5.1.2(i)) : feuille native. */}
                    <Stack.Screen name="accord-ia" options={{ presentation: "formSheet", sheetAllowedDetents: "fitToContents", sheetGrabberVisible: true, sheetCornerRadius: 28 }} />
                    <Stack.Screen name="abonner" options={{ presentation: "formSheet", sheetAllowedDetents: [0.85, 1], sheetGrabberVisible: true, sheetCornerRadius: 28 }} />
                  </Stack>
                  {introVisible ? <LaunchIntro onDone={() => setIntroVisible(false)} /> : null}
                </ThemeProvider>
              </FavoritesProvider>
            </CartProvider>
            </AuthProvider>
          </LocaleProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
