"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ClipboardList, MapPin, PackageCheck, Phone } from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { API_BASE_URL } from "@/lib/api"

type PreparationLine = {
  product_id: number
  nom_fr: string
  quantite_kg: number
  unite: string
}

type PreparationOrder = {
  id: number
  statut: string
  creneau_livraison: string | null
  montant_total: number
  client_nom: string
  client_phone: string | null
  adresse: string | null
  produits: PreparationLine[]
}

type PreparationResponse = {
  date: string
  nombre_commandes: number
  picking: PreparationLine[]
  commandes: PreparationOrder[]
}

const STATUS_LABELS: Record<string, string> = {
  VERROUILLEE: "À préparer",
  EN_ATTENTE_LIVREUR: "En attente du livreur",
  A_LIVRER: "Ramassée",
}

export default function SupplierPreparationPage() {
  const { token } = useAuth()
  const [data, setData] = useState<PreparationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    const load = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/supplier/preparation`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        })
        if (!response.ok) throw new Error(`Erreur ${response.status}`)
        setData(await response.json())
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Chargement impossible.")
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [token])

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center gap-3">
        <Link href="/supplier" className="text-[#6F8070]">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-black text-[#264129]">Préparation du jour</h1>
          <p className="text-xs text-[#6F8070]">Uniquement les commandes actives d’aujourd’hui</p>
        </div>
      </header>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

      {loading ? (
        <div className="h-52 animate-pulse rounded-2xl bg-[#DDEBDD]" />
      ) : data ? (
        <>
          <section className="mb-6 rounded-2xl border border-[#BFE2C4] bg-[#F0FDF4] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-black text-[#264129]">
                <ClipboardList className="h-5 w-5 text-[#1E8A3C]" />
                Liste de picking
              </h2>
              <span className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-[#1E8A3C]">
                {data.nombre_commandes} commande{data.nombre_commandes > 1 ? "s" : ""}
              </span>
            </div>
            {data.picking.length === 0 ? (
              <p className="text-sm font-bold text-[#6F8070]">Rien à préparer pour le moment.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {data.picking.map((item) => (
                  <div key={item.product_id} className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                    <span className="font-bold text-[#264129]">{item.nom_fr}</span>
                    <span className="font-black text-[#1E8A3C]">{item.quantite_kg} {item.unite}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wide text-[#6F8070]">Détail des commandes</h2>
            {data.commandes.map((order) => (
              <article key={order.id} className="rounded-2xl border border-[#DDEBDD] bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-[#264129]">Commande #{order.id}</h3>
                    <p className="text-sm font-bold text-[#6F8070]">{order.client_nom}</p>
                  </div>
                  <span className="rounded-lg bg-[#EAF8EC] px-2 py-1 text-xs font-bold text-[#1E8A3C]">
                    {STATUS_LABELS[order.statut] ?? order.statut}
                  </span>
                </div>
                <div className="mt-3 space-y-1 text-xs text-[#6F8070]">
                  {order.client_phone && <p className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {order.client_phone}</p>}
                  {order.adresse && <p className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {order.adresse}</p>}
                  {order.creneau_livraison && <p>Créneau : {order.creneau_livraison}</p>}
                </div>
                <div className="mt-3 flex flex-wrap gap-1 border-t border-[#DDEBDD] pt-3">
                  {order.produits.map((line) => (
                    <span key={line.product_id} className="inline-flex items-center gap-1 rounded-lg bg-[#F5F5F0] px-2 py-1 text-xs font-bold text-[#264129]">
                      <PackageCheck className="h-3.5 w-3.5 text-[#1E8A3C]" />
                      {line.nom_fr} · {line.quantite_kg} {line.unite}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </section>
        </>
      ) : null}
    </main>
  )
}
