import "../global.css"
import "react-native-gesture-handler"
import "react-native-reanimated"
import "react-native-url-polyfill/auto"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Stack } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { StatusBar } from "expo-status-bar"
import React, { useEffect } from "react"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { AuthProvider } from "@/contexts/AuthContext"
import { useCartStore } from "@/store/cartStore"

SplashScreen.preventAutoHideAsync().catch(() => undefined)

const queryClient = new QueryClient()

function Bootstrap({ children }: { children: React.ReactNode }) {
  const hydrate = useCartStore((state) => state.hydrate)

  useEffect(() => {
    void hydrate().finally(() => SplashScreen.hideAsync())
  }, [hydrate])

  return children
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <Bootstrap>
              <StatusBar style="dark" />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="login/index" />
                <Stack.Screen name="login/client/index" />
                <Stack.Screen name="login/livreur/index" />
                <Stack.Screen name="login/parent/index" />
                <Stack.Screen name="catalogue/index" />
                <Stack.Screen name="checkout/index" />
                <Stack.Screen name="verify/index" />
                <Stack.Screen name="parametres/index" />
                <Stack.Screen name="livreur/index" />
                <Stack.Screen name="parent/index" />
                <Stack.Screen name="admin/index" />
                <Stack.Screen name="admin/login" />
                <Stack.Screen name="+not-found" />
              </Stack>
            </Bootstrap>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
