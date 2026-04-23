"use client"

import { useCallback } from "react"
import { useApi } from "@/hooks/useApi"

export interface ProfileData {
  prenom: string
  nom: string
  email: string
  telephone: string
  photo_url?: string | null
  email_verified: boolean
  address: {
    adresse: string
    ville: string
    code_postal: string
  }
}

export function useProfile() {
  const { callApi, loading, error, setError } = useApi()

  const getProfile = useCallback(() => callApi<ProfileData>("/api/user/profile"), [callApi])
  const updateProfile = useCallback(
    (payload: Pick<ProfileData, "prenom" | "nom" | "email" | "telephone">) =>
      callApi<{ success: boolean; email_changed: boolean }>("/api/user/profile", "PUT", payload),
    [callApi]
  )
  const updateAddress = useCallback(
    (payload: ProfileData["address"]) => callApi<{ success: boolean }>("/api/user/address", "PUT", payload),
    [callApi]
  )
  const uploadPhoto = useCallback(async (file: File) => {
    const fd = new FormData()
    fd.append("file", file)
    return callApi<{ photo_url: string }>("/api/user/profile/photo", "POST", fd, true)
  }, [callApi])

  return { callApi, loading, error, setError, getProfile, updateProfile, updateAddress, uploadPhoto }
}
