"use client"

import { cn } from "@/lib/utils"

interface PasswordStrengthProps {
  password: string
  className?: string
}

function evaluatePasswordStrength(value: string) {
  let score = 0

  if (value.length >= 6) score++
  if (/[A-Z]/.test(value)) score++
  if (/[0-9]/.test(value)) score++
  if (/[^A-Za-z0-9]/.test(value)) score++
  if (value.length >= 10) score++

  return Math.min(score, 5)
}

function getPasswordStrengthMeta(score: number) {
  if (score <= 2) {
    return {
      label: "Faible",
      colorClass: "bg-red-500",
    }
  }

  if (score === 3) {
    return {
      label: "Moyen",
      colorClass: "bg-amber-500",
    }
  }

  return {
    label: "Fort",
    colorClass: "bg-emerald-500",
  }
}

export function PasswordStrength({
  password,
  className,
}: PasswordStrengthProps) {
  const score = evaluatePasswordStrength(password)
  const width = `${(score / 5) * 100}%`
  const strength = getPasswordStrengthMeta(score)

  return (
    <div className={cn("mt-3", className)}>
      <div className="mb-2 flex items-center justify-between text-xs font-medium">
        <span className="text-[#8A8A8A]">Force du mot de passe</span>
        <span className={password ? "text-[#3D3D3D]" : "text-[#8A8A8A]"}>
          {password ? strength.label : "En attente"}
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300 ease-out",
            strength.colorClass
          )}
          style={{ width }}
        />
      </div>
    </div>
  )
}
