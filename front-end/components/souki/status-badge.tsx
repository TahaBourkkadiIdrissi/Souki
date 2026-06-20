import { cn } from "@/lib/utils"

type StatusType = "pending" | "confirmed" | "preparing" | "enroute" | "delivered" | "refused" | "cancelled"

interface StatusBadgeProps {
  status: StatusType
  size?: "sm" | "md" | "lg"
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  pending: {
    label: "En attente",
    className: "border-[#F5C400] bg-[#F5C400]/20 text-[#8A6800] dark:text-yellow-300",
  },
  confirmed: {
    label: "Confirmé",
    className: "border-[#1A4F8A] bg-[#1A4F8A]/10 text-[#1A4F8A] dark:text-blue-300",
  },
  preparing: {
    label: "Préparation",
    className: "border-[#4CB84A] bg-[#4CB84A]/10 text-[#277A32] dark:text-[#8EDD8B]",
  },
  enroute: {
    label: "En route",
    className: "border-[#F07C00] bg-[#F07C00]/10 text-[#C76600] dark:text-orange-300",
  },
  delivered: {
    label: "Livré",
    className: "border-[#1E8A3C] bg-[#1E8A3C]/10 text-[#1E8A3C] dark:text-[#8EDD8B]",
  },
  refused: {
    label: "Refusé",
    className: "border-red-500 bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300",
  },
  cancelled: {
    label: "Annulé",
    className: "border-gray-400 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  },
}

const sizeStyles = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-3 py-1 text-sm",
  lg: "px-4 py-1.5 text-base",
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        config.className,
        sizeStyles[size],
      )}
    >
      {config.label}
    </span>
  )
}
