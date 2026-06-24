"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { API_BASE_URL, ApiError } from "@/lib/api"
import { MapboxLocator } from "@/components/souki/mapbox-locator"

interface Produit {
  id: number
  nom_fr: string
  nom_darija: string
  unite: string
  prix_affiche?: number | null
}

export default function DevenirFournisseurPage() {
  const { user, token } = useAuth()
  const router = useRouter()

  const [shopName, setShopName] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [ville, setVille] = useState("")
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [description, setDescription] = useState("")
  const [mapboxModalOpen, setMapboxModalOpen] = useState(false)

  const [produits, setProduits] = useState<Produit[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const [loading, setLoading] = useState(false)
  const [loadingProduits, setLoadingProduits] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (user?.roles.includes("FOURNISSEUR")) {
      router.replace("/supplier")
    }
  }, [user, router])

  useEffect(() => {
    const fetchProduits = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/catalogue`)
        if (!res.ok) throw new Error("Erreur catalogue")
        const data = await res.json()
        const items: Produit[] = Array.isArray(data)
          ? data
          : Array.isArray(data.items)
            ? data.items
            : []
        setProduits(items)
      } catch {
        setProduits([])
      } finally {
        setLoadingProduits(false)
      }
    }
    void fetchProduits()
  }, [])

  const toggleProduit = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (latitude === null || longitude === null) {
      setError("Localisez votre boutique sur la carte pour continuer.")
      return
    }
    if (selectedIds.size === 0) {
      setError("Sélectionnez au moins un produit.")
      return
    }
    setError(null)
    setLoading(true)

    try {
      // Un seul appel : produit_ids inclus dans la demande (le CLIENT a supplier.request.create)
      const res = await fetch(`${API_BASE_URL}/api/supplier/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          shop_name: shopName,
          phone,
          address,
          ville,
          latitude,
          longitude,
          description,
          produit_ids: Array.from(selectedIds),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.detail || `Erreur ${res.status}`)
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-5xl">✅</div>
        <h1 className="text-2xl font-black text-[#264129]">Demande envoyée !</h1>
        <p className="max-w-sm text-sm text-[#6F8070]">
          Votre demande est en attente de validation par l'équipe Souki. Vous serez notifié par email.
        </p>
        <button
          onClick={() => router.push("/")}
          className="mt-2 rounded-xl bg-[#1E8A3C] px-6 py-3 text-sm font-black text-white"
        >
          Retour à l'accueil
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-black text-[#264129]">Devenir fournisseur</h1>
      <p className="mb-8 text-sm text-[#6F8070]">
        Remplissez vos informations et sélectionnez les produits que vous souhaitez proposer.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Infos boutique */}
        <section className="rounded-2xl border border-[#DDEBDD] bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-black uppercase tracking-wide text-[#1E8A3C]">Votre boutique</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-[#264129]">Nom de la boutique *</label>
              <input
                required
                minLength={2}
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Ex: Épicerie Al Baraka"
                className="w-full rounded-xl border border-[#DDEBDD] px-4 py-3 text-sm focus:border-[#1E8A3C] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-[#264129]">Téléphone *</label>
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="06XXXXXXXX"
                className="w-full rounded-xl border border-[#DDEBDD] px-4 py-3 text-sm focus:border-[#1E8A3C] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-[#264129]">Adresse *</label>
              <input
                required
                minLength={3}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Adresse complète"
                className="w-full rounded-xl border border-[#DDEBDD] px-4 py-3 text-sm focus:border-[#1E8A3C] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-[#264129]">Ville</label>
              <input
                value={ville}
                onChange={(e) => setVille(e.target.value)}
                placeholder="Ex: Fès"
                className="w-full rounded-xl border border-[#DDEBDD] px-4 py-3 text-sm focus:border-[#1E8A3C] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-[#264129]">Localisation *</label>
              <button
                type="button"
                onClick={() => setMapboxModalOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#1E8A3C] px-4 py-3 text-sm font-black text-[#1E8A3C] transition-colors hover:bg-[#F0FAF1]"
              >
                <Navigation className="h-4 w-4" />
                Me localiser
              </button>
              {latitude !== null && longitude !== null ? (
                <p className="mt-2 text-xs font-semibold text-[#1E8A3C]">
                  Position sélectionnée : {latitude.toFixed(6)}, {longitude.toFixed(6)}
                </p>
              ) : (
                <p className="mt-2 text-xs font-semibold text-red-500">
                  Localisation obligatoire pour créer votre zone fournisseur.
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-[#264129]">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez votre activité..."
                rows={3}
                className="w-full rounded-xl border border-[#DDEBDD] px-4 py-3 text-sm focus:border-[#1E8A3C] focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* Sélection produits */}
        <section className="rounded-2xl border border-[#DDEBDD] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wide text-[#1E8A3C]">Produits proposés</h2>
            <span className={`text-xs font-bold ${selectedIds.size === 0 ? "text-red-500" : "text-[#1E8A3C]"}`}>
              {selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}
            </span>
          </div>

          {loadingProduits ? (
            <p className="text-sm text-[#6F8070]">Chargement du catalogue...</p>
          ) : produits.length === 0 ? (
            <p className="text-sm text-[#6F8070]">Aucun produit disponible.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {produits.map((p) => {
                const selected = selectedIds.has(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProduit(p.id)}
                    className={`rounded-xl border-2 px-3 py-2.5 text-left text-xs font-bold transition-all ${
                      selected
                        ? "border-[#1E8A3C] bg-[#EAF8EC] text-[#1E8A3C]"
                        : "border-[#DDEBDD] bg-white text-[#264129] hover:border-[#1E8A3C]/40"
                    }`}
                  >
                    <span className="block truncate">{p.nom_fr}</span>
                    <span className="mt-0.5 block font-medium text-[#6F8070]">{p.unite}</span>
                  </button>
                )
              })}
            </div>
          )}
          {selectedIds.size === 0 && (
            <p className="mt-3 text-xs text-red-500">Sélectionnez au moins un produit pour continuer.</p>
          )}
        </section>

        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading || selectedIds.size === 0 || latitude === null || longitude === null}
          className="w-full rounded-xl bg-[#1E8A3C] px-6 py-4 text-sm font-black text-white transition-opacity disabled:opacity-50"
        >
          {loading ? "Envoi en cours..." : "Envoyer ma demande"}
        </button>
      </form>
      <MapboxLocator
        isOpen={mapboxModalOpen}
        onClose={() => setMapboxModalOpen(false)}
        confirmSelection
        onAddressDetected={(detectedAddress, detectedCity, coordinates) => {
          setAddress(detectedAddress)
          setVille(detectedCity || ville)
          if (coordinates) {
            setLatitude(coordinates.latitude)
            setLongitude(coordinates.longitude)
          }
        }}
      />
    </div>
  )
}
