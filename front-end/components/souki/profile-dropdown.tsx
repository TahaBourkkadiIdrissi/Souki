"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { useProfile } from "@/hooks/useProfile"
import { User } from "@/contexts/auth-context"
import { Menu, LogOut, User as UserIcon, Heart, Shield } from "lucide-react"

export function ProfileDropdown({ user }: { user: User }) {
  const [isOpen, setIsOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { logout } = useAuth()
  const { getProfile } = useProfile()
  const router = useRouter()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

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

    void loadAvatar()

    return () => {
      isMounted = false
    }
  }, [getProfile, user.id])

  const handleLogout = () => {
    logout()
    setIsOpen(false)
    router.push("/")
  }

  const handleProfileClick = () => {
    router.push("/parametres")
    setIsOpen(false)
  }

  const canAccessAdmin = user.permissions.includes("admin.panel.access")
  const canAccessLivreur = user.permissions.includes("livreur.dashboard.access")
  const canAccessParent = user.permissions.includes("parent.dashboard.access")
  const dashboardTarget =
    canAccessAdmin ? "/admin" : canAccessLivreur ? "/livreur" : canAccessParent ? "/parent" : null
  const dashboardLabel =
    canAccessAdmin ? "Back-office" : canAccessLivreur ? "Espace livreur" : canAccessParent ? "Espace parent" : null
  const roleLabel = user.roles.length > 0 ? user.roles.join(" · ") : user.role

  // Initiales de l'utilisateur pour l'avatar
  const initials = user.email 
    ? user.email.substring(0, 1).toUpperCase() 
    : user.phone 
    ? user.phone.substring(0, 2) 
    : "U"

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-2.5 py-2 rounded-full border border-gray-200 bg-white hover:shadow-md transition-all duration-300 shadow-sm"
      >
        <Menu size={18} className="text-[#8A8A8A] ml-2" />
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1E8A3C] to-[#4CB84A] text-white flex items-center justify-center font-bold text-sm shadow-inner overflow-hidden">
          {avatarUrl ? (
            <img src={avatarUrl} alt={user.email || user.phone || "Profil"} className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-64 bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 overflow-hidden z-50 animate-fade-in origin-top-right">
          {/* Header avec infos utilisateur */}
          <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-br from-gray-50/50 to-white">
            <p className="font-bold text-[#3D3D3D] text-sm uppercase tracking-wider">{roleLabel}</p>
            <p className="text-sm text-[#8A8A8A] truncate mt-0.5">{user.email || user.phone}</p>
          </div>

          {/* Menu items */}
          <div className="p-2">
            {dashboardTarget && dashboardLabel && (
              <button
                onClick={() => { router.push(dashboardTarget); setIsOpen(false) }}
                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#F0FAF1] flex items-center gap-3 text-sm font-medium text-[#3D3D3D] transition-colors"
              >
                <Shield size={18} className="text-[#8A8A8A]" />
                {dashboardLabel}
              </button>
            )}
            <button
              onClick={handleProfileClick}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#F0FAF1] flex items-center gap-3 text-sm font-medium text-[#3D3D3D] transition-colors"
            >
              <UserIcon size={18} className="text-[#8A8A8A]" />
              Parametres
            </button>
            <button
              onClick={() => { setIsOpen(false); router.push("/commandes"); }}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#F0FAF1] flex items-center gap-3 text-sm font-medium text-[#3D3D3D] transition-colors"
            >
              <Heart size={18} className="text-[#8A8A8A]" />
              Abonnements & Favoris
            </button>
            
            <div className="h-px bg-gray-100 my-2 mx-2" />
            
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-red-50 flex items-center gap-3 text-sm font-medium text-red-600 transition-colors group"
            >
              <LogOut size={18} className="text-red-500 group-hover:scale-110 transition-transform" />
              Se déconnecter
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
