"use client"

import { usePathname } from "next/navigation"

import { useAuth } from "@/hooks/useAuth"
import { AdminSessionActions } from "@/components/admin/admin-session-actions"
import { canAccessRoute } from "@/lib/routes"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { isLoading, isAuthenticated, user } = useAuth()

  const isLoginPage = pathname === "/admin/login"
  const decision = canAccessRoute({ pathname, user, isAuthenticated, isLoading })

  if (isLoginPage) {
    return <>{children}</>
  }

  if (!decision.allowed) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center px-6">
        <div className="rounded-3xl bg-white shadow-sm border border-gray-100 px-8 py-10 text-center max-w-md">
          <p className="text-sm uppercase tracking-[0.25em] text-[#8A8A8A]">Back-office</p>
          <h1 className="mt-3 text-2xl font-bold text-[#1E8A3C]">Verification des acces</h1>
          <p className="mt-3 text-[#6F6F6F]">Nous validons votre session et vos permissions.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {children}
      <AdminSessionActions />
    </>
  )
}
