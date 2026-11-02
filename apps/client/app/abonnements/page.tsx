"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Banknote, CalendarClock, Check, Leaf, Loader2, Repeat, Scale, Truck, Wallet, X } from "lucide-react"
import { toast } from "sonner"

import { MesAbonnements } from "@/components/souki/mes-abonnements"
import { Navbar } from "@/components/souki/navbar"
import Image from "@/components/souki/optimized-image"
import { useAuth } from "@/hooks/useAuth"
import { ApiError, creerAbonnementPanier, getPaniersSouki, type FrequenceRecurrente, type PanierSoukiDTO } from "@/lib/api"
import { FREQUENCES_RECURRENTES, formatDh } from "@/lib/commandes-recurrentes"
import { cn } from "@/lib/utils"

const APERCU_PRODUITS = 5

/** Fenetre de souscription : rythme et paiement. Le contenu reste modifiable ensuite. */
function SubscribeSheet({ panier, onClose, onDone }: { panier: PanierSoukiDTO; onClose: () => void; onDone: () => void }) {
  const [frequence, setFrequence] = useState<FrequenceRecurrente>("HEBDOMADAIRE")
  const [paiement, setPaiement] = useState<"cod" | "wallet">("cod")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const submit = async () => {
    setSaving(true); setError("")
    try {
      await creerAbonnementPanier(panier.id, { frequence, mode_paiement: paiement })
      toast.success(`Abonnement à « ${panier.nom} » activé.`)
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue. Réessayez.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#122018]/50 backdrop-blur-[2px] animate-in fade-in-0 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="abonnement-titre"
        onClick={(event) => event.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-white p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] shadow-2xl animate-in slide-in-from-bottom-4 duration-300 sm:rounded-[28px]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-bold text-[#1E8A3C]">S&apos;abonner</p>
            <h2 id="abonnement-titre" className="mt-1 text-xl font-bold text-[#14301B]">{panier.nom}</h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Fermer" className="rounded-xl p-2 text-[#5F6F61] hover:bg-[#F3F7F3]"><X className="h-5 w-5" /></button>
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm font-bold text-[#14301B]">À quel rythme ?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {FREQUENCES_RECURRENTES.map((item) => (
              <label key={item.value} className={cn(
                "flex min-h-16 cursor-pointer flex-col justify-center rounded-2xl border-2 px-3 py-2 transition-colors",
                frequence === item.value ? "border-[#1E8A3C] bg-[#EAF8EC]" : "border-[#E7EFE8] hover:border-[#CDE8D0]",
              )}>
                <input type="radio" name="frequence" value={item.value} checked={frequence === item.value} onChange={() => setFrequence(item.value)} className="sr-only" />
                <span className="text-sm font-bold text-[#14301B]">{item.label}</span>
                <span className="text-xs text-[#5F6F61]">{item.detail}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <legend className="text-sm font-bold text-[#14301B]">Paiement</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {([["cod", "À la livraison", Banknote], ["wallet", "Wallet SOUKI", Wallet]] as const).map(([value, label, Icon]) => (
              <label key={value} className={cn(
                "flex min-h-12 cursor-pointer items-center gap-2 rounded-2xl border-2 px-3 transition-colors",
                paiement === value ? "border-[#1E8A3C] bg-[#EAF8EC]" : "border-[#E7EFE8] hover:border-[#CDE8D0]",
              )}>
                <input type="radio" name="paiement" value={value} checked={paiement === value} onChange={() => setPaiement(value)} className="sr-only" />
                <Icon className="h-4 w-4 text-[#1E8A3C]" aria-hidden="true" />
                <span className="text-sm font-bold text-[#14301B]">{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-5 rounded-2xl bg-[#FBFBF7] p-4 text-sm text-[#3D3D3D]">
          <p className="flex justify-between gap-3"><span>Aujourd&apos;hui, ce panier coûterait</span><strong className="tabular-nums">{formatDh(panier.total_estime)}</strong></p>
          <p className="mt-1 text-xs text-[#5F6F61]">
            Livraison comprise. Chaque commande est créée à 01h00 au prix du jour ; l&apos;écart avec ce montant s&apos;affiche dans « Mes abonnements ».
            Vous pourrez modifier le contenu, sauter une livraison ou arrêter jusqu&apos;à 01h00 la veille.
          </p>
        </div>

        {error && <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-600">{error}</p>}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving}
          className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#1E8A3C] px-5 text-base font-bold text-white transition-transform hover:bg-[#176B2E] active:scale-[0.98] disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Repeat className="h-5 w-5" />}
          Confirmer l&apos;abonnement
        </button>
      </div>
    </div>
  )
}

function PanierCard({ panier, onChoose }: { panier: PanierSoukiDTO; onChoose: () => void }) {
  const disponibles = panier.lignes.filter((ligne) => ligne.disponible)
  const reste = disponibles.length - APERCU_PRODUITS
  return (
    <article className="flex flex-col overflow-hidden rounded-[28px] border border-[#E7EFE8] bg-white shadow-[0_28px_60px_-46px_rgba(20,48,27,0.5)]">
      <div className="relative h-40 bg-gradient-to-br from-[#1B4332] via-[#1E8A3C] to-[#4CB84A]">
        {panier.image_url ? (
          <Image src={panier.image_url} alt="" fill sizes="(max-width: 768px) 100vw, 400px" className="object-cover" />
        ) : (
          <Leaf className="absolute right-6 top-6 h-16 w-16 text-white/25" aria-hidden="true" />
        )}
        <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1 text-[13px] font-bold text-[#14301B] shadow-sm">
          {disponibles.length} produit{disponibles.length > 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-xl font-bold text-[#14301B]">{panier.nom}</h3>
        {panier.description && <p className="mt-1.5 text-sm leading-relaxed text-[#5F6F61]">{panier.description}</p>}
        <ul className="mt-4 space-y-1.5 text-sm text-[#3D3D3D]">
          {disponibles.slice(0, APERCU_PRODUITS).map((ligne) => (
            <li key={ligne.product_id} className="flex justify-between gap-3">
              <span className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-[#4CB84A]" aria-hidden="true" />{ligne.nom_produit}</span>
              <span className="shrink-0 tabular-nums text-[#5F6F61]">{ligne.quantite} {ligne.unite}</span>
            </li>
          ))}
          {reste > 0 && <li className="text-[13px] font-semibold text-[#5F6F61]">et {reste} autre{reste > 1 ? "s" : ""}</li>}
        </ul>
        <div className="mt-auto pt-6">
          <p className="text-[13px] text-[#5F6F61]">Au prix du jour</p>
          <p className="flex items-baseline gap-2">
            <span className="text-3xl font-black tabular-nums text-[#14301B]">{formatDh(panier.total_estime)}</span>
            <span className="text-[13px] text-[#5F6F61]">par livraison</span>
          </p>
          <p className="text-xs text-[#5F6F61]">
            {panier.frais_livraison_estimes > 0 ? `dont ${formatDh(panier.frais_livraison_estimes)} de livraison` : "livraison offerte"}
          </p>
          <button
            type="button"
            onClick={onChoose}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#F07C00] px-5 font-bold text-white transition-transform hover:bg-[#D66B00] active:scale-[0.98]"
          >
            <Repeat className="h-4 w-4" aria-hidden="true" />
            S&apos;abonner à ce panier
          </button>
        </div>
      </div>
    </article>
  )
}

export default function AbonnementsPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const [paniers, setPaniers] = useState<PanierSoukiDTO[] | null>(null)
  const [error, setError] = useState("")
  const [choix, setChoix] = useState<PanierSoukiDTO | null>(null)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    getPaniersSouki(controller.signal)
      .then((rows) => { setPaniers(rows); setError("") })
      .catch(() => { if (!controller.signal.aborted) setError("Impossible de charger les paniers proposés. Réessayez dans un instant.") })
    return () => controller.abort()
  }, [])

  const choisir = (panier: PanierSoukiDTO) => {
    if (!isAuthenticated) {
      router.push("/login?redirect=/abonnements")
      return
    }
    setChoix(panier)
  }

  const termine = () => {
    setChoix(null)
    setRefresh((value) => value + 1)
    window.setTimeout(() => document.getElementById("mes-abonnements")?.scrollIntoView({ behavior: "smooth" }), 150)
  }

  return (
    <div className="min-h-screen bg-[#FBFBF7] pb-24 md:pb-0">
      <Navbar />

      <section className="relative overflow-hidden bg-gradient-to-b from-[#E2F2E6] to-[#FBFBF7] px-4 pb-10 pt-12 sm:pt-16">
        <div className="mx-auto max-w-3xl text-center animate-fade-in-up">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#DCEEDE] bg-white px-4 py-2 text-[13px] font-bold text-[#1E8A3C] shadow-sm">
            <Repeat className="h-4 w-4" aria-hidden="true" />
            Abonnements
          </p>
          <h1 className="mt-5 text-[clamp(2rem,5vw,3.25rem)] font-bold leading-[1.08] tracking-[-0.02em] text-[#14301B] text-balance">
            Vos courses reviennent toutes seules
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-[#5F6F61]">
            Choisissez un panier préparé par SOUKI ou répétez une de vos commandes. Livré au rythme choisi, au prix du jour, modifiable jusqu&apos;à 01h00 la veille.
          </p>
        </div>
      </section>

      <MesAbonnements key={refresh} />

      <section className="mx-auto max-w-6xl px-4 py-10" aria-labelledby="paniers-titre">
        <h2 id="paniers-titre" className="text-2xl font-bold text-[#14301B]">Paniers proposés</h2>
        <p className="mt-1 text-sm text-[#5F6F61]">Composés par l&apos;équipe SOUKI. Après l&apos;abonnement, vous ajustez le contenu à votre goût.</p>

        {error ? (
          <p role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-600">{error}</p>
        ) : paniers === null ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3" aria-label="Chargement">
            {[0, 1, 2].map((index) => <div key={index} className="souki-skeleton h-[28rem] rounded-[28px]" />)}
          </div>
        ) : paniers.length === 0 ? (
          <div className="mt-6 rounded-[28px] border border-[#E7EFE8] bg-white p-8 text-center">
            <p className="text-base font-semibold text-[#14301B]">Pas encore de panier proposé.</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-[#5F6F61]">
              Vous pouvez déjà recevoir automatiquement une commande que vous avez aimée : ouvrez votre historique et touchez « Répéter cette commande ».
            </p>
            <Link href={isAuthenticated ? "/historique" : "/login?redirect=/historique"} className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#1E8A3C] px-6 font-bold text-white hover:bg-[#176B2E]">
              Voir mes commandes
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {paniers.map((panier) => <PanierCard key={panier.id} panier={panier} onChoose={() => choisir(panier)} />)}
          </div>
        )}
      </section>

      <section className="bg-white px-4 py-12" aria-labelledby="regles-titre">
        <div className="mx-auto max-w-5xl">
          <h2 id="regles-titre" className="text-center text-2xl font-bold text-[#14301B]">Comment ça marche</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { icon: Scale, title: "Le prix du jour, rien d'autre", text: "Pas de prix figé, pas de remise ni de frais d'abonnement : chaque commande suit le prix du site, et l'écart s'affiche avant la livraison." },
              { icon: CalendarClock, title: "Vous gardez la main", text: "Modifiez le contenu, sautez une livraison, mettez en pause ou arrêtez jusqu'à 01h00 la veille." },
              { icon: Truck, title: "Mêmes règles qu'une commande", text: "Minimum 50 DH. Livraison 15 DH, offerte dès 300 DH. Paiement à la livraison ou par Wallet SOUKI." },
            ].map((item) => (
              <div key={item.title} className="rounded-3xl border border-[#E7EFE8] bg-[#FBFBF7] p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF8EC]"><item.icon className="h-5 w-5 text-[#1E8A3C]" aria-hidden="true" /></span>
                <h3 className="mt-4 font-bold text-[#14301B]">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#5F6F61]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {choix && <SubscribeSheet panier={choix} onClose={() => setChoix(null)} onDone={termine} />}
    </div>
  )
}
