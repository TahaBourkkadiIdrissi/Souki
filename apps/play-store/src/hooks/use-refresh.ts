import { useCallback, useState } from "react"

/** Etat du « tirer pour rafraichir » : seul un geste de l'utilisateur affiche l'indicateur. */
export function useRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refetch()
    } finally {
      setRefreshing(false)
    }
  }, [refetch])
  return { refreshing, onRefresh }
}
