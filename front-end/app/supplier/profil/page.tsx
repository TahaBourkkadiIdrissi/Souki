"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check, LogOut, Store } from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { API_BASE_URL } from "@/lib/api"

interface SupplierProfile {
  user_id: number
  shop_name: string
  shop_slug: string | null
  description: string | null
  phone: string | null
  address: string | null
  ville: string | null
  statut: string
  logo_url: string | null
}

export default function SupplierProfilPage() {
  const { token, logout } = useAuth()
  const [profile, setProfile] = useState<SupplierProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    shop_name: "",
    description: "",
    phone: "",
    address: "",
    ville: "",
  })

  useEffect(() => {
    if (!token) return
    const fetch_ = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/supplier/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data: SupplierProfile = await res.json()
          setProfile(data)
          setForm({
            shop_name: data.shop_name ?? "",
            description: data.description ?? "",
            phone: data.phone ?? "",
            address: data.address ?? "",
            ville: data.ville ?? "",
          })
        }
      } finally {
        setLoading(false)
      }
    }
    void fetch_()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`${API_BASE_URL}/api/supplier/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          shop_name: form.shop_name || undefined,
          description: form.description || undefined,
          phone: form.phone || undefined,
          address: form.address || undefined,
          ville: form.ville || undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.detail ?? `Erreur ${res.status}`)
      }
      const updated: SupplierProfile = await res.json()
      setProfile(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la sauvegarde")
    } finally {
      setSaving(false)
    }
  }

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  })

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      window.location.assign("/login?logged_out=1")
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/supplier" className="text-[#6F8070]">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-black text-[#264129]">Mon profil</h1>
          <p className="text-xs text-[#6F8070]">Informations de votre boutique</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-[#DDEBDD]" />
          ))}
        </div>
      ) : profile ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-[#DDEBDD] bg-white p-4 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EAF8EC]">
              <Store className="h-6 w-6 text-[#1E8A3C]" />
            </div>
            <div>
              <p className="font-black text-[#264129]">{profile.shop_name}</p>
              {profile.shop_slug && (
                <p className="text-xs text-[#6F8070]">@{profile.shop_slug}</p>
              )}
            </div>
            <span
              className={`ml-auto rounded-lg px-2 py-0.5 text-xs font-bold ${
                profile.statut === "APPROVED"
                  ? "bg-green-100 text-green-700"
                  : profile.statut === "SUSPENDED"
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700"
              }`}
            >
              {profile.statut}
            </span>
          </div>

          <section className="rounded-2xl border border-[#DDEBDD] bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xs font-black uppercase tracking-wide text-[#1E8A3C]">Modifier</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-[#264129]">Nom de la boutique</label>
                <input
                  required
                  minLength={2}
                  {...field("shop_name")}
                  className="w-full rounded-xl border border-[#DDEBDD] px-4 py-3 text-sm focus:border-[#1E8A3C] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-[#264129]">Téléphone</label>
                <input
                  {...field("phone")}
                  placeholder="06XXXXXXXX"
                  className="w-full rounded-xl border border-[#DDEBDD] px-4 py-3 text-sm focus:border-[#1E8A3C] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-[#264129]">Adresse</label>
                <input
                  {...field("address")}
                  className="w-full rounded-xl border border-[#DDEBDD] px-4 py-3 text-sm focus:border-[#1E8A3C] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-[#264129]">Ville</label>
                <input
                  {...field("ville")}
                  className="w-full rounded-xl border border-[#DDEBDD] px-4 py-3 text-sm focus:border-[#1E8A3C] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-[#264129]">Description</label>
                <textarea
                  {...field("description")}
                  rows={3}
                  className="w-full rounded-xl border border-[#DDEBDD] px-4 py-3 text-sm focus:border-[#1E8A3C] focus:outline-none"
                />
              </div>
            </div>
          </section>

          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E8A3C] px-6 py-4 text-sm font-black text-white disabled:opacity-50"
          >
            {saved ? (
              <>
                <Check className="h-4 w-4" /> Enregistré
              </>
            ) : saving ? (
              "Enregistrement..."
            ) : (
              "Enregistrer"
            )}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm font-black text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            {loggingOut ? "Déconnexion..." : "Se déconnecter"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-[#6F8070]">Profil non disponible.</p>
      )}
    </div>
  )
}
