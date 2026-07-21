import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface KPICardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: {
    value: number
    label?: string
  }
  variant?: "default" | "success" | "warning" | "danger"
  className?: string
}

const variantStyles = {
  default: {
    bg: "bg-white",
    iconBg: "bg-[#F0FAF1]",
    iconColor: "text-[#1E8A3C]",
  },
  success: {
    bg: "bg-[#F0FAF1]",
    iconBg: "bg-[#1E8A3C]",
    iconColor: "text-white",
  },
  warning: {
    bg: "bg-[#F07C00]/5",
    iconBg: "bg-[#F07C00]",
    iconColor: "text-white",
  },
  danger: {
    bg: "bg-red-50",
    iconBg: "bg-red-500",
    iconColor: "text-white",
  },
}

export function KPICard({
  title,
  value,
  icon: Icon,
  trend,
  variant = "default",
  className,
}: KPICardProps) {
  const styles = variantStyles[variant]

  return (
    <div
      className={cn(
        // p-4 sur mobile : quatre de ces cartes en grille 2x2 mangeaient sinon
        // tout l'ecran avant le moindre contenu utile.
        "rounded-2xl p-4 shadow-sm border border-gray-100 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md sm:p-5",
        styles.bg,
        className
      )}
    >
      <div className="flex items-start justify-between mb-2.5 sm:mb-3">
        <div className={cn("p-2 rounded-xl sm:p-2.5", styles.iconBg)}>
          <Icon className={cn("w-4.5 h-4.5 sm:w-5 sm:h-5", styles.iconColor)} />
        </div>
        {trend && (
          <div
            className={cn(
              "flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-full",
              trend.value >= 0
                ? "bg-[#4CB84A]/10 text-[#4CB84A]"
                : "bg-red-100 text-red-600"
            )}
          >
            {trend.value >= 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            <span>
              {trend.value >= 0 ? "+" : ""}
              {trend.value}
              {trend.label}
            </span>
          </div>
        )}
      </div>
      <p className="text-xs text-[#8A8A8A] mb-1 sm:text-sm">{title}</p>
      <p className="text-xl font-bold tabular-nums text-[#3D3D3D] sm:text-2xl">{value}</p>
    </div>
  )
}
