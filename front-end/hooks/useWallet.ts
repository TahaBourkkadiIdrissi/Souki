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
  has_wallet: boolean
  is_activated: boolean
  balance_centimes: number
  solde_centimes: number
  wallet_code_masked: string | null
  wallet_identifier: string | null
  transactions: WalletTransaction[]
  transaction_placeholder: string
  created_at?: string | null
}

export function useWallet() {
  const { callApi, loading, error, setError } = useApi()
  const getWallet = useCallback(() => callApi<WalletState>("/api/user/wallet"), [callApi])
  const activateWallet = useCallback(
    (payload: { password: string; confirm_password: string }) =>
      callApi<{ wallet_code: string; wallet_identifier: string; balance_centimes: number }>("/api/user/wallet/activate", "POST", payload),
    [callApi]
  )
  return { callApi, loading, error, setError, getWallet, activateWallet }
}
