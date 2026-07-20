"use client"

import { cn } from "@/lib/utils"
import { useHaptic } from "@/hooks/useHaptic"

export type SegmentedOption<T extends string> = {
  value: T
  label: string
}

/**
 * Controle segmente facon iOS : pilule de fond claire, segment actif blanc
 * sureleve. Sert d'onglets courts (filtres, tri, categories) a portee de pouce.
 * Feedback haptique leger a chaque changement.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  const haptic = useHaptic()

  return (
    <div
      role="tablist"
      className={cn(
        "flex gap-1 rounded-2xl bg-[#EAF1EA] p-1",
        className,
      )}
    >
      {options.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => {
              if (!isActive) {
                haptic("light")
                onChange(option.value)
              }
            }}
            className={cn(
              "flex-1 rounded-xl px-3 py-2 text-[13px] font-bold transition-all active:scale-[0.97]",
              isActive
                ? "bg-white text-[#1A4F2C] shadow-sm"
                : "text-[#607061]",
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
