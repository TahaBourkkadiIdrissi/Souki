"use client"

import { Languages } from "lucide-react"

import { useLocale } from "@/contexts/locale-context"
import type { Locale } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const OPTIONS: Array<{ value: Locale; label: string; lang: string }> = [
  { value: "fr", label: "FR", lang: "fr" },
  { value: "ar", label: "العربية", lang: "ar" },
]

/** Bascule francais / arabe. Le francais reste la langue par defaut du site. */
export function LanguageSwitch({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { locale, setLocale, t } = useLocale()

  return (
    <div
      role="radiogroup"
      aria-label={t("Choisir la langue")}
      className={cn("inline-flex items-center gap-0.5 rounded-full border border-[#E4EFE5] bg-white p-1", className)}
    >
      {!compact && <Languages className="mx-1.5 h-4 w-4 text-[#1E8A3C]" aria-hidden="true" />}
      {OPTIONS.map((option) => {
        const active = locale === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            lang={option.lang}
            onClick={() => setLocale(option.value)}
            className={cn(
              "min-h-8 rounded-full px-3 text-xs font-bold transition-colors duration-200",
              active ? "bg-[#1E8A3C] text-white shadow-sm" : "text-[#3D3D3D] hover:bg-[#F0FAF1] hover:text-[#1E8A3C]",
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
