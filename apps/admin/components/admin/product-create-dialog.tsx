"use client"

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { ChevronDown, ImagePlus, Plus, X } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import {
  createProduit,
  uploadProduitImage,
  type ProductCreateDTO,
  type ProduitNiveau,
  type ProduitPricingDTO,
  type ProduitVolatilite,
} from "@/lib/api"
import { cn } from "@/lib/utils"

// Formulaire de creation produit : l'essentiel d'abord (photo, noms, unite, prix),
// les reglages de pricing repliables avec leurs valeurs par defaut.
// Le brouillon survit a la fermeture ; il n'est vide qu'apres une creation reussie.

interface Values {
  nom_fr: string
  nom_darija: string
  unite: string
  description: string
  prix_gros_saisi: string
  prix_vente_manuel: string
  niveau: ProduitNiveau
  volatilite: ProduitVolatilite
  marge_cible: string
  coussin_securite: string
  prix_khddar_reel: string
  prix_kg: string
}

const emptyValues: Values = {
  nom_fr: "",
  nom_darija: "",
  unite: "kg",
  description: "",
  prix_gros_saisi: "",
  prix_vente_manuel: "",
  niveau: 2,
  volatilite: "STABLE",
  marge_cible: "25",
  coussin_securite: "10",
  prix_khddar_reel: "",
  prix_kg: "",
}

// Unites reconnues par le catalogue client (formatQuantity) ; "Autre" reste libre.
const UNITS = [
  { value: "kg", label: "Kilo" },
  { value: "piece", label: "Pièce" },
  { value: "lot", label: "Lot" },
  { value: "250g", label: "250 g" },
]
const NIVEAUX: { value: ProduitNiveau; label: string }[] = [
  { value: 1, label: "N1 Appel" },
  { value: 2, label: "N2 Volume" },
  { value: 3, label: "N3 Profit" },
]
const VOLATILITES: ProduitVolatilite[] = ["STABLE", "VARIABLE", "SAISONNIER"]
const MAX_PHOTO_BYTES = 5 * 1024 * 1024

const inputClass =
  "min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none transition-colors focus:border-[#1E8A3C] focus:ring-2 focus:ring-[#1E8A3C]/15"
const labelClass = "grid gap-1.5 text-sm font-semibold text-gray-700"

function parseAmount(raw: string): number | null | "invalid" {
  const value = raw.trim().replace(",", ".")
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : "invalid"
}

// Meme regle que ProduitPricingService._calculer_prix_affiche (arrondi au dixieme superieur).
function previewPrice(gros: number | null, manuel: number | null, marge: number, coussin: number) {
  const raw = manuel ?? (gros === null ? null : gros * (1 + coussin) * (1 + marge))
  return raw === null ? null : Math.ceil(raw * 10 - 1e-9) / 10
}

export function ProductCreateDialog({
  open,
  onOpenChange,
  token,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  token: string | null
  onCreated: (produit: ProduitPricingDTO, message: string) => void
}) {
  const [values, setValues] = useState<Values>(emptyValues)
  const [photo, setPhoto] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const photoPreview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo])
  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
  }, [photoPreview])

  const set = <Key extends keyof Values>(key: Key, value: Values[Key]) =>
    setValues((current) => ({ ...current, [key]: value }))

  const gros = parseAmount(values.prix_gros_saisi)
  const manuel = parseAmount(values.prix_vente_manuel)
  const marge = parseAmount(values.marge_cible)
  const coussin = parseAmount(values.coussin_securite)
  const price = useMemo(
    () =>
      previewPrice(
        typeof gros === "number" ? gros : null,
        typeof manuel === "number" ? manuel : null,
        typeof marge === "number" ? marge / 100 : 0,
        typeof coussin === "number" ? coussin / 100 : 0
      ),
    [gros, manuel, marge, coussin]
  )
  const customUnit = !UNITS.some((unit) => unit.value === values.unite)
  const missing = {
    nom_fr: !values.nom_fr.trim(),
    nom_darija: !values.nom_darija.trim(),
    unite: !values.unite.trim(),
    prix: price === null,
  }

  function choosePhoto(file: File | null) {
    if (file && !/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setError("Photo : formats acceptés PNG, JPEG ou WebP.")
      return
    }
    if (file && file.size > MAX_PHOTO_BYTES) {
      setError("Photo : 5 Mo maximum.")
      return
    }
    setError("")
    setPhoto(file)
  }

  function validate(): ProductCreateDTO | string {
    if (missing.nom_fr || missing.nom_darija || missing.unite) return "Renseignez le nom français, le nom darija et l'unité."
    if (gros === "invalid") return "Prix de gros invalide."
    if (manuel === "invalid") return "Prix de vente invalide."
    if (price === null) return "Indiquez un prix de gros ou un prix de vente : sans prix, le produit reste masqué du catalogue."
    if (marge === "invalid" || marge === null || marge > 100) return "Marge invalide : entre 0 et 100 %."
    if (coussin === "invalid" || coussin === null || coussin > 20) return "Coussin invalide : entre 0 et 20 %."
    const khddar = parseAmount(values.prix_khddar_reel)
    if (khddar === "invalid") return "Prix khddar invalide."
    const prixKg = parseAmount(values.prix_kg)
    if (prixKg === "invalid" || prixKg === 0) return "Prix de référence invalide."
    return {
      description: values.description.trim() || null,
      nom_fr: values.nom_fr.trim(),
      nom_darija: values.nom_darija.trim(),
      unite: values.unite.trim(),
      // Prix de reference historique : par defaut le prix affiche aux clients.
      prix_kg: prixKg ?? price,
      niveau: values.niveau,
      volatilite: values.volatilite,
      marge_cible: marge / 100,
      coussin_securite: coussin / 100,
      prix_gros_saisi: gros,
      prix_vente_manuel: manuel,
      prix_khddar_reel: khddar,
    }
  }

  async function create(addAnother: boolean) {
    if (!token || saving) return
    setTouched(true)
    const payload = validate()
    if (typeof payload === "string") {
      setError(payload)
      return
    }
    setSaving(true)
    setError("")
    try {
      let produit = await createProduit(token, payload)
      let message = `${produit.nom_fr} ajouté au catalogue.`
      if (photo) {
        try {
          produit = await uploadProduitImage(token, produit.id, photo)
        } catch (photoError) {
          message = `${produit.nom_fr} créé, mais la photo n'a pas été envoyée${photoError instanceof Error ? ` (${photoError.message})` : ""}. Ajoutez-la depuis le tableau.`
        }
      }
      onCreated(produit, message)
      setValues((current) => (addAnother ? { ...emptyValues, unite: current.unite, niveau: current.niveau } : emptyValues))
      setPhoto(null)
      setTouched(false)
      setShowAdvanced(false)
      if (addAnother) nameRef.current?.focus()
      else onOpenChange(false)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Impossible de créer le produit.")
    } finally {
      setSaving(false)
    }
  }

  const fieldError = (flag: boolean) => touched && flag && "border-red-300 focus:border-red-400 focus:ring-red-100"

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          nameRef.current?.focus()
        }}
        className="flex max-h-[min(92dvh,880px)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl"
      >
        <form
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            void create(false)
          }}
          className="flex min-h-0 flex-1 flex-col"
          noValidate
        >
          {/* En-tete fixe */}
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-6">
            <div>
              <DialogTitle className="text-lg font-bold text-gray-950">Nouveau produit</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-gray-500">
                Quatre champs suffisent : noms, unité et prix. Le reste a des valeurs par défaut.
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              aria-label="Fermer"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Corps defilant */}
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
            <section className="grid gap-4 sm:grid-cols-[132px_minmax(0,1fr)]">
              <div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  aria-label="Photo du produit"
                  onChange={(event) => {
                    choosePhoto(event.target.files?.[0] ?? null)
                    event.target.value = ""
                  }}
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    choosePhoto(event.dataTransfer.files?.[0] ?? null)
                  }}
                  className="group relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-500 transition-colors hover:border-[#1E8A3C]/50 hover:bg-[var(--adm-green-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A3C]/40 sm:w-[132px]"
                >
                  {photoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element -- apercu local (blob:)
                    <img src={photoPreview} alt="Aperçu de la photo" className="size-full object-cover" />
                  ) : (
                    <span className="flex flex-col items-center gap-1.5 px-2 text-center text-xs font-semibold">
                      <ImagePlus className="size-6 text-[#1E8A3C]" />
                      Ajouter une photo
                      <span className="font-normal text-gray-400">ou glisser-déposer</span>
                    </span>
                  )}
                </button>
                {photo && (
                  <button type="button" onClick={() => setPhoto(null)} className="mt-1.5 text-xs font-semibold text-gray-500 underline-offset-2 hover:underline">
                    Retirer la photo
                  </button>
                )}
              </div>

              <div className="grid content-start gap-4">
                <label className={labelClass}>
                  Nom français
                  <input
                    ref={nameRef}
                    value={values.nom_fr}
                    onChange={(event) => set("nom_fr", event.target.value)}
                    placeholder="Ex : Tomate ronde"
                    autoComplete="off"
                    className={cn(inputClass, fieldError(missing.nom_fr))}
                  />
                </label>
                <label className={labelClass}>
                  Nom darija
                  <input
                    value={values.nom_darija}
                    onChange={(event) => set("nom_darija", event.target.value)}
                    placeholder="Ex : maticha"
                    autoComplete="off"
                    className={cn(inputClass, fieldError(missing.nom_darija))}
                  />
                </label>
              </div>
            </section>

            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-semibold text-gray-700">Vendu au</legend>
              <div className="flex flex-wrap gap-2">
                {UNITS.map((unit) => (
                  <button
                    key={unit.value}
                    type="button"
                    aria-pressed={values.unite === unit.value}
                    onClick={() => set("unite", unit.value)}
                    className={cn(
                      "min-h-11 rounded-xl border px-4 text-sm font-semibold transition-colors",
                      values.unite === unit.value
                        ? "border-[#1E8A3C] bg-[var(--adm-green-soft)] text-[#1E8A3C]"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    {unit.label}
                  </button>
                ))}
                <input
                  value={customUnit ? values.unite : ""}
                  onChange={(event) => set("unite", event.target.value)}
                  placeholder="Autre unité"
                  aria-label="Autre unité"
                  className={cn(inputClass, "w-36", customUnit && "border-[#1E8A3C]", fieldError(missing.unite))}
                />
              </div>
            </fieldset>

            <section className="grid gap-4 rounded-2xl border border-gray-100 bg-gray-50/60 p-4 sm:grid-cols-2">
              <label className={labelClass}>
                Prix de gros (DH)
                <input
                  inputMode="decimal"
                  value={values.prix_gros_saisi}
                  onChange={(event) => set("prix_gros_saisi", event.target.value)}
                  placeholder="Ex : 6,50"
                  className={cn(inputClass, fieldError(missing.prix || gros === "invalid"))}
                />
              </label>
              <label className={labelClass}>
                Prix de vente (DH) <span className="-mt-1 text-xs font-normal text-gray-400">vide = calculé avec la marge</span>
                <input
                  inputMode="decimal"
                  value={values.prix_vente_manuel}
                  onChange={(event) => set("prix_vente_manuel", event.target.value)}
                  placeholder={price !== null && manuel === null ? price.toFixed(2) : "Ex : 9,90"}
                  className={cn(inputClass, fieldError(missing.prix || manuel === "invalid"))}
                />
              </label>
              <p
                className={cn(
                  "rounded-xl px-3 py-2.5 text-sm sm:col-span-2",
                  price === null ? "bg-amber-50 text-amber-700" : "bg-[var(--adm-green-soft)] text-[#14522A]"
                )}
                aria-live="polite"
              >
                {price === null ? (
                  "Saisissez au moins un prix pour que le produit apparaisse dans le catalogue."
                ) : (
                  <>
                    Prix affiché aux clients : <strong>{price.toFixed(2)} DH</strong>
                    {manuel === null && typeof marge === "number" && typeof coussin === "number" && (
                      <span className="text-[#14522A]/70"> (gros + {coussin} % coussin + {marge} % marge)</span>
                    )}
                  </>
                )}
              </p>
            </section>

            <label className={labelClass}>
              Description <span className="-mt-1 text-xs font-normal text-gray-400">facultatif</span>
              <textarea
                value={values.description}
                onChange={(event) => set("description", event.target.value)}
                maxLength={5000}
                rows={2}
                placeholder="Vide = description par défaut du catalogue"
                className={cn(inputClass, "min-h-[72px] py-2.5")}
              />
            </label>

            <div className="rounded-2xl border border-gray-200">
              <button
                type="button"
                aria-expanded={showAdvanced}
                onClick={() => setShowAdvanced((current) => !current)}
                className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left text-sm font-semibold text-gray-700"
              >
                <span>
                  Réglages de prix avancés
                  <span className="block text-xs font-normal text-gray-500">
                    {NIVEAUX.find((item) => item.value === values.niveau)?.label} · {values.volatilite} · marge {values.marge_cible || "?"} % · coussin {values.coussin_securite || "?"} %
                  </span>
                </span>
                <ChevronDown className={cn("size-4 shrink-0 transition-transform", showAdvanced && "rotate-180")} />
              </button>
              {showAdvanced && (
                <div className="grid gap-4 border-t border-gray-100 p-4 sm:grid-cols-2">
                  <label className={labelClass}>
                    Niveau
                    <select value={values.niveau} onChange={(event) => set("niveau", Number(event.target.value) as ProduitNiveau)} className={inputClass}>
                      {NIVEAUX.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className={labelClass}>
                    Volatilité
                    <select value={values.volatilite} onChange={(event) => set("volatilite", event.target.value as ProduitVolatilite)} className={inputClass}>
                      {VOLATILITES.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className={labelClass}>
                    Marge (%)
                    <input inputMode="decimal" value={values.marge_cible} onChange={(event) => set("marge_cible", event.target.value)} className={inputClass} />
                  </label>
                  <label className={labelClass}>
                    Coussin de sécurité (%)
                    <input inputMode="decimal" value={values.coussin_securite} onChange={(event) => set("coussin_securite", event.target.value)} className={inputClass} />
                  </label>
                  <label className={labelClass}>
                    Prix khddar réel (DH)
                    <input inputMode="decimal" value={values.prix_khddar_reel} onChange={(event) => set("prix_khddar_reel", event.target.value)} placeholder="Facultatif" className={inputClass} />
                  </label>
                  <label className={labelClass}>
                    Prix de référence (DH)
                    <input inputMode="decimal" value={values.prix_kg} onChange={(event) => set("prix_kg", event.target.value)} placeholder={price !== null ? `${price.toFixed(2)} (= prix affiché)` : "= prix affiché"} className={inputClass} />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Pied fixe */}
          <div className="border-t border-gray-100 bg-white px-5 py-3 sm:px-6">
            {error && (
              <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={saving}
                className="min-h-11 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void create(true)}
                disabled={saving}
                className="min-h-11 rounded-xl border border-[#1E8A3C]/30 px-4 text-sm font-semibold text-[#1E8A3C] hover:bg-[var(--adm-green-soft)] disabled:opacity-60"
              >
                Créer et en ajouter un autre
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1E8A3C] px-5 text-sm font-semibold text-white hover:bg-[#166d30] disabled:opacity-60"
              >
                {saving ? <Spinner className="size-4 text-white" /> : <Plus className="size-4" />}
                Créer le produit
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
