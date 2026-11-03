"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, CalendarClock, Minus, Pause, Play, Plus, Repeat, SkipForward, Trash2, TrendingDown, TrendingUp } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/hooks/useAuth"
import {
  ApiError, arreterCommandeRecurrente, getCommandesRecurrentes, modifierCommandeRecurrente,
  modifierLignesCommandeRecurrente, pauseCommandeRecurrente, reprendreCommandeRecurrente, sauterCommandeRecurrente,
  type CommandeRecurrenteDTO, type FrequenceRecurrente,
} from "@/lib/api"
import { fetchCatalogueProducts, type CatalogueProduct } from "@/lib/catalogue"
import {
  FREQUENCES_RECURRENTES, STATUTS_RECURRENCE, dateIsoPlusJours, formatDateCourte, formatDh, formatVariation,
  frequenceLabel, typeRecurrenceLabel,
} from "@/lib/commandes-recurrentes"
import { cn } from "@/lib/utils"
import { useLocale } from "@/contexts/locale-context"

type Ligne = { product_id: number; nom: string; nomAr?: string | null; unite: string; quantite: number }

const errorMessage = (err: unknown) => err instanceof ApiError ? err.message : "Une erreur est survenue. Réessayez."

function CarteAbonnement({ item, onChange }: { item: CommandeRecurrenteDTO; onChange: (next: CommandeRecurrenteDTO) => void }) {
  const { t, dateLocale, unitLabel, productName } = useLocale()
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [catalogue, setCatalogue] = useState<CatalogueProduct[]>([])
  const [ajout, setAjout] = useState("")
  const [pauseDate, setPauseDate] = useState(dateIsoPlusJours(7))
  const [showPause, setShowPause] = useState(false)
  const [confirmStop, setConfirmStop] = useState(false)
  const disabled = busy || !item.modifiable

  const run = async (action: () => Promise<CommandeRecurrenteDTO>, success: string) => {
    setBusy(true)
    try {
      onChange(await action())
      toast.success(t(success))
      return true
    } catch (err) {
      toast.error(errorMessage(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  const startEdit = () => {
    setLignes(item.lignes.map((ligne) => ({ product_id: ligne.product_id, nom: ligne.nom_produit, nomAr: ligne.nom_ar, unite: ligne.unite, quantite: ligne.quantite })))
    setEditing(true)
    if (!catalogue.length) void fetchCatalogueProducts().then(setCatalogue).catch(() => setCatalogue([]))
  }

  const changeQuantite = (productId: number, delta: number) => setLignes((current) => current
    .map((ligne) => ligne.product_id === productId ? { ...ligne, quantite: Math.round((ligne.quantite + delta) * 100) / 100 } : ligne)
    .filter((ligne) => ligne.quantite > 0))

  const ajouterProduit = () => {
    const product = catalogue.find((entry) => String(entry.id) === ajout)
    if (!product) return
    setLignes((current) => current.some((ligne) => ligne.product_id === product.id)
      ? current.map((ligne) => ligne.product_id === product.id ? { ...ligne, quantite: ligne.quantite + 1 } : ligne)
      : [...current, { product_id: product.id, nom: product.name, nomAr: product.nameAr, unite: product.unit, quantite: 1 }])
    setAjout("")
  }

  const saveLignes = async () => {
    if (!lignes.length) {
      toast.error(t("Gardez au moins un produit, ou arrêtez l'abonnement."))
      return
    }
    const ok = await run(() => modifierLignesCommandeRecurrente(item.id, lignes.map(({ product_id, quantite }) => ({ product_id, quantite }))), "Liste mise à jour.")
    if (ok) setEditing(false)
  }

  const statut = STATUTS_RECURRENCE[item.statut]
  const derniere = item.dernieres_livraisons[0]

  return (
    <article className="overflow-hidden rounded-2xl border border-[#E6F0E7] bg-white shadow-[0_18px_55px_-36px_rgba(30,65,41,0.35)]">
      <div className="h-1.5 bg-gradient-to-r from-[#1E8A3C] via-[#4CB84A] to-[#F07C00]" />
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7B8B7D]">{t(typeRecurrenceLabel(item))}</p>
            <h3 className="mt-1 flex items-center gap-2 text-lg font-black text-[#264129]">
              <Repeat className="h-4 w-4 text-[#1E8A3C]" aria-hidden="true" /> {t(frequenceLabel(item.frequence))}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-[#264129]">
              <CalendarClock className="h-4 w-4 text-[#F07C00]" aria-hidden="true" />
              {item.statut === "EN_PAUSE" && item.pause_jusqu_au
                ? <>{t("En pause jusqu'au {date}", { date: formatDateCourte(item.pause_jusqu_au, dateLocale) })}</>
                : item.statut === "ACTIVE" ? <>{t("Prochaine livraison : {date}", { date: formatDateCourte(item.prochaine_livraison, dateLocale) })}</> : null}
            </p>
          </div>
          <span className={cn("rounded-full border px-3 py-1 text-xs font-bold", statut.className)}>{t(statut.label)}</span>
        </div>

        {item.statut === "SUSPENDUE" && (
          <p className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-600">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {t("Cet abonnement est suspendu{motif} Contactez SOUKI pour le réactiver.", { motif: derniere?.motif ? ` : ${t(derniere.motif)}.` : "." })}
          </p>
        )}

        {Math.abs(item.variation_prix) >= 0.01 && (
          <div className={cn("rounded-2xl border p-3 text-sm",
            item.variation_prix > 0 ? "border-[#F5D7B8] bg-[#FFF7EE] text-[#9A5C11]" : "border-[#BFE6C4] bg-[#EAF8EC] text-[#1E8A3C]")}>
            <p className="flex items-center gap-2 font-bold">
              {item.variation_prix > 0 ? <TrendingUp className="h-4 w-4" aria-hidden="true" /> : <TrendingDown className="h-4 w-4" aria-hidden="true" />}
              {t("Prix mis à jour : {variation} depuis votre dernière livraison", { variation: formatVariation(item.variation_prix) })}
            </p>
            <p className="mt-1 text-xs">
              {item.lignes.filter((ligne) => Math.abs(ligne.variation) >= 0.01)
                .map((ligne) => `${productName({ name: ligne.nom_produit, nameAr: ligne.nom_ar })} ${formatVariation(ligne.variation)}`).join(" · ")}
            </p>
          </div>
        )}

        {!editing ? (
          <ul className="space-y-2">
            {item.lignes.map((ligne) => (
              <li key={ligne.product_id} className={cn("flex items-center justify-between gap-3 rounded-2xl bg-[#F7FCF7] p-3 text-sm", !ligne.disponible && "opacity-60")}>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-[#264129]">{productName({ name: ligne.nom_produit, nameAr: ligne.nom_ar })}</span>
                  <span className="block text-xs text-[#6F8070]">
                    {ligne.quantite} {unitLabel(ligne.unite)} × <bdi dir="ltr">{formatDh(ligne.prix_unitaire)}</bdi>{!ligne.disponible && t(" · indisponible aujourd'hui")}
                  </span>
                </span>
                <span className="shrink-0 font-bold text-[#F07C00]">{formatDh(ligne.sous_total)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-2">
            {lignes.map((ligne) => (
              <div key={ligne.product_id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#E6F0E7] p-3 text-sm">
                <span className="min-w-0 truncate font-semibold text-[#264129]">{productName({ name: ligne.nom, nameAr: ligne.nomAr })}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <button type="button" aria-label={t("Retirer 0,5 {unite}", { unite: unitLabel(ligne.unite) })} onClick={() => changeQuantite(ligne.product_id, -0.5)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#CFE6D2] text-[#176B2E]"><Minus className="h-4 w-4" /></button>
                  <span className="w-16 text-center font-bold text-[#264129]">{ligne.quantite} {unitLabel(ligne.unite)}</span>
                  <button type="button" aria-label={t("Ajouter 0,5 {unite}", { unite: unitLabel(ligne.unite) })} onClick={() => changeQuantite(ligne.product_id, 0.5)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#CFE6D2] text-[#176B2E]"><Plus className="h-4 w-4" /></button>
                  <button type="button" aria-label={t("Retirer {name}", { name: productName({ name: ligne.nom, nameAr: ligne.nomAr }) })} onClick={() => changeQuantite(ligne.product_id, -ligne.quantite)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-red-500"><Trash2 className="h-4 w-4" /></button>
                </span>
              </div>
            ))}
            <div className="flex gap-2">
              <select value={ajout} onChange={(event) => setAjout(event.target.value)} aria-label={t("Ajouter un produit")}
                className="min-h-11 flex-1 rounded-2xl border border-[#CFE6D2] bg-white px-3 text-sm text-[#264129]">
                <option value="">{t("Ajouter un produit…")}</option>
                {catalogue.map((product) => <option key={product.id} value={product.id}>{product.name} — {formatDh(product.price)} / {product.unit}</option>)}
              </select>
              <button type="button" onClick={ajouterProduit} disabled={!ajout}
                className="min-h-11 rounded-2xl bg-[#F0FAF1] px-4 text-sm font-bold text-[#176B2E] disabled:opacity-50">{t("Ajouter")}</button>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(false)} className="min-h-11 flex-1 rounded-2xl border border-[#E6F0E7] text-sm font-bold text-[#6F8070]">{t("Annuler")}</button>
              <button type="button" onClick={() => void saveLignes()} disabled={disabled}
                className="min-h-11 flex-1 rounded-2xl bg-[#1E8A3C] text-sm font-bold text-white disabled:opacity-60">{t("Enregistrer")}</button>
            </div>
          </div>
        )}

        <div className="space-y-1 border-t border-[#EEF2EE] pt-3 text-sm">
          <div className="flex justify-between text-[#6F8070]"><span>{t("Produits (prix du jour)")}</span><span>{formatDh(item.sous_total_estime)}</span></div>
          <div className="flex justify-between text-[#6F8070]"><span>{t("Livraison")}</span><span>{item.frais_livraison_estimes ? formatDh(item.frais_livraison_estimes) : "Offerte"}</span></div>
          <div className="flex justify-between font-bold text-[#264129]"><span>{t("Estimation")}</span><span className="text-lg font-black text-[#F07C00]">{formatDh(item.total_estime)}</span></div>
          <p className="text-xs text-[#7B8B7D]">{t("Le montant exact est fixé à 01h00 le jour de la livraison, au prix du site.")}</p>
        </div>

        {item.message && <p className="rounded-2xl bg-[#FFF7EE] p-3 text-xs font-semibold text-[#9A5C11]">{item.message}</p>}

        {item.statut !== "ARRETEE" && !editing && (
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={startEdit} disabled={disabled}
              className="min-h-11 rounded-2xl bg-[#F0FAF1] px-4 text-sm font-bold text-[#176B2E] disabled:opacity-50">{t("Modifier ma liste")}</button>
            <select value={item.frequence} disabled={disabled} aria-label={t("Rythme de livraison")}
              onChange={(event) => void run(() => modifierCommandeRecurrente(item.id, { frequence: event.target.value as FrequenceRecurrente }), "Rythme mis à jour.")}
              className="min-h-11 rounded-2xl border border-[#CFE6D2] bg-white px-3 text-sm font-semibold text-[#264129] disabled:opacity-50">
              {FREQUENCES_RECURRENTES.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
            </select>
            <select value={item.mode_paiement === "wallet" ? "wallet" : "cod"} disabled={disabled} aria-label={t("Mode de paiement")}
              onChange={(event) => void run(() => modifierCommandeRecurrente(item.id, { mode_paiement: event.target.value as "cod" | "wallet" }), "Paiement mis à jour.")}
              className="min-h-11 rounded-2xl border border-[#CFE6D2] bg-white px-3 text-sm font-semibold text-[#264129] disabled:opacity-50">
              <option value="cod">{t("Paiement à la livraison")}</option>
              <option value="wallet">{t("Wallet SOUKI")}</option>
            </select>
            {item.statut === "ACTIVE" && (
              <button type="button" disabled={disabled} onClick={() => void run(() => sauterCommandeRecurrente(item.id), "Livraison sautée.")}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[#F5D7B8] px-4 text-sm font-bold text-[#C26100] disabled:opacity-50">
                <SkipForward className="h-4 w-4" aria-hidden="true" /> {t("Sauter la prochaine")}
              </button>
            )}
            {item.statut === "ACTIVE" && !showPause && (
              <button type="button" disabled={disabled} onClick={() => setShowPause(true)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[#E6F0E7] px-4 text-sm font-bold text-[#264129] disabled:opacity-50">
                <Pause className="h-4 w-4" aria-hidden="true" /> {t("Mettre en pause")}
              </button>
            )}
            {item.statut === "EN_PAUSE" && (
              <button type="button" disabled={disabled} onClick={() => void run(() => reprendreCommandeRecurrente(item.id), "Abonnement repris.")}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#1E8A3C] px-4 text-sm font-bold text-white disabled:opacity-50">
                <Play className="h-4 w-4" aria-hidden="true" /> {t("Reprendre")}
              </button>
            )}
            <button type="button" disabled={disabled}
              onClick={() => confirmStop ? void run(() => arreterCommandeRecurrente(item.id), "Abonnement arrêté.") : setConfirmStop(true)}
              className="min-h-11 rounded-2xl px-4 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50">
              {confirmStop ? t("Confirmer l'arrêt") : t("Arrêter")}
            </button>
          </div>
        )}

        {showPause && item.statut === "ACTIVE" && (
          <div className="flex flex-col gap-2 rounded-2xl border border-[#E6F0E7] p-3 sm:flex-row sm:items-center">
            <label className="flex-1 text-sm font-semibold text-[#264129]">
              {t("Reprendre le")}
              <input type="date" value={pauseDate} min={dateIsoPlusJours(2)} max={dateIsoPlusJours(90)}
                onChange={(event) => setPauseDate(event.target.value)}
                className="mt-1 block min-h-11 w-full rounded-2xl border border-[#CFE6D2] px-3" />
            </label>
            <button type="button" onClick={() => setShowPause(false)} className="min-h-11 rounded-2xl px-4 text-sm font-bold text-[#6F8070]">{t("Annuler")}</button>
            <button type="button" disabled={disabled || !pauseDate}
              onClick={() => void run(() => pauseCommandeRecurrente(item.id, pauseDate), "Abonnement en pause.").then((ok) => ok && setShowPause(false))}
              className="min-h-11 rounded-2xl bg-[#F07C00] px-4 text-sm font-bold text-white disabled:opacity-50">{t("Valider la pause")}</button>
          </div>
        )}

        {item.dernieres_livraisons.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-[#176B2E]">{t("Dernières livraisons")}</summary>
            <ul className="mt-2 space-y-1">
              {item.dernieres_livraisons.map((livraison) => (
                <li key={livraison.date_livraison} className="flex flex-wrap justify-between gap-2 text-xs text-[#5F735F]">
                  <span>{formatDateCourte(livraison.date_livraison, dateLocale)} · {livraison.statut === "CREEE" ? t("Commande créée") : livraison.statut === "SAUTEE" ? t("Sautée") : t("Non créée")}{livraison.motif ? ` · ${t(livraison.motif)}` : ""}</span>
                  {livraison.commande_id
                    ? <Link href={`/suivi-commande?commande=${livraison.commande_id}`} className="font-bold text-[#F07C00]">{formatDh(livraison.montant)}</Link>
                    : null}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </article>
  )
}

export function MesAbonnements() {
  const { t } = useLocale()
  const { isAuthenticated, isLoading } = useAuth()
  const [items, setItems] = useState<CommandeRecurrenteDTO[] | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setItems(await getCommandesRecurrentes(signal))
      setError("")
    } catch (err) {
      if (!signal?.aborted) setError(errorMessage(err))
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [isAuthenticated, load])

  if (isLoading || !isAuthenticated) return null

  const update = (next: CommandeRecurrenteDTO) => setItems((current) => (current || [])
    .map((item) => item.id === next.id ? next : item)
    .filter((item) => item.statut !== "ARRETEE"))

  return (
    <section id="mes-abonnements" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-[#1E8A3C]">{t("Mes abonnements")}</h2>
          <p className="mt-1 text-sm text-[#5F735F]">{t("Vos commandes reviennent toutes seules. Modifiez-les jusqu'à 01h00 la veille.")}</p>
        </div>
        <Link href="/historique" className="text-sm font-bold text-[#F07C00]">{t("Répéter une autre commande")}</Link>
      </div>
      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-600">{error}</p>
      ) : items === null ? (
        <div className="souki-skeleton h-40 rounded-2xl" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-[#D7EBD9] bg-white p-6 text-sm text-[#5F735F]">
          {t("Vous n'avez pas encore d'abonnement. Dans votre historique, touchez « Répéter cette commande » pour la recevoir automatiquement.")}
          <Link href="/historique" className="mt-4 flex min-h-11 w-full items-center justify-center rounded-2xl bg-[#1E8A3C] px-5 font-bold text-white sm:w-auto sm:inline-flex">
            {t("Voir mes commandes")}
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => <CarteAbonnement key={item.id} item={item} onChange={update} />)}
        </div>
      )}
    </section>
  )
}
