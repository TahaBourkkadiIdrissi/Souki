/// <reference types="react/canary" />
"use client"

import { useEffect, useMemo, useState, ViewTransition, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOut, Menu, RefreshCcw, X } from "lucide-react"

import { SoukiLogo } from "@/components/souki/souki-logo"
import { useAuth } from "@/hooks/useAuth"
import { ADMIN_NAV, ADMIN_NAV_ITEMS, findAdminNavItem } from "@/lib/admin-nav"
import { cn } from "@/lib/utils"

const MOROCCO_TZ = "Africa/Casablanca"

function moroccoMinutes(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: MOROCCO_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now)
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0)
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0)
  return hour * 60 + minute
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours ? `${hours} h ${String(rest).padStart(2, "0")}` : `${rest} min`
}

/**
 * Frise de la journee du souk : commandes ouvertes de 08h00 a 01h00, cloture et JIT de 01h00 a 08h00,
 * livraisons de 08h00 a 15h00. Affichage seul, calcule sur l'heure du Maroc.
 */
function DayTimeline() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    const tick = () => setNow(new Date())
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [])

  if (!now) return <div className="hidden h-11 w-[340px] lg:block" aria-hidden="true" />

  const minutes = moroccoMinutes(now)
  // Axe de 24 h qui commence a 08h00.
  const sinceEight = (minutes - 8 * 60 + 24 * 60) % (24 * 60)
  const position = (sinceEight / (24 * 60)) * 100
  const open = sinceEight < 17 * 60
  const delivering = sinceEight < 7 * 60
  const label = open
    ? `Commandes ouvertes, clôture dans ${formatDuration(17 * 60 - sinceEight)}`
    : `Lot clôturé, réouverture dans ${formatDuration(24 * 60 - sinceEight)}`
  const clock = new Intl.DateTimeFormat("fr-MA", { timeZone: MOROCCO_TZ, hour: "2-digit", minute: "2-digit" }).format(now)

  return (
    <div className="hidden w-[340px] lg:block" role="group" aria-label="Journée du souk">
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
        <span className={cn("font-semibold", open ? "text-[var(--adm-green)]" : "text-[var(--adm-saffron)]")}>{label}</span>
        <span className="font-semibold tabular-nums text-[var(--adm-text)]">{clock}</span>
      </div>
      <div className="relative h-2.5 rounded-full bg-[var(--adm-line)]">
        <div className="absolute inset-y-0 left-0 rounded-l-full bg-[var(--adm-green)]/80" style={{ width: `${(17 / 24) * 100}%` }} />
        <div className="absolute inset-y-0 right-0 rounded-r-full bg-[var(--adm-ink)]/80" style={{ width: `${(7 / 24) * 100}%` }} />
        <div
          className={cn("absolute -bottom-1.5 left-0 h-1 rounded-full bg-[var(--adm-saffron)]", delivering ? "opacity-100" : "opacity-50")}
          style={{ width: `${(7 / 24) * 100}%` }}
          title="Livraisons de 08h00 à 15h00"
        />
        <div
          className="adm-day-marker absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-[var(--adm-saffron)] shadow-[0_0_0_1px_var(--adm-line-strong)]"
          style={{ left: `${position}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-[var(--adm-muted)]">
        <span>08h</span><span>15h</span><span className="ml-auto mr-[27%]">01h</span><span>08h</span>
      </div>
    </div>
  )
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const { can, user, logout } = useAuth()
  const current = findAdminNavItem(pathname)
  const currentIndex = ADMIN_NAV_ITEMS.findIndex((item) => item.href === current?.href)
  const groups = useMemo(
    () => ADMIN_NAV.map((group) => ({ ...group, items: group.items.filter((item) => can(item.permission)) })).filter((group) => group.items.length),
    [can],
  )
  const leave = async (target: string) => {
    await logout()
    window.location.assign(target)
  }
  const displayName = user?.email || user?.phone || "Équipe Souki"

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-5 pt-5">
        <Link href="/admin" onClick={onNavigate} className="inline-flex rounded-xl bg-white px-3 py-2 shadow-sm">
          <SoukiLogo height={30} priority />
        </Link>
        <p className="mt-3 text-xs text-white/55">Back-office du marché de Fès</p>
      </div>
      <nav className="adm-scroll flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Navigation admin">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-xs font-semibold text-white/45">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.href === current?.href
                const index = ADMIN_NAV_ITEMS.findIndex((entry) => entry.href === item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      transitionTypes={[index >= currentIndex ? "adm-down" : "adm-up"]}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150",
                        active ? "bg-white/[0.12] font-semibold text-white" : "text-white/70 hover:bg-white/[0.06] hover:text-white",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--adm-saffron)] transition-opacity",
                          active ? "opacity-100" : "opacity-0",
                        )}
                        aria-hidden="true"
                      />
                      <item.icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-[#8FD49B]" : "text-white/55 group-hover:text-white/80")} aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <p className="truncate px-2 text-sm font-semibold text-white">{displayName}</p>
        <p className="truncate px-2 text-xs text-white/50">Compte staff</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => void leave("/login?switch=1")}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-white/[0.08] text-xs font-semibold text-white/80 transition-colors hover:bg-white/[0.14] hover:text-white">
            <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" /> Changer
          </button>
          <button type="button" onClick={() => void leave("/login?logged_out=1")}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-white/[0.08] text-xs font-semibold text-[#FFB4AA] transition-colors hover:bg-[#C2362B]/30 hover:text-white">
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Déconnexion
          </button>
        </div>
      </div>
    </div>
  )
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const current = findAdminNavItem(pathname)

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setDrawerOpen(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [drawerOpen])

  return (
    <div className="adm-body min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen bg-[var(--adm-ink)] lg:block">
        <SidebarContent pathname={pathname} />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu admin">
          <button type="button" aria-label="Fermer le menu" className="absolute inset-0 bg-[var(--adm-ink)]/50 backdrop-blur-[2px] animate-in fade-in-0" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px] bg-[var(--adm-ink)] shadow-2xl animate-in slide-in-from-left duration-200">
            <button type="button" aria-label="Fermer le menu" onClick={() => setDrawerOpen(false)} className="absolute right-3 top-4 rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white">
              <X className="h-5 w-5" />
            </button>
            <SidebarContent pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 border-b border-[var(--adm-line)] bg-[var(--adm-paper)]/85 backdrop-blur-md">
          <div className="flex min-h-16 items-center gap-4 px-4 lg:px-8">
            <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Ouvrir le menu"
              className="rounded-lg p-2 text-[var(--adm-text)] hover:bg-[var(--adm-line)] lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-[var(--adm-text)]">{current?.label ?? "Back-office"}</p>
              {current?.description && <p className="truncate text-xs text-[var(--adm-muted)]">{current.description}</p>}
            </div>
            <DayTimeline />
          </div>
        </header>
        <main className="min-w-0 flex-1">
          <ViewTransition
            key={pathname}
            enter={{ "adm-down": "adm-down", "adm-up": "adm-up", default: "adm-fade" }}
            exit={{ "adm-down": "adm-down", "adm-up": "adm-up", default: "adm-fade" }}
            default="none"
          >
            <div className="adm-content">{children}</div>
          </ViewTransition>
        </main>
      </div>
    </div>
  )
}
