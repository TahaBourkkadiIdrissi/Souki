import type { CommandeRecurrenteDTO, FrequenceRecurrente, StatutRecurrence } from "@/lib/api"

export const FREQUENCES_RECURRENTES: { value: FrequenceRecurrente; label: string; detail: string }[] = [
  { value: "QUOTIDIENNE", label: "Chaque jour", detail: "Livrée tous les jours" },
  { value: "TOUS_LES_3_JOURS", label: "Tous les 3 jours", detail: "Idéal pour les produits frais" },
  { value: "HEBDOMADAIRE", label: "Chaque semaine", detail: "Le même jour chaque semaine" },
  { value: "TOUTES_LES_2_SEMAINES", label: "Toutes les 2 semaines", detail: "Un jour sur deux semaines" },
]

export const frequenceLabel = (value: FrequenceRecurrente) =>
  FREQUENCES_RECURRENTES.find((item) => item.value === value)?.label ?? value

export const STATUTS_RECURRENCE: Record<StatutRecurrence, { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "border-[#BFE6C4] bg-[#EAF8EC] text-[#1E8A3C]" },
  EN_PAUSE: { label: "En pause", className: "border-[#F5D7B8] bg-[#FFF7EE] text-[#9A5C11]" },
  SUSPENDUE: { label: "Suspendue", className: "border-red-200 bg-red-50 text-red-600" },
  ARRETEE: { label: "Arrêtée", className: "border-gray-200 bg-gray-50 text-gray-500" },
}

export const typeRecurrenceLabel = (recurrence: Pick<CommandeRecurrenteDTO, "type">) =>
  recurrence.type === "PANIER" ? "Panier Souki" : "Commande récurrente"

export const formatDh = (value: number | null | undefined) => `${Number(value || 0).toFixed(2)} DH`

export const formatVariation = (value: number) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(2)} DH`

export function formatDateCourte(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("fr-MA", { weekday: "long", day: "numeric", month: "long" }).format(date)
}

export function dateIsoPlusJours(jours: number, from = new Date()) {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + jours)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}
