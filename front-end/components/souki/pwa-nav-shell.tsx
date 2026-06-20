"use client"

import { usePathname } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { MobileBottomNav } from "@/components/souki/mobile-bottom-nav"
import { ProfileAvatar } from "@/components/souki/profile-avatar"

const HIDDEN_ROUTES = ["/login", "/verify", "/admin", "/livreur", "/parent", "/onboarding"]

function isNavHidden(pathname: string): boolean {
  return HIDDEN_ROUTES.some((route) => pathname.startsWith(route))
}

export function PwaNavShell() {
  const pathname = usePathname()
  const { isAuthenticated } = useAuth()

  if (isNavHidden(pathname)) return null

  return (
    <>
      {isAuthenticated && <ProfileAvatar />}
      <MobileBottomNav />
    </>
  )
}
