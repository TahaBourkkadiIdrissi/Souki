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
  const api = useApi()

  const getProfile = useCallback(() => api.callApi<ProfileData>("/api/user/profile"), [api])
  const updateProfile = useCallback(
    (payload: Pick<ProfileData, "prenom" | "nom" | "email" | "telephone">) =>
      api.callApi<{ success: boolean; email_changed: boolean }>("/api/user/profile", "PUT", payload),
    [api]
  )
  const updateAddress = useCallback(
    (payload: ProfileData["address"]) => api.callApi<{ success: boolean }>("/api/user/address", "PUT", payload),
    [api]
  )
  const uploadPhoto = useCallback(async (file: File) => {
    const fd = new FormData()
    fd.append("file", file)
    return api.callApi<{ photo_url: string }>("/api/user/profile/photo", "POST", fd, true)
  }, [api])

  return { ...api, getProfile, updateProfile, updateAddress, uploadPhoto }
}
