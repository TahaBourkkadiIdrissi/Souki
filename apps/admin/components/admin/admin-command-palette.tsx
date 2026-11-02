"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { CornerDownLeft, Search } from "lucide-react"

import { useAdminNavigation } from "@/components/admin/admin-link"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useAuth } from "@/hooks/useAuth"
import { ADMIN_NAV, type AdminNavItem } from "@/lib/admin-nav"
import { cn } from "@/lib/utils"

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

/** Palette Ctrl+K : aller a une page de l'admin au clavier. Navigation seule, aucune action metier. */
export function AdminCommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { can } = useAuth()
  const { navigate, prefetch } = useAdminNavigation()
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onOpenChange])

  const groups = useMemo(() => {
    const needle = normalize(query.trim())
    return ADMIN_NAV
      .map((group) => ({
        label: group.label,
        items: group.items.filter((item) =>
          can(item.permission) && (!needle || normalize(`${item.label} ${item.description} ${group.label}`).includes(needle))),
      }))
      .filter((group) => group.items.length)
  }, [can, query])
  const results = useMemo(() => groups.flatMap((group) => group.items), [groups])
  const safeIndex = Math.min(activeIndex, Math.max(results.length - 1, 0))

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${safeIndex}"]`)?.scrollIntoView({ block: "nearest" })
  }, [safeIndex])

  const go = (item: AdminNavItem) => {
    onOpenChange(false)
    navigate(item.href)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (!results.length) return
      const next = (safeIndex + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length
      setActiveIndex(next)
      prefetch(results[next].href)
    } else if (event.key === "Enter" && results[safeIndex]) {
      event.preventDefault()
      go(results[safeIndex])
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) { setQuery(""); setActiveIndex(0) }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="top-[14vh] max-w-[calc(100%-2rem)] translate-y-0 gap-0 overflow-hidden rounded-2xl border-[var(--adm-line)] bg-[var(--adm-surface)] p-0 shadow-[0_24px_60px_-20px_rgba(22,48,31,0.45)] sm:max-w-xl"
      >
        <DialogTitle className="sr-only">Aller à une page</DialogTitle>
        <DialogDescription className="sr-only">Tapez le nom d&apos;une page, puis Entrée pour l&apos;ouvrir.</DialogDescription>
        <div className="flex items-center gap-3 border-b border-[var(--adm-line)] px-4">
          <Search className="h-4 w-4 shrink-0 text-[var(--adm-muted)]" aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActiveIndex(0) }}
            onKeyDown={onKeyDown}
            placeholder="Aller à… commandes, livreurs, prix"
            role="combobox"
            aria-expanded="true"
            aria-controls="adm-palette-list"
            aria-activedescendant={results[safeIndex] ? `adm-palette-${safeIndex}` : undefined}
            className="h-14 w-full bg-transparent text-[15px] text-[var(--adm-text)] outline-none placeholder:text-[var(--adm-muted)]/80"
          />
          <kbd className="hidden rounded-md border border-[var(--adm-line)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--adm-muted)] sm:block">Échap</kbd>
        </div>
        <ul id="adm-palette-list" ref={listRef} role="listbox" aria-label="Pages" className="adm-scroll-light max-h-[min(60vh,420px)] overflow-y-auto p-2">
          {results.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-[var(--adm-muted)]">Aucune page ne correspond à « {query} ».</li>
          )}
          {groups.map((group) => (
            <li key={group.label} role="presentation">
              <p className="px-3 pb-1 pt-2 text-xs font-semibold text-[var(--adm-muted)]">{group.label}</p>
              <ul role="presentation">
                {group.items.map((item) => {
                  const index = results.indexOf(item)
                  const active = index === safeIndex
                  return (
                    <li
                      key={item.href}
                      id={`adm-palette-${index}`}
                      data-index={index}
                      role="option"
                      aria-selected={active}
                      onMouseMove={() => { if (!active) setActiveIndex(index) }}
                      onClick={() => go(item)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-100",
                        active ? "bg-[var(--adm-green-soft)]" : "hover:bg-[var(--adm-paper)]",
                      )}
                    >
                      <span className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                        active ? "bg-[var(--adm-green)] text-white" : "bg-[var(--adm-paper)] text-[var(--adm-muted)]",
                      )}>
                        <item.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--adm-text)]">{item.label}</span>
                        <span className="block truncate text-xs text-[var(--adm-muted)]">{item.description}</span>
                      </span>
                      <CornerDownLeft className={cn("h-4 w-4 shrink-0 text-[var(--adm-green)] transition-opacity", active ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-4 border-t border-[var(--adm-line)] bg-[var(--adm-paper)] px-4 py-2 text-[11px] text-[var(--adm-muted)]">
          <span><kbd className="font-semibold">↑ ↓</kbd> choisir</span>
          <span><kbd className="font-semibold">Entrée</kbd> ouvrir</span>
          <span className="ml-auto"><kbd className="font-semibold">Ctrl K</kbd> ouvrir ou fermer</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
