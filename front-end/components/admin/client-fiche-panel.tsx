"use client"

import { Lock } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { CommandeHistoriqueDTO, FicheClientDTO } from "@/lib/api"

export type ClientBlockKey =
  | "identity"
  | "orders"
  | "voice"
  | "sessions"
  | "notifications"
  | "subscription"

function emptyValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "Aucune donnee disponible"
  }

  return String(value)
}

function formatBool(value: boolean | null | undefined) {
  if (value === null || value === undefined) {
    return "Aucune donnee disponible"
  }

  return value ? "Oui" : "Non"
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0.00 DH"
  }

  return `${value.toFixed(2)} DH`
}

function formatWeight(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Aucune donnee disponible"
  }

  return `${value.toFixed(2)} kg`
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Aucune donnee disponible"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function formatShortDateTime(value: string | null | undefined) {
  if (!value) {
    return "-"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function normalizeStatus(value: string | undefined) {
  return (value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function statusBadge(status: string) {
  const normalized = normalizeStatus(status)

  if (normalized === "en_attente") {
    return {
      label: "En attente",
      className: "bg-amber-50 text-amber-800 border-amber-200",
      locked: false,
    }
  }

  if (normalized === "confirmee") {
    return {
      label: "Confirmee",
      className: "bg-blue-50 text-blue-800 border-blue-200",
      locked: false,
    }
  }

  if (normalized === "verrouillee") {
    return {
      label: "Verrouillee",
      className: "bg-slate-100 text-slate-800 border-slate-200",
      locked: true,
    }
  }

  if (normalized === "a_livrer") {
    return {
      label: "A livrer",
      className: "bg-indigo-50 text-indigo-900 border-indigo-200",
      locked: false,
    }
  }

  if (normalized === "en_route") {
    return {
      label: "En route",
      className: "bg-violet-50 text-violet-900 border-violet-200",
      locked: false,
    }
  }

  if (normalized === "livre" || normalized === "livree") {
    return {
      label: "Livre",
      className: "bg-emerald-50 text-emerald-900 border-emerald-200",
      locked: false,
    }
  }

  if (normalized === "absent") {
    return {
      label: "Absent",
      className: "bg-orange-50 text-orange-900 border-orange-200",
      locked: false,
    }
  }

  if (normalized === "annulee" || normalized === "annule") {
    return {
      label: "Annulee",
      className: "bg-red-50 text-red-900 border-red-200",
      locked: false,
    }
  }

  return {
    label: status || "Inconnu",
    className: "bg-gray-50 text-gray-700 border-gray-200",
    locked: false,
  }
}

function ClientInfoGrid({ items }: { items: { label: string; value: string | number | null | undefined }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-gray-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase text-[#8A8A8A]">{item.label}</p>
          <p className="mt-1 text-sm font-medium text-[#3D3D3D]">{emptyValue(item.value)}</p>
        </div>
      ))}
    </div>
  )
}

export function EmptyClientBlock() {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-[#8A8A8A]">
      Aucune donnee disponible
    </div>
  )
}

function CommandeClientCard({ commande }: { commande: CommandeHistoriqueDTO }) {
  const badge = statusBadge(commande.statut || "")

  return (
    <div className="rounded-xl border border-gray-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[#1E8A3C]">Commande #{commande.id}</p>
          <p className="text-sm text-[#8A8A8A]">{formatShortDateTime(commande.date_commande)}</p>
        </div>
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium", badge.className)}>
          {badge.locked && <Lock className="h-3 w-3" />}
          {badge.label}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-gray-50 px-3 py-2">
          <p className="text-xs uppercase text-[#8A8A8A]">Montant</p>
          <p className="font-semibold text-[#F07C00]">{formatMoney(commande.montant_total)}</p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2">
          <p className="text-xs uppercase text-[#8A8A8A]">Paiement</p>
          <p className="font-medium text-[#3D3D3D]">{emptyValue(commande.mode_paiement)}</p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2">
          <p className="text-xs uppercase text-[#8A8A8A]">Valide</p>
          <p className="font-medium text-[#3D3D3D]">{formatBool(commande.payment_validated)}</p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2">
          <p className="text-xs uppercase text-[#8A8A8A]">A encaisser</p>
          <p className="font-semibold text-[#3D3D3D]">{formatMoney(commande.montant_a_encaisser)}</p>
        </div>
      </div>

      <ClientInfoGrid
        items={[
          { label: "Creneau", value: commande.creneau_livraison },
          { label: "En route", value: formatShortDateTime(commande.enroute_at) },
          { label: "Livree", value: formatShortDateTime(commande.delivered_at) },
          { label: "Absent", value: formatShortDateTime(commande.absent_at) },
        ]}
      />

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase text-[#8A8A8A]">Produits</p>
        {commande.produits.length === 0 ? (
          <EmptyClientBlock />
        ) : (
          <div className="flex flex-wrap gap-2">
            {commande.produits.map((produit, index) => (
              <span key={`${produit.nom_fr}-${index}`} className="rounded-full border border-[#1E8A3C]/20 bg-[#F0FAF1] px-3 py-1 text-xs font-medium text-[#1E8A3C]">
                {produit.nom_fr} - {formatWeight(produit.quantite_kg)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function FicheClientPanel({
  fiche,
  openBlocks,
  onToggleBlock,
}: {
  fiche: FicheClientDTO
  openBlocks: Record<string, boolean>
  onToggleBlock: (blockKey: ClientBlockKey) => void
}) {
  const blockOrder: ClientBlockKey[] = ["identity", "orders", "voice", "sessions", "notifications", "subscription"]
  const activeBlock = blockOrder.find((blockKey) => openBlocks[`${fiche.id}:${blockKey}`]) || "identity"
  const paiements = fiche.commandes.filter((commande) => commande.paiement)

  return (
    <div className="rounded-2xl border border-[#1E8A3C]/20 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1E8A3C]">Fiche client</p>
          <h3 className="mt-1 text-base font-bold text-gray-950">Client #{fiche.id}</h3>
          <p className="mt-1 text-sm text-gray-500">{fiche.email || fiche.phone || "Aucune donnee disponible"}</p>
        </div>
        <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", fiche.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-gray-200 bg-gray-50 text-gray-600")}>
          {fiche.is_active ? "Actif" : "Inactif"}
        </span>
      </div>

      <Tabs defaultValue={activeBlock} onValueChange={(value) => onToggleBlock(value as ClientBlockKey)} className="p-5">
        <TabsList className="mb-5 flex h-auto w-full flex-wrap justify-start gap-2 rounded-xl bg-gray-100 p-1">
          <TabsTrigger value="identity" className="rounded-lg px-3 py-2 text-xs data-[state=active]:bg-white data-[state=active]:text-[#1E8A3C]">Identite</TabsTrigger>
          <TabsTrigger value="orders" className="rounded-lg px-3 py-2 text-xs data-[state=active]:bg-white data-[state=active]:text-[#1E8A3C]">Commandes</TabsTrigger>
          <TabsTrigger value="voice" className="rounded-lg px-3 py-2 text-xs data-[state=active]:bg-white data-[state=active]:text-[#1E8A3C]">Vocal</TabsTrigger>
          <TabsTrigger value="sessions" className="rounded-lg px-3 py-2 text-xs data-[state=active]:bg-white data-[state=active]:text-[#1E8A3C]">Sessions</TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-lg px-3 py-2 text-xs data-[state=active]:bg-white data-[state=active]:text-[#1E8A3C]">Notifs</TabsTrigger>
          <TabsTrigger value="subscription" className="rounded-lg px-3 py-2 text-xs data-[state=active]:bg-white data-[state=active]:text-[#1E8A3C]">Abonnement</TabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="space-y-4">
          <ClientInfoGrid
            items={[
              { label: "Email", value: fiche.email },
              { label: "Telephone", value: fiche.phone },
              { label: "Inscription", value: formatDateTime(fiche.created_at) },
              { label: "Derniere connexion", value: formatDateTime(fiche.last_login_at) },
              { label: "Provider", value: fiche.auth_provider },
              { label: "Email verifie", value: formatBool(fiche.is_email_verified) },
              { label: "Telephone verifie", value: formatBool(fiche.is_phone_verified) },
              { label: "Blacklisted", value: formatBool(fiche.is_blacklisted) },
            ]}
          />
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Adresses</p>
            {(fiche.adresses || []).length === 0 ? (
              <EmptyClientBlock />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {(fiche.adresses || []).map((adresse, index) => (
                  <div key={`${adresse.neighborhood || "adresse"}-${index}`} className="rounded-xl border border-gray-100 bg-slate-50 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-gray-950">
                        {[adresse.neighborhood, adresse.street, adresse.ville].filter(Boolean).join(", ") || "Adresse sans libelle"}
                      </p>
                      {adresse.is_default ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                          Principale
                        </span>
                      ) : null}
                    </div>
                    {adresse.details ? <p className="mt-1 text-sm text-gray-500">{adresse.details}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          {fiche.commandes.length === 0 ? (
            <EmptyClientBlock />
          ) : (
            <div className="grid gap-3">
              {fiche.commandes.map((commande) => (
                <CommandeClientCard key={commande.id} commande={commande} />
              ))}
            </div>
          )}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Paiements</p>
            {paiements.length === 0 ? (
              <EmptyClientBlock />
            ) : (
              <div className="space-y-3">
                {paiements.map((commande) => (
                  <ClientInfoGrid
                    key={`paiement-${commande.id}`}
                    items={[
                      { label: "Commande", value: `#${commande.id}` },
                      { label: "Methode", value: commande.paiement?.methode },
                      { label: "Montant", value: formatMoney(commande.paiement?.montant) },
                      { label: "Valide", value: formatBool(commande.paiement?.valide) },
                      { label: "Frais CMI", value: formatMoney(commande.paiement?.frais_cmi) },
                      { label: "Montant net", value: formatMoney(commande.paiement?.montant_net) },
                    ]}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="voice" className="space-y-3">
          {fiche.commandes_vocales.length === 0 ? (
            <EmptyClientBlock />
          ) : (
            fiche.commandes_vocales.map((commande) => (
              <div key={commande.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <p className="font-semibold text-[#1E8A3C]">Commande vocale #{commande.id}</p>
                <p className="text-sm text-gray-500">{formatShortDateTime(commande.created_at)} - {emptyValue(commande.langue_detectee)}</p>
                <p className="mt-2 text-sm text-gray-700">{emptyValue(commande.transcription_brute)}</p>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="sessions" className="space-y-3">
          {fiche.sessions.length === 0 ? (
            <EmptyClientBlock />
          ) : (
            fiche.sessions.map((session, index) => (
              <ClientInfoGrid
                key={`${session.ip || "session"}-${index}`}
                items={[
                  { label: "Appareil", value: session.device_name },
                  { label: "Navigateur", value: session.browser },
                  { label: "Localisation", value: session.location },
                  { label: "IP", value: session.ip },
                  { label: "Derniere activite", value: formatDateTime(session.last_active) },
                  { label: "Creee le", value: formatDateTime(session.created_at) },
                  { label: "Active", value: formatBool(session.is_active) },
                ]}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="notifications">
          {!fiche.notifications ? (
            <EmptyClientBlock />
          ) : (
            <ClientInfoGrid
              items={[
                { label: "Email", value: formatBool(fiche.notifications.email) },
                { label: "Push", value: formatBool(fiche.notifications.push) },
                { label: "SMS", value: formatBool(fiche.notifications.sms) },
                { label: "Commandes", value: formatBool(fiche.notifications.order_updates) },
                { label: "Promotions", value: formatBool(fiche.notifications.promotions) },
                { label: "Newsletter", value: formatBool(fiche.notifications.newsletter) },
              ]}
            />
          )}
        </TabsContent>

        <TabsContent value="subscription">
          {!fiche.abonnement ? (
            <EmptyClientBlock />
          ) : (
            <ClientInfoGrid
              items={[
                { label: "Poids garanti", value: fiche.abonnement.poids_garanti !== null && fiche.abonnement.poids_garanti !== undefined ? formatWeight(fiche.abonnement.poids_garanti) : null },
                { label: "Frequence", value: fiche.abonnement.frequence },
                { label: "Mensuel", value: fiche.abonnement.montant_mensuel !== null && fiche.abonnement.montant_mensuel !== undefined ? formatMoney(fiche.abonnement.montant_mensuel) : null },
                { label: "Actif", value: formatBool(fiche.abonnement.actif) },
              ]}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
