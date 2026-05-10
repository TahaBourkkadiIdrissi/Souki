const DEFAULT_API_BASE_URL = "/backend"

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE_URL
).replace(/\/$/, "")

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  headers?: Record<string, string>
  body?: unknown
  token?: string
  signal?: AbortSignal
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export interface TourneeItem {
  commande_id: number
  client_phone: string | null
  client_label: string
  street: string | null
  neighborhood: string | null
  details: string | null
  full_address: string
  colis_count: number
  creneau_livraison: string | null
  statut: string
  status_version: number
  enroute_at?: string | null
  delivered_at?: string | null
  absent_at?: string | null
  montant_total: number
  mode_paiement: string | null
  payment_validated?: boolean | null
  lat: number | null
  lng: number | null
  latitude?: number | null
  longitude?: number | null
}

export interface TourneeResponse {
  status: string
  date_jour: string
  available_after: string
  sort_strategy: string
  tournee_started: boolean
  items: TourneeItem[]
}

export interface AdminDispatchAddress {
  street: string | null
  neighborhood: string | null
  details: string | null
  ville: string | null
  latitude: number | null
  longitude: number | null
  full_address: string | null
}

export interface AdminDispatchCommande {
  id: number
  client_id: number | null
  client_nom: string
  client_phone: string | null
  statut: string
  ordre_passage: number | null
  creneau_livraison: string | null
  montant_total: number
  date_commande: string | null
  mode_paiement: string | null
  adresse: AdminDispatchAddress | null
}

export interface AdminDispatchLivreur {
  user_id: number | null
  nom: string
  email: string | null
  phone: string | null
  vehicule: string | null
  disponible: boolean | null
  note_moyenne: number | null
}

export interface AdminDispatchTournee {
  id: number
  date_tournee: string | null
  statut: string
  distance_totale_km: number | null
  created_at: string | null
  livreur: AdminDispatchLivreur
  commandes: AdminDispatchCommande[]
}

export interface AdminDispatchTourneesResponse {
  status: string
  target_date: string
  tournees: AdminDispatchTournee[]
}

export interface AdminDispatchRunDailyResponse {
  status: string
  target_date: string
  count?: number
  tournees_created?: number
  commandes_assigned?: number
  available_livreurs?: number
}

export interface ReassignDispatchResponse {
  status: string
  commande_id: number
  nouvelle_tournee_id: number
  ordre_passage: number
}

export interface DemarrerTourneeResponse {
  status: string
  updated_count: number
  previous_status: string
  new_status: string
  message: string
}

export interface DetailProduitJIT {
  product_id: number
  nom_fr: string
  nom_darija: string
  quantite_brute_kg: number
  buffer_perte_10_pct: number
  volume_total_kg: number
  prix_kg: number
  prix_achat: number
  sous_total: number
  sous_total_ca: number
  sous_total_achat: number
  unite: string
}

export interface ResultatAgregationJIT {
  nombre_commandes: number
  nombre_abonnements: number
  volume_total_kg: number
  details_produits: DetailProduitJIT[]
  montant_total: number
  ca_estime_total: number
  cout_achat_estime: number
  marge_estimee: number
  statut: string
  message?: string | null
}

export interface JITLogDTO {
  id?: number | null
  date_execution?: string | null
  volume_total: number
  nombre_commandes: number
  nombre_abonnements: number
  statut: string
  details_volumes?: Record<string, unknown> | null
  message_alerte?: string | null
}

export interface JITDeverrouillerResponse {
  nombre_commandes?: number
  nombre_deverrouillees?: number
  commandes?: JITCommandeDeverrouillee[]
  statut?: string
  message?: string
}

export interface JITCommandeDeverrouillee {
  id: number
  date_commande?: string | null
  statut_avant?: string | null
  statut_apres?: string | null
}

export interface JITLogsParPlageResponse {
  logs: JITLogDTO[]
  nombre: number
}

export interface DeliveryEventRequest {
  target_status: "EN_ROUTE" | "LIVRE" | "ABSENT" | "REFUS"
  client_event_id: string
  device_timestamp: string
  expected_version?: number
}

export interface DeliveryEventResponse {
  status: string
  event_id: string
  client_event_id: string
  commande_id: number
  previous_status: string
  new_status: string
  status_version: number
  enroute_at?: string | null
  delivered_at?: string | null
  absent_at?: string | null
  device_timestamp: string
  server_timestamp: string
  idempotent: boolean
  message: string
}

export interface CodValidationResponse {
  status: string
  commande_id: number
  payment_validated: boolean
  mode_paiement?: string | null
  montant_total: number
  idempotent: boolean
  message: string
}

export interface ProduitCommandeJourDTO {
  ligne_panier_id?: number | null
  product_id?: number | null
  nom_fr: string
  quantite_kg: number
  sous_total?: number | null
  image?: string | null
}

export interface PaiementDTO {
  methode?: string | null
  montant?: number | null
  valide?: boolean | null
  frais_cmi?: number | null
  montant_net?: number | null
}

export interface SessionClientDTO {
  device_name?: string | null
  browser?: string | null
  location?: string | null
  ip?: string | null
  last_active?: string | null
  created_at?: string | null
  is_active?: boolean | null
}

export interface NotificationPrefsDTO {
  email?: boolean | null
  push?: boolean | null
  sms?: boolean | null
  order_updates?: boolean | null
  promotions?: boolean | null
  newsletter?: boolean | null
}

export interface AbonnementClientDTO {
  poids_garanti?: number | null
  frequence?: string | null
  montant_mensuel?: number | null
  actif?: boolean | null
}

export interface CommandeVocaleClientDTO {
  id: number
  created_at?: string | null
  langue_detectee?: string | null
  transcription_brute?: string | null
}

export interface CommandeHistoriqueDTO {
  id: number
  date_commande?: string | null
  statut?: string | null
  montant_total?: number | null
  mode_paiement?: string | null
  payment_validated?: boolean | null
  montant_a_encaisser?: number | null
  creneau_livraison?: string | null
  enroute_at?: string | null
  delivered_at?: string | null
  absent_at?: string | null
  produits: ProduitCommandeJourDTO[]
  paiement?: PaiementDTO | null
}

export interface AdresseClientDTO {
  neighborhood: string | null
  street: string | null
  details: string | null
  ville: string | null
  is_default: boolean | null
}

export interface FicheClientDTO {
  id: number
  email?: string | null
  phone?: string | null
  created_at?: string | null
  last_login_at?: string | null
  is_active?: boolean | null
  is_blacklisted?: boolean | null
  auth_provider?: string | null
  is_email_verified?: boolean | null
  is_phone_verified?: boolean | null
  adresses: AdresseClientDTO[]
  commandes: CommandeHistoriqueDTO[]
  commandes_vocales: CommandeVocaleClientDTO[]
  sessions: SessionClientDTO[]
  notifications?: NotificationPrefsDTO | null
  abonnement?: AbonnementClientDTO | null
}

export type StatutConfirmationCOD = "NON_CONFIRMEE" | "CONFIRMEE_PAR_APPEL" | "ANNULEE"

export interface CommandeCODDemainDTO {
  id: number
  client_id?: number | null
  nom_client?: string | null
  telephone?: string | null
  adresse?: string | null
  montant?: number | null
  creneau_livraison?: string | null
  statut_confirmation_cod: StatutConfirmationCOD | string
}

export interface ConfirmationCODResponseDTO {
  commande_id: number
  statut_confirmation_cod: StatutConfirmationCOD | string
  commande_statut?: string | null
  logged_at?: string | null
  message: string
}

export interface BatchConfirmationCODDTO {
  commande_ids: number[]
  statut: Exclude<StatutConfirmationCOD, "NON_CONFIRMEE">
}

export interface BatchConfirmationCODResponseDTO {
  success: number[]
  failed: number[]
  total: number
  message: string
}

export interface AlerteCOD18hDTO {
  alerte_active: boolean
  nb_non_confirmees: number
  depuis: string | null
}

export interface ClientBlacklistDTO {
  client_id: number
  email: string | null
  phone: string | null
  is_blacklisted: boolean
  date_blacklist: string | null
  motif: string | null
  source: string | null
  livreur_nom: string | null
  commande_id: number | null
  commande_statut: string | null
  commande_date: string | null
  montant_perdu: number
  admin_nom: string | null
}

export interface AdminClientDTO {
  client_id: number
  email: string | null
  phone: string | null
  nb_commandes: number
  montant_total: number
  mode_paiement_favori: string | null
  is_blacklisted: boolean
  date_inscription: string | null
}

export interface AdminClientsPageDTO {
  items: AdminClientDTO[]
  total: number
  total_commandes: number
  montant_total_global: number
  page: number
  page_size: number
  total_pages: number
}

export type ProduitNiveau = 1 | 2 | 3
export type ProduitVolatilite = "STABLE" | "VARIABLE" | "SAISONNIER"
export type ProduitAlerte = "PRIX_DEPASSE_KHDDAR" | "PRIX_GROS_MANQUANT" | null

export interface ProduitPricingDTO {
  id: number
  nom_fr: string
  nom_darija: string
  prix_kg: number
  unite: string
  marge_cible: number
  coussin_securite: number
  niveau: ProduitNiveau
  volatilite: ProduitVolatilite
  prix_gros_saisi: number | null
  prix_affiche: number | null
  prix_khddar_estime: number | null
  alerte: ProduitAlerte
}

export interface ProduitPricingListDTO {
  items: ProduitPricingDTO[]
  total: number
  nb_alertes: number
}

export interface ProduitPricingUpdateDTO {
  marge_cible?: number
  coussin_securite?: number
  niveau?: ProduitNiveau
  volatilite?: ProduitVolatilite
  prix_gros_saisi?: number | null
}

export interface BlacklistParClientDTO {
  client_id: number
  email: string | null
  phone: string | null
  nb_refus: number
  montant_perdu: number
}

export interface BlacklistParLivreurDTO {
  livreur_id: number
  livreur_nom: string | null
  nb_refus: number
}

export interface BlacklistParQuartierDTO {
  quartier: string | null
  nb_refus: number
  montant_perdu: number
}

export interface BlacklistCommandeRefuseeDTO {
  log_id: number
  commande_id: number | null
  client_id: number
  client_label: string | null
  phone: string | null
  date_refus: string | null
  date_commande: string | null
  statut_commande: string | null
  montant_perdu: number
  livreur_nom: string | null
  quartier: string | null
  motif: string | null
}

export interface BlacklistReportDTO {
  mois: number
  annee: number
  total_refus: number
  total_perte: number
  par_client: BlacklistParClientDTO[]
  par_livreur: BlacklistParLivreurDTO[]
  par_quartier: BlacklistParQuartierDTO[]
  commandes_refusees: BlacklistCommandeRefuseeDTO[]
}

export type DashboardPeriod = "today" | "7d" | "30d" | "month" | "custom"

export interface DashboardCurvePointDTO {
  date: string
  ca: number
  nb_commandes: number
}

export interface DashboardStatusDTO {
  statut: string
  count: number
  pourcentage: number
}

export interface DashboardPaymentDTO {
  mode: string
  count: number
  montant: number
  pourcentage: number
}

export interface DashboardDTO {
  periode: DashboardPeriod
  date_custom: string | null
  date_debut: string
  date_fin: string
  derniere_maj: string
  total_commandes: number
  total_commandes_precedent: number
  commandes_livrees: number
  commandes_livrees_precedent: number
  commandes_en_route: number
  commandes_annulees: number
  commandes_absentes: number
  taux_livraison: number
  taux_absence: number
  ca_total: number
  ca_total_precedent: number
  ca_cod: number
  ca_wallet: number
  ca_cmi: number
  panier_moyen: number
  total_clients_actifs: number
  nouveaux_clients: number
  nouveaux_clients_precedent: number
  clients_blacklistes: number
  dernier_jit_statut: string | null
  dernier_jit_volume: number
  dernier_jit_nb_commandes: number
  dernier_jit_date: string | null
  jit_execute_aujourdhui: boolean
  livreurs_disponibles: number
  tournees_actives: number
  cod_confirmes: number
  cod_annules: number
  taux_confirmation_cod: number
  nouveaux_blacklistes: number
  blacklists_leves: number
  courbe_ca: DashboardCurvePointDTO[]
  repartition_statuts: DashboardStatusDTO[]
  repartition_paiements: DashboardPaymentDTO[]
}

export interface LiftBlacklistDTO {
  reason?: string
}

export async function apiCall<T = any>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  const fetchOptions: RequestInit = {
    method: options.method || "GET",
    headers,
    signal: options.signal,
  }

  if (options.body !== undefined) {
    fetchOptions.body = JSON.stringify(options.body)
  }

  const response = await fetch(url, fetchOptions)
  const contentType = response.headers.get("content-type") || ""
  const isJsonResponse = contentType.includes("application/json")

  if (!response.ok) {
    const error = isJsonResponse ? await response.json().catch(() => null) : null
    throw new ApiError(response.status, error?.detail || `API error: ${response.status}`)
  }

  if (!isJsonResponse) {
    return null as T
  }

  return response.json() as Promise<T>
}

export async function validateUserToken(token: string) {
  return apiCall("/auth/me", { token })
}

export async function loginUser(loginId: string, password: string, role = "CLIENT") {
  return apiCall("/auth/login", {
    method: "POST",
    body: { login_id: loginId, password, role },
  })
}

export async function getLivreurTournee(token: string, signal?: AbortSignal) {
  return apiCall<TourneeResponse>("/api/livreur/tournee", { token, signal })
}

export async function demarrerLivreurTournee(token: string) {
  return apiCall<DemarrerTourneeResponse>("/api/livreur/demarrer-tournee", {
    method: "POST",
    token,
  })
}

export async function jitAgreger(token: string) {
  return apiCall<ResultatAgregationJIT>("/api/jit/agreguer", {
    method: "POST",
    token,
  })
}

export async function envoyerEvenementLivraison(
  token: string,
  commandeId: string | number,
  body: DeliveryEventRequest
) {
  return apiCall<DeliveryEventResponse>(`/api/livreur/livraisons/${commandeId}/events`, {
    method: "POST",
    token,
    body,
  })
}

export async function validerPaiementCodLivreur(token: string, commandeId: string | number) {
  return apiCall<CodValidationResponse>(`/api/livreur/livraisons/${commandeId}/cod/validate`, {
    method: "POST",
    token,
  })
}

export async function jitExecuter(token: string) {
  return apiCall<JITLogDTO>("/api/jit/executer", {
    method: "POST",
    token,
  })
}

export async function jitDeverrouiller(token: string) {
  return apiCall<JITDeverrouillerResponse>("/api/jit/deverrouiller", {
    method: "POST",
    token,
  })
}

export async function jitDernierLog(token: string) {
  return apiCall<JITLogDTO>("/api/jit/logs/dernier", { token })
}

export async function jitLogsParPlage(token: string, dateDebut: string, dateFin: string) {
  return apiCall<JITLogsParPlageResponse>(
    `/api/jit/logs/${encodeURIComponent(dateDebut)}/${encodeURIComponent(dateFin)}`,
    { token }
  )
}

export async function getFicheClient(token: string, clientId: number) {
  return apiCall<FicheClientDTO>(`/api/commandes/clients/${clientId}`, { token })
}

export async function getCommandesCODVerouillees(token: string, signal?: AbortSignal) {
  return apiCall<CommandeCODDemainDTO[]>("/api/commandes/cod/verouillees", { token, signal })
}

// DEPRECATED - utiliser getCommandesCODVerouillees()
export async function getCommandesCODDemain(token: string, signal?: AbortSignal) {
  return apiCall<CommandeCODDemainDTO[]>("/api/commandes/cod/demain", { token, signal })
}

export async function getAdminDispatchTournees(
  token: string,
  targetDate?: string,
  signal?: AbortSignal
) {
  const query = targetDate ? `?date=${encodeURIComponent(targetDate)}` : ""
  return apiCall<AdminDispatchTourneesResponse>(`/api/v1/admin/dispatch/tournees${query}`, {
    token,
    signal,
  })
}

export async function runDailyAdminDispatch(token: string) {
  return apiCall<AdminDispatchRunDailyResponse>("/api/v1/admin/dispatch/run-daily", {
    method: "POST",
    token,
  })
}

export async function reassignAdminDispatchCommande(
  token: string,
  commandeId: number,
  nouvelleTourneeId: number
) {
  return apiCall<ReassignDispatchResponse>(
    `/api/v1/admin/dispatch/commandes/${commandeId}/reassign`,
    {
      method: "PUT",
      token,
      body: { nouvelle_tournee_id: nouvelleTourneeId },
    }
  )
}

export async function updateConfirmationCOD(
  token: string,
  commandeId: number,
  statut: Exclude<StatutConfirmationCOD, "NON_CONFIRMEE">
) {
  return apiCall<ConfirmationCODResponseDTO>(`/api/commandes/cod/${commandeId}/confirmation`, {
    method: "PATCH",
    token,
    body: { statut },
  })
}

export async function batchConfirmationCOD(
  token: string,
  body: BatchConfirmationCODDTO
) {
  return apiCall<BatchConfirmationCODResponseDTO>("/api/commandes/cod/batch-confirmation", {
    method: "POST",
    token,
    body,
  })
}

export async function getAlerteCOD18h(token: string) {
  return apiCall<AlerteCOD18hDTO>("/api/commandes/cod/alerte-18h", { token })
}

export async function getBlacklistedClients(token: string) {
  return apiCall<ClientBlacklistDTO[]>("/admin/blacklist", { token })
}

export async function getAdminDashboard(
  token: string,
  periode: DashboardPeriod = "today",
  date_custom?: string,
  signal?: AbortSignal
) {
  const query = new URLSearchParams({ periode })
  if (date_custom) {
    query.set("date_custom", date_custom)
  }
  return apiCall<DashboardDTO>(`/admin/dashboard?${query.toString()}`, {
    token,
    signal,
  })
}

export async function getAdminClients(
  token: string,
  params: {
    search?: string
    page?: number
    blacklisted?: boolean
  } = {},
  signal?: AbortSignal
) {
  const query = new URLSearchParams()
  if (params.search) {
    query.set("search", params.search)
  }
  if (params.page) {
    query.set("page", String(params.page))
  }
  if (typeof params.blacklisted === "boolean") {
    query.set("blacklisted", String(params.blacklisted))
  }

  const suffix = query.toString() ? `?${query.toString()}` : ""
  return apiCall<AdminClientsPageDTO>(`/api/admin/clients${suffix}`, { token, signal })
}

export async function getProduitsPricing(token: string, signal?: AbortSignal): Promise<ProduitPricingListDTO> {
  return apiCall<ProduitPricingListDTO>("/api/produits/pricing", { token, signal })
}

export async function updateProduitPricing(
  token: string,
  produitId: number,
  data: ProduitPricingUpdateDTO
): Promise<ProduitPricingDTO> {
  return apiCall<ProduitPricingDTO>(`/api/produits/${produitId}/pricing`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function recalculerTousPrix(token: string): Promise<{ recalcules: number; alertes: number }> {
  return apiCall<{ recalcules: number; alertes: number }>("/api/produits/pricing/recalculer", {
    method: "POST",
    token,
  })
}

export async function blacklistClient(
  token: string,
  clientId: number,
  reason: string
) {
  return apiCall(`/admin/blacklist/${clientId}`, {
    method: "PATCH",
    token,
    body: { reason },
  })
}

export async function liftBlacklist(
  token: string,
  clientId: number,
  reason?: string
) {
  return apiCall(`/admin/blacklist/${clientId}/lift`, {
    method: "PATCH",
    token,
    body: { reason },
  })
}

export async function getBlacklistMonthlyReport(
  token: string,
  year: number,
  month: number
) {
  return apiCall<BlacklistReportDTO>(
    `/admin/blacklist/report/monthly?year=${year}&month=${month}`,
    { token }
  )
}
