"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { useAuth } from "@/hooks/useAuth"
import { canAccessRoute, getAccessDeniedMessage, normalizePath } from "@/lib/routes"

function buildRedirectUrl(targetPath: string, currentPath: string, reason: string) {
  const target = new URL(targetPath, window.location.origin)
  const current = new URL(`${currentPath}${window.location.search}`, window.location.origin)

  if (normalizePath(target.pathname) !== normalizePath(current.pathname)) {
    target.searchParams.set("redirect", `${current.pathname}${current.search}`)
  }
  target.searchParams.set("access_error", reason)
  return `${target.pathname}${target.search}${target.hash}`
}

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isLoading, isAuthenticated, user } = useAuth()
  const [accessError, setAccessError] = useState<string | null>(null)

  const decision = useMemo(
    () => canAccessRoute({ pathname, searchParams, user, isAuthenticated, isLoading }),
    [isAuthenticated, isLoading, pathname, searchParams, user]
  )

  useEffect(() => {
    if (decision.allowed || decision.reason === "loading" || !decision.redirectTo) {
      return
    }

    router.replace(buildRedirectUrl(decision.redirectTo, pathname, decision.reason || "access_denied"))
  }, [decision.allowed, decision.reason, decision.redirectTo, pathname, router])

  useEffect(() => {
    const reason = searchParams.get("access_error")
    setAccessError(reason ? getAccessDeniedMessage(reason as Parameters<typeof getAccessDeniedMessage>[0]) : null)
  }, [pathname, searchParams])

  if (decision.allowed) {
    return (
      <>
        {accessError ? (
          <div className="fixed left-1/2 top-4 z-[100] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 shadow-lg">
            {accessError}
          </div>
        ) : null}
        {children}
      </>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center px-6">
      <div className="max-w-md rounded-3xl border border-[#DDE7DE] bg-white px-8 py-10 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#6E8B73]">SOUKI</p>
        <h1 className="mt-3 text-2xl font-bold text-[#1E8A3C]">Verification des acces</h1>
        <p className="mt-3 text-sm leading-6 text-[#677669]">{getAccessDeniedMessage(decision.reason)}</p>
      </div>
    </div>
  )
}
