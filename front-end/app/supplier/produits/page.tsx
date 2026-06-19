"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Circle, Package, Plus, Trash2 } from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { API_BASE_URL } from "@/lib/api"

interface ProductOffer {
  produit_id: number
  nom_fr: string
  nom_darija: string
  unite: string
  prix_affiche: number | null
  prix_gros: number | null
  stock: number
  is_active: boolean
}

interface CatalogueItem {
  produit_id: number
  nom_fr: string
  nom_darija: string
  unite: string
  prix_affiche: number | null
  deja_propose: boolean
}

export default function SupplierProduitsPage() {
  const { token } = useAuth()
  const [offres, setOffres] = useState<ProductOffer[]>([])
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addingId, setAddingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    if (!token) return
    try {
      const [offresRes, catRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/supplier/products`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/supplier/products/catalogue`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (offresRes.ok) {
        const data = await offresRes.json()
        setOffres(data.items ?? [])
      }
      if (catRes.ok) {
        setCatalogue(await catRes.json())
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchData() }, [token]) // eslint-disable-line

  const handleAdd = async (produitId: number) => {
    if (!token) return
    setAddingId(produitId)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/supplier/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ produit_id: produitId, stock: 0 }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.detail ?? `Erreur ${res.status}`)
      }
      setShowAddModal(false)
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'ajout")
    } finally {
      setAddingId(null)
    }
  }

  const handleToggle = async (offre: ProductOffer) => {
    if (!token) return
    setTogglingId(offre.produit_id)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/supplier/products/${offre.produit_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_active: !offre.is_active }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.detail ?? `Erreur ${res.status}`)
      }
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur")
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (produitId: number) => {
    if (!token) return
    setDeletingId(produitId)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/supplier/products/${produitId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.detail ?? `Erreur ${res.status}`)
      }
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la suppression")
    } finally {
      setDeletingId(null)
    }
  }

  const availableToAdd = catalogue.filter((c) => !c.deja_propose)

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/supplier" className="text-[#6F8070]">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-black text-[#264129]">Mes produits</h1>
          <p className="text-xs text-[#6F8070]">{offres.length} offre{offres.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          disabled={availableToAdd.length === 0}
          className="flex items-center gap-2 rounded-xl bg-[#1E8A3C] px-4 py-2 text-xs font-black text-white disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Ajouter
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-[#DDEBDD]" />
          ))}
        </div>
      ) : offres.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#DDEBDD] py-16 text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-[#DDEBDD]" />
          <p className="text-sm font-bold text-[#6F8070]">Aucun produit proposé</p>
          <p className="mt-1 text-xs text-[#6F8070]">Cliquez sur Ajouter pour proposer vos premiers produits</p>
        </div>
      ) : (
        <div className="space-y-3">
          {offres.map((offre) => (
            <div
              key={offre.produit_id}
              className="flex items-center gap-4 rounded-2xl border border-[#DDEBDD] bg-white p-4 shadow-sm"
            >
              <button
                onClick={() => handleToggle(offre)}
                disabled={togglingId === offre.produit_id}
                className="shrink-0"
                title={offre.is_active ? "Désactiver" : "Activer"}
              >
                {offre.is_active ? (
                  <CheckCircle2 className="h-6 w-6 text-[#1E8A3C]" />
                ) : (
                  <Circle className="h-6 w-6 text-[#DDEBDD]" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-black text-[#264129]">{offre.nom_fr}</p>
                <p className="text-xs text-[#6F8070]">
                  {offre.unite}
                  {offre.prix_gros != null ? ` · ${offre.prix_gros} DH/gros` : ""}
                  {` · Stock: ${offre.stock}`}
                </p>
              </div>
              <button
                onClick={() => handleDelete(offre.produit_id)}
                disabled={deletingId === offre.produit_id}
                className="shrink-0 rounded-lg p-2 text-red-400 hover:bg-red-50 disabled:opacity-40"
                title="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-black text-[#264129]">Ajouter un produit</h2>
              <button onClick={() => setShowAddModal(false)} className="text-xs font-bold text-[#6F8070]">
                Fermer
              </button>
            </div>
            {availableToAdd.length === 0 ? (
              <p className="text-sm text-[#6F8070]">Vous proposez déjà tous les produits du catalogue.</p>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {availableToAdd.map((item) => (
                  <button
                    key={item.produit_id}
                    onClick={() => handleAdd(item.produit_id)}
                    disabled={addingId === item.produit_id}
                    className="flex w-full items-center justify-between rounded-xl border border-[#DDEBDD] px-4 py-3 text-left text-sm hover:border-[#1E8A3C]/40 disabled:opacity-50"
                  >
                    <div>
                      <p className="font-bold text-[#264129]">{item.nom_fr}</p>
                      <p className="text-xs text-[#6F8070]">{item.unite}</p>
                    </div>
                    <span className="text-xs font-black text-[#1E8A3C]">
                      {addingId === item.produit_id ? "..." : "+ Ajouter"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
