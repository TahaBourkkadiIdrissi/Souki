import { useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { RecurrenceDTO } from "@souki/shared"

import { useAuth } from "@/contexts/auth-context"
import { fetchParrainage, fetchRecurrences, fetchSoukiBaskets, fetchWallet } from "@/lib/api"

export const WALLET_KEY = ["wallet"] as const
export const PARRAINAGE_KEY = ["parrainage"] as const
export const RECURRENCES_KEY = ["recurrences"] as const
export const BASKETS_KEY = ["souki-baskets"] as const

/** Wallet du compte, recharge a chaque ouverture (credit recu, remboursement). */
export function useWallet() {
  const { status } = useAuth()
  return useQuery({ queryKey: WALLET_KEY, queryFn: ({ signal }) => fetchWallet(signal), enabled: status === "signedIn", staleTime: 0 })
}

export function useParrainage() {
  const { status } = useAuth()
  return useQuery({ queryKey: PARRAINAGE_KEY, queryFn: ({ signal }) => fetchParrainage(signal), enabled: status === "signedIn", staleTime: 0 })
}

/** Abonnements du compte (sans ceux qui sont arretes). */
export function useRecurrences() {
  const { status } = useAuth()
  const query = useQuery({ queryKey: RECURRENCES_KEY, queryFn: ({ signal }) => fetchRecurrences(signal), enabled: status === "signedIn", staleTime: 0 })
  return { ...query, recurrences: (query.data ?? []).filter((item) => item.statut !== "ARRETEE") }
}

/** Paniers proposes par SOUKI (publics). */
export function useSoukiBaskets() {
  return useQuery({ queryKey: BASKETS_KEY, queryFn: ({ signal }) => fetchSoukiBaskets(signal) })
}

/** Remplace un abonnement dans le cache apres une action (sauter, pause, rythme…). */
export function useUpdateRecurrenceCache() {
  const client = useQueryClient()
  return useCallback(
    (next: RecurrenceDTO) => {
      client.setQueryData<RecurrenceDTO[]>(RECURRENCES_KEY, (current) => {
        const list = current ?? []
        return list.some((item) => item.id === next.id) ? list.map((item) => (item.id === next.id ? next : item)) : [next, ...list]
      })
    },
    [client],
  )
}
