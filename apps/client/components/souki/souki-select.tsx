"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Check, ChevronDown, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

export interface SoukiSelectOption {
  value: string
  label: string
  /** Ligne secondaire (ex: nom en darija). */
  subtitle?: string
  /** Libellé de groupe (ex: catégorie de plat). */
  group?: string
}

interface SoukiSelectProps {
  value: string
  onChange: (value: string) => void
  options: SoukiSelectOption[]
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  ariaLabel?: string
  /** Icône optionnelle affichée à gauche du libellé sélectionné. */
  leadingIcon?: ReactNode
  className?: string
}

/**
 * Dropdown maison, stylé aux couleurs SOUKI (panneau qui se déploie sous le
 * bouton — pas de <select> natif, donc rendu identique iOS / Android / desktop).
 * Le panneau est en flux (inline) pour ne jamais être rogné par l'overflow du
 * modal ; il défile au-delà de sa hauteur max.
 */
export function SoukiSelect({
  value,
  onChange,
  options,
  placeholder = "Sélectionnez…",
  disabled = false,
  loading = false,
  ariaLabel,
  leadingIcon,
  className,
}: SoukiSelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  )

  // Groupes dans l'ordre d'apparition, en préservant l'ordre des options.
  const groups = useMemo(() => {
    const map = new Map<string, SoukiSelectOption[]>()
    for (const option of options) {
      const key = option.group ?? ""
      const bucket = map.get(key)
      if (bucket) bucket.push(option)
      else map.set(key, [option])
    }
    return [...map.entries()]
  }, [options])

  // Fermeture au clic extérieur + touche Échap.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  const handleSelect = (next: string) => {
    onChange(next)
    setOpen(false)
  }

  const isDisabled = disabled || loading

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={isDisabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex w-full items-center gap-2 rounded-2xl border bg-gray-50 px-4 py-3 text-left outline-none transition-all",
          open ? "border-[#F07C00] ring-2 ring-[#F07C00]/15" : "border-gray-200",
          isDisabled ? "cursor-not-allowed opacity-60" : "hover:border-[#F5D4AE]"
        )}
      >
        {leadingIcon && <span className="shrink-0 text-[#F07C00]">{leadingIcon}</span>}
        <span className="min-w-0 flex-1">
          {selected ? (
            <span className="flex items-baseline gap-2">
              <span className="truncate font-semibold text-[#264129]">{selected.label}</span>
              {selected.subtitle && (
                <span className="truncate text-xs text-[#6C7E6E]">{selected.subtitle}</span>
              )}
            </span>
          ) : (
            <span className="truncate text-[#6C7E6E]">
              {loading ? "Chargement…" : placeholder}
            </span>
          )}
        </span>
        {loading ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#F07C00]" />
        ) : (
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 text-[#6C7E6E] transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        )}
      </button>

      {open && !isDisabled && (
        <div
          role="listbox"
          className="mt-2 max-h-64 overflow-y-auto overscroll-contain rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl shadow-black/5 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {options.length === 0 && (
            <p className="px-3 py-2 text-sm text-[#6C7E6E]">Aucune option disponible.</p>
          )}
          {groups.map(([groupLabel, groupOptions]) => (
            <div key={groupLabel || "__default"}>
              {groupLabel && (
                <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-[#C96A00]">
                  {groupLabel}
                </p>
              )}
              {groupOptions.map((option) => {
                const isSelected = option.value === value
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors",
                      isSelected ? "bg-[#FFF5EB]" : "hover:bg-gray-50"
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-sm",
                          isSelected ? "font-bold text-[#C96A00]" : "font-medium text-[#264129]"
                        )}
                      >
                        {option.label}
                      </span>
                      {option.subtitle && (
                        <span className="block truncate text-xs text-[#6C7E6E]">
                          {option.subtitle}
                        </span>
                      )}
                    </span>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-[#F07C00]" />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
