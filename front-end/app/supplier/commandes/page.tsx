"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ShoppingCart } from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { API_BASE_URL } from "@/lib/api"

interface SupplierOrder {
  id: number
  date_commande: string | null
  statut: string
  montant_total: number
  client_nom?: string
  produits?: { nom_fr: string; quantite_kg: number }[]
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  EN_ATTENTE: { label: "En attente", color: "bg-amber-100 text-amber-700" },
  CONFIRMEE: { label: "Confirmée", color: "bg-blue-100 text-blue-700" },
  EN_COURS: { label: "En cours", color: "bg-purple-100 text-purple-700" },
  LIVREE: { label: "Livrée", color: "bg-green-100 text-green-700" },
  ANNULEE: { label: "Annulée", color: "bg-red-100 text-red-700" },
}

export default function SupplierCommandesPage() {
  const { token } = useAuth()
  const [orders, setOrders] = useState<SupplierOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    const fetch_ = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/supplier/orders`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(`Erreur ${res.status}`)
        const data = await res.json()
        setOrders(data.orders ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur")
      } finally {
        setLoading(false)
      }
    }
    void fetch_()
  }, [token])

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/supplier" className="text-[#6F8070]">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-black text-[#264129]">Commandes</h1>
          <p className="text-xs text-[#6F8070]">Ventes liées à vos produits</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-[#DDEBDD]" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#DDEBDD] py-16 text-center">
          <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-[#DDEBDD]" />
          <p className="text-sm font-bold text-[#6F8070]">Aucune commande pour l'instant</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const status = STATUS_LABELS[order.statut] ?? { label: order.statut, color: "bg-gray-100 text-gray-700" }
            return (
              <div key={order.id} className="rounded-2xl border border-[#DDEBDD] bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-[#264129]">Commande #{order.id}</p>
                    {order.client_nom && (
                      <p className="text-xs text-[#6F8070]">{order.client_nom}</p>
                    )}
                    {order.date_commande && (
                      <p className="mt-0.5 text-xs text-[#6F8070]">
                        {new Date(order.date_commande).toLocaleDateString("fr-MA")}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`inline-block rounded-lg px-2 py-0.5 text-xs font-bold ${status.color}`}>
                      {status.label}
                    </span>
                    <p className="mt-1 text-sm font-black text-[#264129]">{order.montant_total.toFixed(2)} DH</p>
                  </div>
                </div>
                {order.produits && order.produits.length > 0 && (
                  <div className="mt-3 border-t border-[#DDEBDD] pt-3">
                    <div className="flex flex-wrap gap-1">
                      {order.produits.map((p, i) => (
                        <span key={i} className="rounded-lg bg-[#EAF8EC] px-2 py-0.5 text-xs text-[#264129]">
                          {p.nom_fr} ({p.quantite_kg} kg)
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
