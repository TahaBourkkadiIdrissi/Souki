import { cn } from "@/lib/utils"

type StatusType = "pending" | "confirmed" | "preparing" | "enroute" | "delivered" | "refused" | "cancelled"

interface StatusBadgeProps {
  status: StatusType
  size?: "sm" | "md" | "lg"
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  pending: {
    label: "En attente",
    className: "bg-[#F5C400]/20 text-[#B8860B] border-[#F5C400]",
  },
  confirmed: {
    label: "Confirmé",
    className: "bg-[#1A4F8A]/10 text-[#1A4F8A] border-[#1A4F8A]",
  },
  preparing: {
    label: "Préparation",
    className: "bg-[#4CB84A]/10 text-[#4CB84A] border-[#4CB84A]",
  },
  enroute: {
    label: "En route",
    className: "bg-[#F07C00]/10 text-[#F07C00] border-[#F07C00]",
  },
  delivered: {
    label: "Livré",
    className: "bg-[#1E8A3C]/10 text-[#1E8A3C] border-[#1E8A3C]",
  },
  refused: {
    label: "Refusé",
    className: "bg-red-100 text-red-600 border-red-500",
  },
  cancelled: {
    label: "Annulé",
    className: "bg-gray-100 text-gray-600 border-gray-400",
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
        "inline-flex items-center font-medium rounded-full border",
        config.className,
        sizeStyles[size]
      )}
    >
      {config.label}
    </span>
  )
}
