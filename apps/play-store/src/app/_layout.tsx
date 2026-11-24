import { useEffect, useState } from "react"
import { Stack, router } from "expo-router"
import * as Notifications from "expo-notifications"
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from "expo-router/react-navigation"
import { StatusBar } from "expo-status-bar"
import * as SplashScreen from "expo-splash-screen"
import { useFonts } from "expo-font"
import { InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold, InstrumentSans_700Bold } from "@expo-google-fonts/instrument-sans"
import { IBMPlexSansArabic_400Regular, IBMPlexSansArabic_500Medium, IBMPlexSansArabic_600SemiBold, IBMPlexSansArabic_700Bold } from "@expo-google-fonts/ibm-plex-sans-arabic"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { QueryClientProvider } from "@tanstack/react-query"

import { ActionSheetHost } from "@/components/action-sheet"
import { LaunchIntro } from "@/components/launch-intro"
import { SnackbarHost } from "@/components/snackbar"
import { AuthProvider } from "@/contexts/auth-context"
import { CartProvider } from "@/contexts/cart-context"
import { FavoritesProvider } from "@/contexts/favorites-context"
import { LocaleProvider, useLocale } from "@/contexts/locale-context"
import { statusBarStyleFor, ThemeProvider, useAppTheme } from "@/contexts/theme-context"
import { configureNotificationHandler, getNotificationState, registerDevice, routeForNotificationUrl, setupNotificationChannels } from "@/lib/notifications"
import { queryClient } from "@/lib/query-client"
import { colors, palette } from "@/theme"

// L'écran de démarrage reste affiché tant que les polices de la marque ne sont pas prêtes.
SplashScreen.preventAutoHideAsync().catch(() => undefined)
configureNotificationHandler()

/** Thème de navigation (fond des écrans, en-têtes natifs) lu dans le thème SOUKI courant. */
function useNavigationTheme() {
  const { scheme } = useAppTheme()
  const base = scheme === "dark" ? DarkTheme : DefaultTheme
  return {
    ...base,
    dark: scheme === "dark",
    colors: {
      ...base.colors,
      primary: palette.souki900,
      background: colors.background,
      card: colors.background,
      text: colors.label,
      border: palette.line,
      notification: palette.orange500,
    },
  }
}

/**
 * Racine de l'app : polices du design Android (Instrument Sans, IBM Plex Sans Arabic), données
 * (React Query), langue, compte, panier et favoris enregistrés sur le téléphone, thème clair ou
 * sombre, gestes. Le thème est sous les contextes : en changer redessine les écrans sans perdre
 * le panier ni la session.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  })
  const ready = fontsLoaded || Boolean(fontError)
  // Intro de lancement : une seule fois, au démarrage à froid (pas au retour au premier plan).
  const [introVisible, setIntroVisible] = useState(true)

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined)
  }, [ready])

  if (!ready) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <LocaleProvider>
            <AuthProvider>
              <CartProvider>
                <FavoritesProvider>
                  <ThemeProvider>
                    <AppNavigator introVisible={introVisible} onIntroDone={() => setIntroVisible(false)} />
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

function AppNavigator({ introVisible, onIntroDone }: { introVisible: boolean; onIntroDone: () => void }) {
  const { scheme } = useAppTheme()
  const { t, locale } = useLocale()
  const navigationTheme = useNavigationTheme()

  // Canaux de notification Android (noms dans la langue de l'app) ; appareil réenregistré si déjà autorisé.
  useEffect(() => {
    void setupNotificationChannels(t)
    void getNotificationState().then((state) => {
      if (state === "granted") void registerDevice()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale])

  // Toucher une notification (suivi de commande…) ouvre l'écran correspondant, y compris app fermée.
  const lastResponse = Notifications.useLastNotificationResponse()
  useEffect(() => {
    if (!lastResponse || introVisible) return
    const route = routeForNotificationUrl(lastResponse.notification.request.content.data?.url)
    if (route) router.push(route as never)
    void Notifications.clearLastNotificationResponseAsync().catch(() => undefined)
  }, [lastResponse, introVisible])

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={statusBarStyleFor(scheme)} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        {/* Entrée, code, onboarding : plein écran, montée depuis le bas (M3). */}
        <Stack.Screen name="(auth)" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="checkout" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="commande-validee" options={{ presentation: "fullScreenModal", animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="panier-intelligent" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="commande-vocale" options={{ presentation: "fullScreenModal", animation: "fade_from_bottom" }} />
        <Stack.Screen name="souki-chat" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        {/* Feuilles du bas (formSheet = BottomSheet natif sur Android). */}
        <Stack.Screen name="levee-restriction" options={{ presentation: "formSheet", sheetAllowedDetents: [0.6, 1], sheetGrabberVisible: true, sheetCornerRadius: 28 }} />
        <Stack.Screen name="bienvenue" options={{ presentation: "fullScreenModal", animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="accord-ia" options={{ presentation: "formSheet", sheetAllowedDetents: "fitToContents", sheetGrabberVisible: true, sheetCornerRadius: 28 }} />
        <Stack.Screen name="abonner" options={{ presentation: "formSheet", sheetAllowedDetents: [0.85, 1], sheetGrabberVisible: true, sheetCornerRadius: 28 }} />
      </Stack>
      <ActionSheetHost />
      <SnackbarHost />
      {introVisible ? <LaunchIntro onDone={onIntroDone} /> : null}
    </NavigationThemeProvider>
  )
}
