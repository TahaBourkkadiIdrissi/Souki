"use client"

import { usePathname } from "next/navigation"

import { useAuth } from "@/hooks/useAuth"
import { AdminShell } from "@/components/admin/admin-shell"
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
      <div className="flex min-h-screen items-center justify-center bg-[var(--adm-paper)] px-6">
        <div className="max-w-md text-center animate-in fade-in-0 duration-300">
          <span className="mx-auto block h-1 w-24 overflow-hidden rounded-full bg-[var(--adm-line)]">
            <span className="block h-full w-1/2 animate-[adm-progress-run_1.1s_var(--adm-ease)_infinite] rounded-full bg-[var(--adm-green)]" style={{ transform: "translateX(-100%)" }} />
          </span>
          <h1 className="mt-5 text-lg font-semibold text-[var(--adm-text)]">Vérification des accès</h1>
          <p className="mt-1 text-sm text-[var(--adm-muted)]">Validation de votre session et de vos permissions.</p>
        </div>
      </div>
    )
  }

  return <AdminShell>{children}</AdminShell>
}
