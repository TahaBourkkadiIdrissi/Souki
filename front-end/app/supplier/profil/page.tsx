"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  Building2,
  Camera,
  Check,
  Home,
  Leaf,
  Link2,
  Loader2,
  LogOut,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  Store,
} from "lucide-react"

import { SupplierPageHeader, SupplierStatusBadge } from "@/components/souki/supplier-shell"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
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
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoBase64, setLogoBase64] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    shop_name: "",
    description: "",
    phone: "",
    address: "",
    ville: "",
  })

  useEffect(() => {
    if (!token) return
    const fetchProfile = async () => {
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
    void fetchProfile()
  }, [token])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
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
          ...(logoBase64 ? { logo_url: logoBase64 } : {}),
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.detail ?? `Erreur ${res.status}`)
      }
      const updated: SupplierProfile = await res.json()
      setProfile(updated)
      setLogoPreview(null)
      setLogoBase64(null)
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
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((previous) => ({ ...previous, [key]: event.target.value })),
  })

  const handleLogoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      setLogoPreview(base64)
      setLogoBase64(base64)
      setUploadingLogo(false)
    }
    reader.onerror = () => {
      setError("Impossible de lire l'image sélectionnée.")
      setUploadingLogo(false)
    }
    reader.readAsDataURL(file)
    // Reset value so the same file can be re-selected
    event.target.value = ""
  }

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
    <main className="souki-portal-reveal mx-auto w-full max-w-6xl space-y-5 px-4 py-5 sm:space-y-8 sm:px-6 sm:py-8 xl:px-10 xl:py-10">
      <SupplierPageHeader
        eyebrow="Identité fournisseur"
        title="Ma boutique"
        description="Gardez vos informations commerciales fiables et faciles à identifier dans l’écosystème Souki."
      />

      {loading ? (
        <div className="grid items-start gap-6 lg:grid-cols-[320px_1fr]">
          <Skeleton className="h-80 rounded-3xl" />
          <Skeleton className="h-[34rem] rounded-3xl" />
        </div>
      ) : profile ? (
        <form onSubmit={handleSubmit}>
          <div className="grid items-start gap-6 lg:grid-cols-[320px_1fr]">
            <aside className="space-y-4">
              <Card className="gap-0 overflow-hidden rounded-3xl border-[#DDEBDD] bg-background py-0 shadow-sm dark:border-border dark:bg-card">
                <div className="relative h-24 overflow-hidden bg-[#173F27]">
                  <div className="h-full bg-[radial-gradient(circle_at_85%_10%,rgba(76,184,74,0.4),transparent_42%)]" />
                  <div className="pointer-events-none absolute -left-8 -top-10 h-28 w-28 rounded-full bg-[#F5C400]/12 blur-2xl" />
                  <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #FFFFFF 1px, transparent 0)", backgroundSize: "16px 16px" }} />
                </div>
                <CardContent className="-mt-10 p-5 pt-0">
                  <div className="group relative h-20 w-20">
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-background bg-primary text-2xl font-black text-primary-foreground shadow-md dark:border-card">
                      {uploadingLogo ? (
                        <Loader2 className="h-8 w-8 animate-spin text-primary-foreground/70" />
                      ) : logoPreview ? (
                        <img src={logoPreview} alt="Aperçu logo" className="h-full w-full object-cover" />
                      ) : profile.logo_url ? (
                        <img src={profile.logo_url} alt={`Logo ${profile.shop_name}`} className="h-full w-full object-cover" />
                      ) : (
                        profile.shop_name?.charAt(0).toUpperCase() || <Store className="h-8 w-8" />
                      )}
                    </div>
                    {/* Hover overlay */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-2xl bg-black/0 transition-all duration-200 group-hover:bg-black/40"
                      aria-label="Changer le logo"
                    >
                      <Camera className="h-6 w-6 text-white opacity-0 drop-shadow-md transition-all duration-200 group-hover:scale-110 group-hover:opacity-100" />
                    </button>
                    {/* Camera badge – always visible */}
                    <span
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-background bg-primary text-white shadow-lg transition-transform duration-200 hover:scale-110 dark:border-card"
                      aria-label="Changer le logo"
                    >
                      <Camera className="h-3.5 w-3.5" />
                    </span>
                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoSelect}
                      className="hidden"
                      aria-hidden="true"
                    />
                  </div>
                  <h2 className="mt-4 text-xl font-black text-[#264129] dark:text-card-foreground [font-family:var(--font-poppins)]">
                    {profile.shop_name}
                  </h2>
                  {profile.shop_slug && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Link2 className="h-3.5 w-3.5" />@{profile.shop_slug}
                    </p>
                  )}
                  <div className="mt-4">
                    <SupplierStatusBadge status={profile.statut} />
                  </div>

                  <Separator className="my-5 bg-[#DDEBDD] dark:bg-border" />

                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3">
                      <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-[#6F8070] dark:text-muted-foreground">
                        {profile.phone || "Téléphone non renseigné"}
                      </span>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-[#6F8070] dark:text-muted-foreground">
                        {[profile.address, profile.ville].filter(Boolean).join(", ") || "Adresse non renseignée"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="gap-0 rounded-2xl border-[#DDEBDD] bg-[#F0FAF1] py-0 dark:border-border dark:bg-card">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background text-primary shadow-sm dark:bg-muted">
                      <ShieldCheck className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-black text-[#264129] dark:text-card-foreground">Compte protégé</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Votre accès reste soumis aux permissions fournisseur Souki.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </aside>

            <section className="space-y-4">
              {saved && (
                <Alert className="rounded-2xl border-[#BFE2C4] bg-[#EAF8EC] text-[#176B2E] dark:border-primary/30 dark:bg-primary/10 dark:text-green-300">
                  <Check />
                  <AlertTitle>Modifications enregistrées</AlertTitle>
                  <AlertDescription className="text-inherit/80">
                    Les informations de votre boutique ont bien été mises à jour.
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
                  <AlertCircle />
                  <AlertTitle>Enregistrement impossible</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Card className="gap-0 rounded-3xl border-[#DDEBDD] bg-background py-0 shadow-sm dark:border-border dark:bg-card">
                <CardHeader className="border-b border-[#DDEBDD] p-5 sm:p-6 dark:border-border">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF8EC] text-primary dark:bg-primary/10">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <div>
                      <CardTitle className="text-lg font-black text-[#264129] dark:text-card-foreground">
                        Informations commerciales
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Les champs actuellement pris en charge par votre profil fournisseur.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5 p-5 sm:p-6">
                  <div className="space-y-2">
                    <Label htmlFor="shop_name" className="font-bold text-[#264129] dark:text-foreground">
                      Nom de la boutique
                      <Badge variant="secondary" className="rounded-full text-[10px]">Requis</Badge>
                    </Label>
                    <Input
                      id="shop_name"
                      required
                      minLength={2}
                      {...field("shop_name")}
                      className="h-12 rounded-xl border-[#DDEBDD] bg-background px-4 dark:border-border"
                    />
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="font-bold text-[#264129] dark:text-foreground">
                        Téléphone
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="phone"
                          {...field("phone")}
                          placeholder="06XXXXXXXX"
                          className="h-12 rounded-xl border-[#DDEBDD] bg-background pl-10 dark:border-border"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ville" className="font-bold text-[#264129] dark:text-foreground">
                        Ville
                      </Label>
                      <div className="relative">
                        <MapPin className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="ville"
                          {...field("ville")}
                          placeholder="Fès"
                          className="h-12 rounded-xl border-[#DDEBDD] bg-background pl-10 dark:border-border"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address" className="font-bold text-[#264129] dark:text-foreground">
                      Adresse
                    </Label>
                    <Input
                      id="address"
                      {...field("address")}
                      placeholder="Adresse complète de la boutique"
                      className="h-12 rounded-xl border-[#DDEBDD] bg-background px-4 dark:border-border"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="font-bold text-[#264129] dark:text-foreground">
                      Description
                    </Label>
                    <Textarea
                      id="description"
                      {...field("description")}
                      rows={5}
                      placeholder="Présentez votre activité et vos produits…"
                      className="min-h-32 resize-y rounded-xl border-[#DDEBDD] bg-background px-4 py-3 dark:border-border"
                    />
                    <p className="text-xs leading-5 text-muted-foreground">
                      Une description claire aide l’équipe Souki à identifier rapidement votre activité.
                    </p>
                  </div>

                  <Separator className="bg-[#DDEBDD] dark:bg-border" />

                  {/* Retour vers l'espace client. Sur grand ecran ces liens vivent
                      dans la barre laterale ; sur mobile, la barre d'onglets est
                      reservee au metier fournisseur, donc ils atterrissent ici. */}
                  <div className="lg:hidden">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                      Espace client
                    </p>
                    <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                      {[
                        { href: "/", label: "Accueil", icon: Home },
                        { href: "/catalogue", label: "Catalogue", icon: Leaf },
                      ].map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="flex min-h-12 items-center gap-2.5 rounded-xl border border-[#DDEBDD] bg-background px-3.5 text-sm font-bold text-[#607061] transition active:scale-[0.98] dark:border-border dark:bg-card dark:text-muted-foreground"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F0FAF1] text-primary dark:bg-muted">
                            <item.icon className="h-4 w-4" />
                          </span>
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="h-11 rounded-xl border-red-200 text-destructive hover:bg-red-50 hover:text-destructive dark:border-red-900 dark:hover:bg-red-950/30"
                    >
                      {loggingOut ? <Spinner /> : <LogOut />}
                      {loggingOut ? "Déconnexion…" : "Se déconnecter"}
                    </Button>
                    <Button type="submit" disabled={saving} className="h-11 rounded-xl px-6 font-black">
                      {saving ? <Spinner /> : saved ? <Check /> : <Save />}
                      {saving ? "Enregistrement…" : saved ? "Enregistré" : "Enregistrer"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>
          </div>
        </form>
      ) : (
        <Alert className="rounded-2xl border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <AlertCircle />
          <AlertTitle>Profil non disponible</AlertTitle>
          <AlertDescription>Les informations de votre boutique n’ont pas pu être chargées.</AlertDescription>
        </Alert>
      )}
    </main>
  )
}
