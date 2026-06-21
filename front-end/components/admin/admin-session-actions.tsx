"use client"

import { LogOut, RefreshCcw } from "lucide-react"

import { useAuth } from "@/hooks/useAuth"

export function AdminSessionActions() {
  const { logout } = useAuth()

  const leaveAdmin = async (target: string) => {
    await logout()
    window.location.assign(target)
  }

  return (
    <div className="fixed bottom-5 right-5 z-[80] flex items-center gap-2">
      <button
        type="button"
        onClick={() => void leaveAdmin("/login?switch=1")}
        title="Changer de compte"
        aria-label="Changer de compte"
        className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DDE7DE] bg-white text-[#1E8A3C] shadow-[0_18px_45px_-24px_rgba(0,0,0,0.45)] transition-all hover:-translate-y-0.5 hover:bg-[#F0FAF1]"
      >
        <RefreshCcw className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => void leaveAdmin("/login?logged_out=1")}
        title="Deconnexion"
        aria-label="Deconnexion"
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 shadow-[0_18px_45px_-24px_rgba(0,0,0,0.45)] transition-all hover:-translate-y-0.5 hover:bg-red-100"
      >
        <LogOut className="h-5 w-5" />
      </button>
    </div>
  )
}
