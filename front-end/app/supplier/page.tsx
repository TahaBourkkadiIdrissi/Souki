"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ClipboardList, Package, ShoppingCart, Store, TrendingUp } from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { API_BASE_URL } from "@/lib/api"

interface SupplierStats {
  products_count: number
  active_products_count: number
  orders_count: number
  revenue_total: number
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[#DDEBDD] bg-white p-5 shadow-sm">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-[#6F8070]">{label}</p>
        <p className="mt-0.5 text-2xl font-black text-[#264129]">{value}</p>
      </div>
    </div>
  )
}

const navItems = [
  { href: "/supplier/preparation", label: "Préparation du jour", icon: ClipboardList, desc: "Picking et commandes à préparer" },
  { href: "/supplier/produits", label: "Mes produits", icon: Package, desc: "Gérer vos offres" },
  { href: "/supplier/commandes", label: "Commandes", icon: ShoppingCart, desc: "Suivre vos ventes" },
  { href: "/supplier/profil", label: "Mon profil", icon: Store, desc: "Informations boutique" },
]

export default function SupplierDashboardPage() {
  const { token } = useAuth()
  const [stats, setStats] = useState<SupplierStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    const fetch_ = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/supplier/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) setStats(await res.json())
      } finally {
        setLoading(false)
      }
    }
    void fetch_()
  }, [token])

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1E8A3C]">
          <TrendingUp className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-black text-[#264129]">Tableau de bord</h1>
          <p className="text-xs text-[#6F8070]">Espace fournisseur</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-[#DDEBDD]" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Package} label="Produits" value={stats.products_count} color="bg-[#1E8A3C]" />
          <StatCard icon={Package} label="Actifs" value={stats.active_products_count} color="bg-[#264129]" />
          <StatCard icon={ShoppingCart} label="Commandes" value={stats.orders_count} color="bg-amber-500" />
          <StatCard
            icon={TrendingUp}
            label="Revenus"
            value={`${stats.revenue_total.toFixed(0)} DH`}
            color="bg-blue-500"
          />
        </div>
      ) : null}

      <div className="mt-8 space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wide text-[#6F8070]">Navigation</h2>
        {navItems.map(({ href, label, icon: Icon, desc }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 rounded-2xl border border-[#DDEBDD] bg-white p-4 shadow-sm transition-colors hover:border-[#1E8A3C]/40"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF8EC]">
              <Icon className="h-5 w-5 text-[#1E8A3C]" />
            </div>
            <div>
              <p className="text-sm font-black text-[#264129]">{label}</p>
              <p className="text-xs text-[#6F8070]">{desc}</p>
            </div>
            <span className="ml-auto text-[#6F8070]">›</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
