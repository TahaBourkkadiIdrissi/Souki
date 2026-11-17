import { AppState, Platform } from "react-native"
import { focusManager, QueryClient } from "@tanstack/react-query"

/**
 * Cache des donnees de l'app. Les donnees du marche changent chaque matin : on les
 * considere fraiches 2 minutes, puis on les recharge au retour dans l'app.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 2,
    },
  },
})

// React Native n'a pas d'evenement « focus » de fenetre : on suit l'etat de l'app.
if (Platform.OS !== "web") {
  focusManager.setEventListener((setFocused) => {
    const subscription = AppState.addEventListener("change", (state) => setFocused(state === "active"))
    return () => subscription.remove()
  })
}
