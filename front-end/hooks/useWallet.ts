"use client"

import { useCallback } from "react"
import { useApi } from "@/hooks/useApi"

export interface WalletTransaction {
  id: number
  type: string
  libelle: string
  montant_centimes: number
  date: string | null
}

export interface WalletState {
  is_activated: boolean
  solde_centimes: number
  wallet_identifier: string
  transactions: WalletTransaction[]
}

export function useWallet() {
  const { callApi, loading, error, setError } = useApi()
  const getWallet = useCallback(() => callApi<WalletState>("/api/user/wallet"), [callApi])
  const activateWallet = useCallback(
    (payload: { password: string; confirm_password: string }) =>
      callApi<{ wallet_identifier: string }>("/api/user/wallet/activate", "POST", payload),
    [callApi]
  )
  return { callApi, loading, error, setError, getWallet, activateWallet }
}
