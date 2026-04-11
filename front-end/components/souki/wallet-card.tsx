"use client"

import { Wallet, Plus, History } from "lucide-react"
import { cn } from "@/lib/utils"

interface WalletCardProps {
  balance: number
  className?: string
  onRecharge?: () => void
  showHistory?: boolean
  compact?: boolean
}

export function WalletCard({
  balance,
  className,
  onRecharge,
  showHistory = true,
  compact = false,
}: WalletCardProps) {
  const isLow = balance < 50

  if (compact) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-full",
          isLow ? "bg-[#F07C00]/10 text-[#F07C00]" : "bg-[#4CB84A]/10 text-[#4CB84A]",
          className
        )}
      >
        <Wallet className="w-4 h-4" />
        <span className="font-semibold">{balance.toFixed(2)} DH</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "bg-gradient-to-br from-[#1E8A3C] to-[#4CB84A] rounded-2xl p-6 text-white shadow-lg",
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-white/20 rounded-xl">
            <Wallet className="w-6 h-6" />
          </div>
          <span className="font-medium">Wallet SOUKI</span>
        </div>
        {showHistory && (
          <button className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <History className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="mb-4">
        <p className="text-sm text-white/70 mb-1">Solde disponible</p>
        <p className="text-3xl font-bold">{balance.toFixed(2)} DH</p>
      </div>

      {onRecharge && (
        <button
          onClick={onRecharge}
          className="w-full py-2.5 bg-white text-[#1E8A3C] rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-white/90 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Recharger
        </button>
      )}

      {isLow && (
        <p className="text-xs text-white/70 mt-3 text-center">
          Solde faible - Pensez à recharger
        </p>
      )}
    </div>
  )
}
