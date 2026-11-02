import type { FrequenceRecurrente, StatutRecurrence } from "@/lib/api"

export const FREQUENCE_LABELS: Record<FrequenceRecurrente, string> = {
  QUOTIDIENNE: "Chaque jour",
  TOUS_LES_3_JOURS: "Tous les 3 jours",
  HEBDOMADAIRE: "Chaque semaine",
  TOUTES_LES_2_SEMAINES: "Toutes les 2 semaines",
}

export const STATUT_RECURRENCE: Record<StatutRecurrence, { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "bg-green-100 text-green-700" },
  EN_PAUSE: { label: "En pause", className: "bg-orange-100 text-orange-700" },
  SUSPENDUE: { label: "Suspendue", className: "bg-red-100 text-red-700" },
  ARRETEE: { label: "Arrêtée", className: "bg-gray-100 text-gray-600" },
}

export const LIVRAISON_LABELS = { CREEE: "Commande créée", SAUTEE: "Sautée", ECHEC: "Échec" } as const

export const TYPE_RECURRENCE_LABELS = { COMMANDE: "Commande récurrente", PANIER: "Panier Souki" } as const

export const formatDh = (value: number | null | undefined) => `${Number(value || 0).toFixed(2)} DH`

export const formatVariation = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(2)} DH`

export const formatDateFr = (value: string | null | undefined) => {
  if (!value) return "—"
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("fr-MA", { weekday: "short", day: "2-digit", month: "short" }).format(date)
}

export const todayMorocco = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" }).format(new Date())

export const addDaysIso = (iso: string, days: number) => {
  const date = new Date(`${iso}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
