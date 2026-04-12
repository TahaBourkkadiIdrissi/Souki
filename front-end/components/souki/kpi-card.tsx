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
        "rounded-2xl p-5 shadow-sm border border-gray-100",
        styles.bg,
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn("p-2.5 rounded-xl", styles.iconBg)}>
          <Icon className={cn("w-5 h-5", styles.iconColor)} />
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
      <p className="text-sm text-[#8A8A8A] mb-1">{title}</p>
      <p className="text-2xl font-bold text-[#3D3D3D]">{value}</p>
    </div>
  )
}
