"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { loadStoredCart } from "@/lib/catalogue"
import { isPwaStandalone } from "@/lib/pwa"
import { MobileBottomNav } from "@/components/souki/mobile-bottom-nav"
import { ProfileAvatar } from "@/components/souki/profile-avatar"

const HIDDEN_ROUTES = [
  "/login",
  "/verify",
  "/admin",
  "/livreur",
  "/parent",
  "/onboarding",
  "/catalogue",
  "/checkout",
  "/historique",
  "/supplier",
  "/fournisseur",
]

function isNavHidden(pathname: string): boolean {
  return HIDDEN_ROUTES.some((route) => pathname.startsWith(route))
}

export function PwaNavShell() {
  const pathname = usePathname()
  const { isAuthenticated } = useAuth()
  const [isStandalone, setIsStandalone] = useState(false)
  const [cartCount, setCartCount] = useState(0)

  useEffect(() => {
    setIsStandalone(isPwaStandalone())
    setCartCount(loadStoredCart().length)

    const updateCartCount = () => setCartCount(loadStoredCart().length)
    window.addEventListener("souki:cart-updated", updateCartCount)
    window.addEventListener("storage", updateCartCount)

    return () => {
      window.removeEventListener("souki:cart-updated", updateCartCount)
      window.removeEventListener("storage", updateCartCount)
    }
  }, [])

  if (!isStandalone || isNavHidden(pathname)) return null

  return (
    <>
      {isAuthenticated && <ProfileAvatar />}
      <MobileBottomNav cartCount={cartCount} />
    </>
  )
}
