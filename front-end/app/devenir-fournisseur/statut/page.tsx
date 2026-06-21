"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, CheckCircle2, Clock } from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { API_BASE_URL } from "@/lib/api"

interface SupplierProfile {
  statut: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED"
  shop_name: string
  rejected_reason?: string | null
  created_at?: string | null
}

export default function StatutFournisseurPage() {
  const { user, token, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<SupplierProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && user?.roles.includes("FOURNISSEUR")) {
      router.replace("/supplier")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (authLoading || !token) return
    const fetch_ = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/supplier/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.status === 404) {
          router.replace("/devenir-fournisseur")
          return
        }
        if (!res.ok) throw new Error("Erreur lors de la récupération du statut")
        const data: SupplierProfile = await res.json()
        setProfile(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Une erreur est survenue.")
      } finally {
        setLoading(false)
      }
    }
    void fetch_()
  }, [authLoading, token, router])

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-[#6F8070]">Chargement...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm text-red-500">{error}</p>
        <Link href="/" className="mt-4 block text-sm font-bold text-[#1E8A3C]">
          Retour à l'accueil
        </Link>
      </div>
    )
  }

  if (!profile) return null

  const isPending = profile.statut === "PENDING"
  const isRejected = profile.statut === "REJECTED"

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="rounded-3xl border border-[#DDEBDD] bg-white p-8 shadow-sm">
        {isPending && (
          <>
            <Clock className="mx-auto mb-4 h-12 w-12 text-amber-500" />
            <h1 className="text-2xl font-black text-[#264129]">Demande en attente</h1>
            <p className="mt-3 text-sm text-[#6F8070]">
              Votre demande pour <strong>{profile.shop_name}</strong> est en cours d'examen.
              Notre équipe vous contactera sous 48h.
            </p>
          </>
        )}

        {isRejected && (
          <>
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
            <h1 className="text-2xl font-black text-[#264129]">Demande refusée</h1>
            <p className="mt-3 text-sm text-[#6F8070]">
              Votre demande pour <strong>{profile.shop_name}</strong> n'a pas été acceptée.
            </p>
            {profile.rejected_reason && (
              <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-left text-sm text-red-700">
                <p className="font-bold">Motif du refus :</p>
                <p className="mt-1">{profile.rejected_reason}</p>
              </div>
            )}
            <p className="mt-4 text-sm text-[#6F8070]">
              Vous pouvez soumettre une nouvelle demande en corrigeant les points mentionnés.
            </p>
          </>
        )}

        {profile.statut === "APPROVED" && (
          <>
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-[#1E8A3C]" />
            <h1 className="text-2xl font-black text-[#264129]">Demande approuvée</h1>
            <p className="mt-3 text-sm text-[#6F8070]">Votre espace fournisseur est actif.</p>
          </>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {isRejected && (
            <Link
              href="/devenir-fournisseur"
              className="rounded-xl bg-[#1E8A3C] px-6 py-3 text-sm font-black text-white"
            >
              Nouvelle demande
            </Link>
          )}
          {profile.statut === "APPROVED" && (
            <Link
              href="/supplier"
              className="rounded-xl bg-[#1E8A3C] px-6 py-3 text-sm font-black text-white"
            >
              Accéder à mon espace
            </Link>
          )}
          <Link href="/" className="text-sm font-bold text-[#6F8070]">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  )
}
