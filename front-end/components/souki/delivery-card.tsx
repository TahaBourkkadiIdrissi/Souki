"use client"

import { useState } from "react"
import {
  Banknote,
  Check,
  Clock,
  CreditCard,
  MapPin,
  Package,
  Phone,
  Wallet,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"

interface DeliveryCardProps {
  id: string
  sequenceNumber: number
  orderNumber: string
  timeSlot: string
  address: string
  clientName: string
  clientPhone: string
  callHref?: string | null
  packageCount: number
  amount: number
  paymentMethod: "cod" | "wallet" | "cmi"
  status: "pending" | "enroute" | "delivered" | "absent"
  onStatusChange?: (id: string, status: "enroute" | "delivered" | "absent") => void
}

const paymentIcons = {
  cod: Banknote,
  wallet: Wallet,
  cmi: CreditCard,
}

const paymentLabels = {
  cod: "COD",
  wallet: "Wallet",
  cmi: "CMI",
}

export function DeliveryCard({
  id,
  sequenceNumber,
  orderNumber,
  timeSlot,
  address,
  clientName,
  clientPhone,
  callHref,
  packageCount,
  amount,
  paymentMethod,
  status,
  onStatusChange,
}: DeliveryCardProps) {
  const [showConfetti, setShowConfetti] = useState(false)
  const [deliveryTime, setDeliveryTime] = useState<string | null>(null)

  const PaymentIcon = paymentIcons[paymentMethod]

  const handleDeliver = () => {
    const now = new Date()
    setDeliveryTime(`${now.getHours()}h${now.getMinutes().toString().padStart(2, "0")}`)
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 2000)
    onStatusChange?.(id, "delivered")
  }

  const statusBadgeStyles = {
    pending: "bg-[#F5C400]/20 text-[#B8860B]",
    enroute: "bg-[#F07C00]/20 text-[#F07C00]",
    delivered: "bg-[#1E8A3C]/20 text-[#1E8A3C]",
    absent: "bg-red-100 text-red-600",
  }

  return (
    <div
      className={cn(
        "relative bg-white rounded-2xl shadow-md overflow-hidden border-l-4 transition-all",
        status === "delivered" && "border-l-[#1E8A3C] opacity-75",
        status === "absent" && "border-l-red-500 opacity-75",
        status === "enroute" && "border-l-[#F07C00]",
        status === "pending" && "border-l-[#F5C400]",
        showConfetti && "ring-4 ring-[#4CB84A]/30"
      )}
    >
      <div className="flex items-center justify-between p-4 border-b bg-[#F0FAF1]">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-white text-[#1E8A3C] flex items-center justify-center text-sm font-bold shadow-sm">
            {sequenceNumber}
          </span>
          <span className="font-bold text-[#1E8A3C]">#{orderNumber}</span>
          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", statusBadgeStyles[status])}>
            {status === "delivered" ? "Livre" : status === "absent" ? "Absent" : status === "enroute" ? "En route" : "En attente"}
          </span>
        </div>
        <div className="flex items-center gap-1 text-sm text-[#8A8A8A]">
          <Clock className="w-4 h-4" />
          <span>{timeSlot}</span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <MapPin className="w-5 h-5 text-[#F07C00] flex-shrink-0 mt-0.5" />
          <p className="font-semibold text-[#3D3D3D]">{address}</p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[#3D3D3D] font-medium truncate">{clientName}</p>
            <p className="text-sm text-[#8A8A8A] truncate">{clientPhone}</p>
          </div>
          <a
            href={callHref || undefined}
            aria-disabled={!callHref}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-colors flex-shrink-0",
              callHref
                ? "bg-[#4CB84A] text-white hover:bg-[#1E8A3C]"
                : "bg-gray-100 text-[#8A8A8A] pointer-events-none"
            )}
          >
            <Phone className="w-3 h-3" />
            <span>Appeler</span>
          </a>
        </div>

        <div className="flex items-start gap-2 text-sm text-[#8A8A8A]">
          <Package className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>{packageCount} colis a remettre</p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-[#F07C00]">{amount} DH</span>
            <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-full text-xs">
              <PaymentIcon className="w-3 h-3" />
              {paymentLabels[paymentMethod]}
            </span>
          </div>
        </div>

        {status === "delivered" && deliveryTime && (
          <div className="flex items-center gap-2 text-[#1E8A3C] bg-[#1E8A3C]/10 px-3 py-2 rounded-xl">
            <Check className="w-5 h-5" />
            <span className="font-medium">Livre a {deliveryTime}</span>
          </div>
        )}

        {status === "absent" && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-xl">
            <X className="w-5 h-5" />
            <span className="font-medium">Client marque absent</span>
          </div>
        )}
      </div>

      {status !== "delivered" && status !== "absent" && (
        <div className="flex gap-2 p-4 pt-0">
          {status === "pending" && (
            <button
              onClick={() => onStatusChange?.(id, "enroute")}
              className="flex-1 py-2.5 bg-[#F07C00] text-white rounded-xl font-semibold hover:bg-[#D66B00] transition-colors"
            >
              En Route
            </button>
          )}
          {status === "enroute" && (
            <>
              <button
                onClick={handleDeliver}
                className="flex-1 py-2.5 bg-[#1E8A3C] text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-[#176B2E] transition-colors"
              >
                <Check className="w-5 h-5" />
                Livre
              </button>
              <button
                onClick={() => onStatusChange?.(id, "absent")}
                className="py-2.5 px-4 bg-red-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-red-600 transition-colors"
              >
                <X className="w-5 h-5" />
                Absent
              </button>
            </>
          )}
        </div>
      )}

      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <span className="text-4xl animate-bounce text-[#4CB84A] font-bold">OK</span>
        </div>
      )}
    </div>
  )
}
