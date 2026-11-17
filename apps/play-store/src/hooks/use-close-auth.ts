import { useCallback } from "react"
import { useNavigation } from "expo-router"

/**
 * Ferme tout le parcours de compte (le modal plein ecran), depuis n'importe quelle etape :
 * on remonte d'un cran dans la pile racine, qui porte le groupe (auth).
 */
export function useCloseAuth() {
  const navigation = useNavigation()
  return useCallback(() => {
    const root = navigation.getParent() ?? navigation
    if (root.canGoBack()) root.goBack()
  }, [navigation])
}
