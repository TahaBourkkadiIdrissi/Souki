"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronLeft, MapPinned, Pencil, Plus, Power, RefreshCw, X } from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { API_BASE_URL } from "@/lib/api"

type Zone = {
  id: number
  nom_ville: string
  lat_centre: number
  lng_centre: number
  rayon_km: number
  fournisseur_id: number
  fournisseur_nom: string | null
  fournisseur_statut: string | null
  actif: boolean
}

type Supplier = {
  user_id: number
  shop_name: string
  statut: string
  ville: string | null
}

type ZoneForm = {
  nom_ville: string
  lat_centre: string
  lng_centre: string
  rayon_km: string
  fournisseur_id: string
  actif: boolean
}

const EMPTY_FORM: ZoneForm = {
  nom_ville: "",
  lat_centre: "",
  lng_centre: "",
  rayon_km: "25",
  fournisseur_id: "",
  actif: true,
}

export default function AdminZonesPage() {
  const { token } = useAuth()
  const [zones, setZones] = useState<Zone[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [form, setForm] = useState<ZoneForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const approvedSuppliers = useMemo(
    () => suppliers.filter((supplier) => supplier.statut === "APPROVED"),
    [suppliers],
  )

  const loadData = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const [zonesResponse, suppliersResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/admin/zones`, { headers, cache: "no-store" }),
        fetch(`${API_BASE_URL}/api/admin/suppliers?statut=APPROVED&page_size=100`, {
          headers,
          cache: "no-store",
        }),
      ])
      if (!zonesResponse.ok || !suppliersResponse.ok) {
        throw new Error("Impossible de charger les zones et fournisseurs.")
      }
      const suppliersPage = await suppliersResponse.json()
      setZones(await zonesResponse.json())
      setSuppliers(suppliersPage.items ?? [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erreur de chargement.")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const resetForm = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const editZone = (zone: Zone) => {
    setEditingId(zone.id)
    setForm({
      nom_ville: zone.nom_ville,
      lat_centre: String(zone.lat_centre),
      lng_centre: String(zone.lng_centre),
      rayon_km: String(zone.rayon_km),
      fournisseur_id: String(zone.fournisseur_id),
      actif: zone.actif,
    })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const submitZone = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/zones${editingId ? `/${editingId}` : ""}`,
        {
          method: editingId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            nom_ville: form.nom_ville.trim(),
            lat_centre: Number(form.lat_centre),
            lng_centre: Number(form.lng_centre),
            rayon_km: Number(form.rayon_km),
            fournisseur_id: Number(form.fournisseur_id),
            actif: form.actif,
          }),
        },
      )
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.detail ?? "Enregistrement impossible.")
      }
      resetForm()
      await loadData()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Enregistrement impossible.")
    } finally {
      setSaving(false)
    }
  }

  const deactivateZone = async (zoneId: number) => {
    if (!token) return
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/zones/${zoneId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error("Désactivation impossible.")
      await loadData()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Désactivation impossible.")
    }
  }

  return (
    <main className="min-h-screen bg-[#F5F5F0] px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center gap-3">
          <Link href="/admin" className="rounded-lg p-2 text-[#6F8070] hover:bg-white">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-black text-[#264129]">Zones fournisseurs</h1>
            <p className="text-sm text-[#6F8070]">Définissez le fournisseur responsable de chaque zone.</p>
          </div>
          <button onClick={() => void loadData()} className="rounded-xl border border-[#DDEBDD] bg-white p-2">
            <RefreshCw className="h-4 w-4 text-[#1E8A3C]" />
          </button>
        </header>

        {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

        <form onSubmit={submitZone} className="mb-6 rounded-2xl border border-[#DDEBDD] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-black text-[#264129]">
              <Plus className="h-4 w-4 text-[#1E8A3C]" />
              {editingId ? "Modifier la zone" : "Créer une zone"}
            </h2>
            {editingId && (
              <button type="button" onClick={resetForm} className="rounded-lg p-1 text-[#6F8070]">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <input required value={form.nom_ville} onChange={(e) => setForm({ ...form, nom_ville: e.target.value })} placeholder="Ville / nom de zone" className="rounded-xl border border-[#DDEBDD] px-3 py-2.5 text-sm outline-none focus:border-[#1E8A3C]" />
            <input required type="number" step="any" min="-90" max="90" value={form.lat_centre} onChange={(e) => setForm({ ...form, lat_centre: e.target.value })} placeholder="Latitude du centre" className="rounded-xl border border-[#DDEBDD] px-3 py-2.5 text-sm outline-none focus:border-[#1E8A3C]" />
            <input required type="number" step="any" min="-180" max="180" value={form.lng_centre} onChange={(e) => setForm({ ...form, lng_centre: e.target.value })} placeholder="Longitude du centre" className="rounded-xl border border-[#DDEBDD] px-3 py-2.5 text-sm outline-none focus:border-[#1E8A3C]" />
            <input required type="number" step="0.1" min="0.1" max="500" value={form.rayon_km} onChange={(e) => setForm({ ...form, rayon_km: e.target.value })} placeholder="Rayon (km)" className="rounded-xl border border-[#DDEBDD] px-3 py-2.5 text-sm outline-none focus:border-[#1E8A3C]" />
            <select required value={form.fournisseur_id} onChange={(e) => setForm({ ...form, fournisseur_id: e.target.value })} className="rounded-xl border border-[#DDEBDD] px-3 py-2.5 text-sm outline-none focus:border-[#1E8A3C]">
              <option value="">Choisir un fournisseur approuvé</option>
              {approvedSuppliers.map((supplier) => (
                <option key={supplier.user_id} value={supplier.user_id}>
                  {supplier.shop_name}{supplier.ville ? ` — ${supplier.ville}` : ""}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 rounded-xl border border-[#DDEBDD] px-3 py-2.5 text-sm font-bold text-[#264129]">
              <input type="checkbox" checked={form.actif} onChange={(e) => setForm({ ...form, actif: e.target.checked })} />
              Zone active
            </label>
          </div>

          <button disabled={saving} className="mt-4 rounded-xl bg-[#1E8A3C] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">
            {saving ? "Enregistrement..." : editingId ? "Enregistrer les modifications" : "Créer et rattacher"}
          </button>
        </form>

        {loading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-[#DDEBDD]" />
        ) : zones.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#DDEBDD] bg-white py-14 text-center">
            <MapPinned className="mx-auto mb-2 h-9 w-9 text-[#A9B8AA]" />
            <p className="font-bold text-[#6F8070]">Aucune zone configurée.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {zones.map((zone) => (
              <article key={zone.id} className="rounded-2xl border border-[#DDEBDD] bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-black capitalize text-[#264129]">{zone.nom_ville}</h2>
                    <p className="text-xs text-[#6F8070]">{zone.lat_centre}, {zone.lng_centre} · rayon {zone.rayon_km} km</p>
                    <p className="mt-2 text-sm font-bold text-[#1E8A3C]">{zone.fournisseur_nom ?? `Fournisseur #${zone.fournisseur_id}`}</p>
                  </div>
                  <span className={`rounded-lg px-2 py-1 text-xs font-bold ${zone.actif ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    {zone.actif ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="mt-3 flex gap-2 border-t border-[#DDEBDD] pt-3">
                  <button onClick={() => editZone(zone)} className="inline-flex items-center gap-1 rounded-lg bg-[#EAF8EC] px-3 py-1.5 text-xs font-bold text-[#1E8A3C]">
                    <Pencil className="h-3.5 w-3.5" /> Modifier
                  </button>
                  {zone.actif && (
                    <button onClick={() => void deactivateZone(zone.id)} className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
                      <Power className="h-3.5 w-3.5" /> Désactiver
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
