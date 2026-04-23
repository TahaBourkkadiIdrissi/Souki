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
  const api = useApi()
  const getWallet = useCallback(() => api.callApi<WalletState>("/api/user/wallet"), [api])
  const activateWallet = useCallback(
    (payload: { password: string; confirm_password: string }) =>
      api.callApi<{ wallet_identifier: string }>("/api/user/wallet/activate", "POST", payload),
    [api]
  )
  return { ...api, getWallet, activateWallet }
}
