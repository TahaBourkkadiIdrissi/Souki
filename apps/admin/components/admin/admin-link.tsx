"use client"

import {
  createContext, useCallback, useContext, useMemo, useTransition,
  type KeyboardEvent, type MouseEvent, type ReactNode,
} from "react"
import { usePathname, useRouter } from "next/navigation"

import { ADMIN_NAV_ITEMS, findAdminNavItem } from "@/lib/admin-nav"

type AdminNavigation = { navigate: (href: string) => void; prefetch: (href: string) => void; pending: boolean }

const AdminNavigationContext = createContext<AdminNavigation | null>(null)

function navIndex(href: string) {
  const item = findAdminNavItem(href.split(/[?#]/)[0])
  return item ? ADMIN_NAV_ITEMS.indexOf(item) : -1
}

/**
 * Navigation interne de l'admin. Elle passe par le routeur plutot que par un vrai lien, pour que le
 * navigateur n'affiche pas l'adresse en bas de l'ecran au survol. Le sens de la transition suit l'ordre du menu.
 */
export function AdminNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  const navigate = useCallback((href: string) => {
    const from = navIndex(pathname)
    const to = navIndex(href)
    const types = from < 0 || to < 0 || from === to ? [] : [to > from ? "adm-down" : "adm-up"]
    startTransition(() => router.push(href, { transitionTypes: types }))
  }, [pathname, router])

  const prefetch = useCallback((href: string) => router.prefetch(href), [router])

  const value = useMemo(() => ({ navigate, prefetch, pending }), [navigate, prefetch, pending])
  return <AdminNavigationContext.Provider value={value}>{children}</AdminNavigationContext.Provider>
}

export function useAdminNavigation() {
  const value = useContext(AdminNavigationContext)
  if (!value) throw new Error("useAdminNavigation doit etre utilise dans AdminNavigationProvider")
  return value
}

type AdminLinkProps = {
  href: string
  className?: string
  children: ReactNode
  onNavigate?: () => void
  "aria-current"?: "page"
  "aria-label"?: string
  title?: string
}

/** Remplace `next/link` dans l'admin. Ctrl, Cmd, Maj ou clic molette ouvrent toujours un nouvel onglet. */
export function AdminLink({ href, className, children, onNavigate, ...aria }: AdminLinkProps) {
  const { navigate, prefetch } = useAdminNavigation()
  const pathname = usePathname()

  const openInNewTab = () => window.open(href, "_blank", "noopener")

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      openInNewTab()
      return
    }
    onNavigate?.()
    if (href !== pathname) navigate(href)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    // Un lien s'active avec Entree, pas avec Espace.
    if (event.key === " ") event.preventDefault()
  }

  return (
    <button
      type="button"
      role="link"
      className={className}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseDown={(event) => { if (event.button === 1) event.preventDefault() }}
      onAuxClick={(event) => { if (event.button === 1) openInNewTab() }}
      onMouseEnter={() => prefetch(href)}
      onFocus={() => prefetch(href)}
      onTouchStart={() => prefetch(href)}
      {...aria}
    >
      {children}
    </button>
  )
}
