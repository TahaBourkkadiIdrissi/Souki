"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

import { useAuth } from "@/hooks/useAuth"

const ADMIN_PATH_PERMISSIONS: Record<string, string> = {
  "/admin/orders": "orders.read",
  "/admin/livreur": "admin.panel.access",
  "/admin/produits": "products.manage",
}

function getRequiredPermission(pathname: string) {
  const matchingPath = Object.keys(ADMIN_PATH_PERMISSIONS).find((prefix) => pathname.startsWith(prefix))
  return matchingPath ? ADMIN_PATH_PERMISSIONS[matchingPath] : null
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isLoading, isAuthenticated, user, can } = useAuth()

  const isLoginPage = pathname === "/admin/login"
  const canAccessAdmin = can("admin.panel.access")
  const routePermission = getRequiredPermission(pathname)
  const hasRoutePermission = routePermission ? can(routePermission) : true

  useEffect(() => {
    if (isLoading) {
      return
    }

    if (isLoginPage) {
      if (isAuthenticated && canAccessAdmin) {
        router.replace(user?.default_dashboard || "/admin")
      }
      return
    }

    if (!isAuthenticated || !canAccessAdmin) {
      router.replace(`/admin/login?redirect=${encodeURIComponent(pathname)}`)
      return
    }

    if (!hasRoutePermission) {
      router.replace(user?.default_dashboard || "/admin")
    }
  }, [isAuthenticated, isLoading, isLoginPage, canAccessAdmin, hasRoutePermission, pathname, router, user?.default_dashboard])

  if (isLoginPage) {
    return <>{children}</>
  }

  if (isLoading || !isAuthenticated || !canAccessAdmin || !hasRoutePermission) {
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

  return <>{children}</>
}
