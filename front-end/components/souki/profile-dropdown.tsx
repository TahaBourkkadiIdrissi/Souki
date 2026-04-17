"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { User } from "@/contexts/auth-context"
import { ChevronDown, LogOut, User as UserIcon } from "lucide-react"

export function ProfileDropdown({ user }: { user: User }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { logout } = useAuth()
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

  const handleLogout = () => {
    logout()
    setIsOpen(false)
    router.push("/")
  }

  const handleProfileClick = () => {
    router.push("/profile")
    setIsOpen(false)
  }

  // Initiales de l'utilisateur pour l'avatar
  const initials = user.email 
    ? user.email.substring(0, 2).toUpperCase() 
    : user.phone 
    ? user.phone.substring(0, 2) 
    : "U"

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-[#1E8A3C] text-white flex items-center justify-center font-semibold text-sm">
          {initials}
        </div>
        <ChevronDown size={18} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden z-50">
          {/* Header avec infos utilisateur */}
          <div className="px-4 py-3 bg-gray-50 border-b">
            <p className="font-semibold text-sm text-[#1E8A3C]">{user.role}</p>
            <p className="text-xs text-gray-600">{user.email || user.phone}</p>
          </div>

          {/* Menu items */}
          <button
            onClick={handleProfileClick}
            className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-700 transition-colors"
          >
            <UserIcon size={18} />
            Mon profil
          </button>

          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-3 hover:bg-red-50 flex items-center gap-2 text-sm text-red-600 transition-colors border-t"
          >
            <LogOut size={18} />
            Déconnexion
          </button>
        </div>
      )}
    </div>
  )
}
