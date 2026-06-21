"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronDown,
  History,
  LogOut,
  Menu,
  RefreshCcw,
  Settings,
  Shield,
  Sparkles,
  Store,
  TrendingUp,
  User as UserIcon,
  Wallet,
} from "lucide-react"

import { User } from "@/contexts/auth-context"
import { useAuth } from "@/hooks/useAuth"
import { useProfile } from "@/hooks/useProfile"
import { cn } from "@/lib/utils"

export function ProfileDropdown({ user }: { user: User }) {
  const [isOpen, setIsOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [photoVersion, setPhotoVersion] = useState(
    () => Number(typeof window !== "undefined" ? localStorage.getItem("souki_photo_version") || "0" : "0")
  )
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { logout } = useAuth()
  const { getProfile } = useProfile()
  const router = useRouter()

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
  }, [getProfile, user.id, photoVersion])

  const navigateTo = (href: string) => {
    router.push(href)
    setIsOpen(false)
  }

  const handleLogout = async () => {
    await logout()
    setIsOpen(false)
    window.location.assign("/login?logged_out=1")
  }

  const handleSwitchAccount = async () => {
    await logout()
    setIsOpen(false)
    window.location.assign("/login?switch=1")
  }

  const canAccessAdmin = user.permissions.includes("admin.panel.access")
  const canAccessLivreur = user.permissions.includes("livreur.dashboard.access")
  const canAccessParent = user.permissions.includes("parent.dashboard.access")
  const effectiveRoles = new Set(
    [user.role, user.legacy_role, ...(user.roles ?? [])]
      .filter(Boolean)
      .map((r) => String(r).toUpperCase()),
  )
  const canAccessSupplier = effectiveRoles.has("FOURNISSEUR")
  const canBecomeSupplier =
    !canAccessSupplier &&
    (effectiveRoles.has("CLIENT") || user.permissions.includes("supplier.request.create"))
  const dashboardTarget =
    canAccessAdmin ? "/admin" : canAccessLivreur ? "/livreur" : canAccessParent ? "/parent" : null
  const dashboardLabel =
    canAccessAdmin ? "Back-office" : canAccessLivreur ? "Espace livreur" : canAccessParent ? "Espace parent" : null
  const roleLabel = user.roles.length > 0 ? user.roles.join(" · ") : user.role

  const initials = user.email
    ? user.email.substring(0, 1).toUpperCase()
    : user.phone
      ? user.phone.substring(0, 2)
      : "U"

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={cn(
          "group flex min-h-12 items-center gap-2 rounded-full border border-white/40 bg-white/70 py-1.5 pl-3 pr-1.5 shadow-[0_16px_40px_-28px_rgba(18,32,24,0.45)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/85 hover:shadow-[0_20px_50px_-30px_rgba(18,32,24,0.55)]",
          isOpen && "bg-white/90 shadow-[0_22px_55px_-30px_rgba(18,32,24,0.6)]"
        )}
      >
        <Menu size={18} className="text-[#6F8070] transition-colors group-hover:text-[#1E8A3C]" />
        <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#1E8A3C] to-[#4CB84A] text-sm font-black text-white shadow-inner ring-2 ring-white">
          {avatarUrl ? (
            <img src={avatarUrl} alt={user.email || user.phone || "Profil"} className="h-full w-full object-cover" />
          ) : (
            initials
          )}
          <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#4CB84A]" />
        </div>
        <ChevronDown
          size={16}
          className={cn("mr-1 text-[#8A8A8A] transition-transform duration-300", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-3 w-[min(20rem,calc(100vw-1rem))] origin-top-right overflow-hidden rounded-[28px] border border-white/40 bg-white/88 shadow-[0_28px_90px_-42px_rgba(18,32,24,0.75)] backdrop-blur-2xl animate-fade-in"
        >
          <div className="border-b border-[#E7F0E8] bg-[linear-gradient(145deg,rgba(240,250,241,0.92),rgba(255,255,255,0.7))] p-4">
            <div className="flex items-center gap-3">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E8A3C] to-[#4CB84A] text-lg font-black text-white shadow-inner ring-1 ring-white/80">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={user.email || user.phone || "Profil"} className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/75 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#1E8A3C] ring-1 ring-[#D7EBD9]">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{roleLabel}</span>
                </div>
                <p className="mt-2 truncate text-sm font-bold text-[#264129]">{user.email || user.phone}</p>
                <p className="mt-0.5 text-xs font-medium text-[#6F8070]">Compte Souki actif</p>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 p-2.5">
            {dashboardTarget && dashboardLabel && (
              <button
                onClick={() => navigateTo(dashboardTarget)}
                className="group flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all hover:bg-[#F0FAF1]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF2FF] text-[#1A73E8] transition-transform group-hover:scale-105">
                  <Shield size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black text-[#264129]">{dashboardLabel}</span>
                  <span className="block text-xs font-medium text-[#7B8B7D]">Accéder à votre espace dédié</span>
                </span>
              </button>
            )}

            {canAccessSupplier && (
              <button
                onClick={() => navigateTo("/supplier")}
                className="group flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all hover:bg-[#FFF7EE]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF0DC] text-[#F07C00] transition-transform group-hover:scale-105">
                  <Store size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black text-[#264129]">Espace fournisseur</span>
                  <span className="block text-xs font-medium text-[#7B8B7D]">Gérer vos produits et commandes</span>
                </span>
              </button>
            )}

            {canBecomeSupplier && (
              <button
                onClick={() => navigateTo("/devenir-fournisseur")}
                className="group flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all hover:bg-[#F0FAF1]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF8EC] text-[#1E8A3C] transition-transform group-hover:scale-105">
                  <TrendingUp size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black text-[#264129]">Devenir fournisseur</span>
                  <span className="block text-xs font-medium text-[#7B8B7D]">Vendez vos produits sur Souki</span>
                </span>
              </button>
            )}

            <button
              onClick={() => navigateTo("/parametres/compte")}
              className="group flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all hover:bg-[#F0FAF1]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF8EC] text-[#1E8A3C] transition-transform group-hover:scale-105">
                <UserIcon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black text-[#264129]">Mon profil</span>
                <span className="block text-xs font-medium text-[#7B8B7D]">
                  Photo, adresse et informations personnelles
                </span>
              </span>
            </button>

            <button
              onClick={() => navigateTo("/wallet")}
              className="group flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all hover:bg-[#F0FAF1]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E8A3C] to-[#4CB84A] text-white shadow-inner transition-transform group-hover:scale-105">
                <Wallet size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black text-[#264129]">Mon Wallet</span>
                <span className="block text-xs font-medium text-[#7B8B7D]">
                  Gérer votre solde et transactions
                </span>
              </span>
            </button>

            <button
              onClick={() => navigateTo("/parametres/notifications")}
              className="group flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all hover:bg-[#F0FAF1]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF7EE] text-[#F07C00] transition-transform group-hover:scale-105">
                <Settings size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black text-[#264129]">Paramètres</span>
                <span className="block text-xs font-medium text-[#7B8B7D]">Notifications, sécurité et paiement</span>
              </span>
            </button>

            <button
              onClick={() => navigateTo("/historique")}
              className="group flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all hover:bg-[#F0FAF1]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F7F8F5] text-[#607061] transition-transform group-hover:scale-105">
                <History size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black text-[#264129]">Historique</span>
                <span className="block text-xs font-medium text-[#7B8B7D]">
                  Commandes validées et produits consultés
                </span>
              </span>
            </button>

            <div className="mx-2 my-2 h-px bg-[#E7F0E8]" />

            <button
              onClick={handleSwitchAccount}
              className="group flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all hover:bg-[#F0FAF1]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF2FF] text-[#1A73E8] transition-transform group-hover:scale-105">
                <RefreshCcw size={17} />
              </span>
              <span className="text-sm font-black text-[#264129]">Changer de compte</span>
            </button>

            <button
              onClick={handleLogout}
              className="group flex min-h-12 w-full items-center gap-3 rounded-2xl border border-red-100 bg-red-50/70 px-3 py-2.5 text-left transition-all hover:bg-red-100"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-red-600 transition-transform group-hover:scale-105">
                <LogOut size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black text-red-700">Se déconnecter</span>
                <span className="block text-xs font-semibold text-red-500">Fermer la session sur cet appareil</span>
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
