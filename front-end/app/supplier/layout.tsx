"use client"

import { usePathname } from "next/navigation"

import { useAuth } from "@/hooks/useAuth"
import { canAccessRoute } from "@/lib/routes"

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { isLoading, isAuthenticated, user } = useAuth()

  const decision = canAccessRoute({ pathname, user, isAuthenticated, isLoading })

  if (!decision.allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F5F0] px-6">
        <div className="max-w-md rounded-3xl border border-gray-100 bg-white px-8 py-10 text-center shadow-sm">
          <p className="text-sm uppercase tracking-[0.25em] text-[#8A8A8A]">Espace fournisseur</p>
          <h1 className="mt-3 text-2xl font-bold text-[#1E8A3C]">Vérification des accès</h1>
          <p className="mt-3 text-[#6F6F6F]">Nous validons votre session et vos permissions.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
