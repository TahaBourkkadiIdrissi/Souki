"use client"

import { useEffect, useState, useCallback } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { useProfile } from "@/hooks/useProfile"

const HIDE_ON_ROUTES = ["/pwa-welcome", "/login", "/verify", "/onboarding"]

export function ProfileAvatar() {
  const pathname = usePathname()
  const { user } = useAuth()
  const { getProfile } = useProfile()
  const router = useRouter()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [photoVersion, setPhotoVersion] = useState(
    () => Number(typeof window !== "undefined" ? localStorage.getItem("souki_photo_version") || "0" : "0")
  )

  // Listen for cross-component photo update events
  const handlePhotoUpdated = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail
    if (detail?.version) setPhotoVersion(detail.version)
  }, [])

  useEffect(() => {
    window.addEventListener("souki:photo-updated", handlePhotoUpdated)
    return () => window.removeEventListener("souki:photo-updated", handlePhotoUpdated)
  }, [handlePhotoUpdated])

  useEffect(() => {
    let isMounted = true
    const loadAvatar = async () => {
      try {
        const profile = await getProfile()
        if (!isMounted) return
        setAvatarUrl(profile.photo_url ?? profile.avatar_url ?? null)
      } catch {
        if (!isMounted) return
        setAvatarUrl(null)
      }
    }
    if (user) void loadAvatar()
    return () => { isMounted = false }
  }, [getProfile, user?.id, photoVersion])

  if (!user) return null
  if (HIDE_ON_ROUTES.some((r) => pathname.startsWith(r))) return null

  const initials = user.email
    ? user.email.substring(0, 1).toUpperCase()
    : user.phone
      ? user.phone.slice(-2)
      : "U"

  return (
    <button
      onClick={() => router.push("/parametres")}
      className="fixed right-3 top-3 z-50 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] text-sm font-black text-white shadow-md ring-2 ring-white transition-transform active:scale-95 md:hidden"
      aria-label="Profil et paramètres"
    >
      {avatarUrl ? (
        <img src={`${avatarUrl}${avatarUrl.includes("?") ? "&" : "?"}v=${photoVersion}`} alt="Profil" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </button>
  )
}
