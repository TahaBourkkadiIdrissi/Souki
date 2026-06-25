// On passe TOUJOURS par le proxy same-origin /backend (dev comme prod). Cela rend le
// cookie d'authentification httpOnly first-party (envoye automatiquement par le navigateur,
// SameSite=Lax sans contrainte HTTPS en dev) et supprime tout host code en dur.
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
  cache?: RequestCache
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
  ordre_passage?: number | null
  fournisseur_id?: number | null
  fournisseur_nom?: string | null
  fournisseur_shop_name?: string | null
  fournisseur_address?: string | null
  fournisseur_ville?: string | null
  fournisseur_phone?: string | null
  fournisseur_latitude?: number | null
  fournisseur_longitude?: number | null
  pickup_lat?: number | null
  pickup_lng?: number | null
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
  tournee_id: number | null
  pickup: {
    fournisseur_id: number | null
    shop_name: string | null
    address: string | null
    ville: string | null
    phone: string | null
    latitude: number | null
    longitude: number | null
  } | null
  ramassee: boolean
  ramasse_at: string | null
  items: TourneeItem[]
}

export interface RamassageResponse {
  status: string
  tournee_id: number
  ramasse_at: string
  commandes_ramassees: number
  idempotent: boolean
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

export interface AdminDispatchProduit {
  ligne_panier_id: number | null
  product_id: number | null
  nom_fr: string
  quantite_kg: number
  sous_total: number | null
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
  retour_depot_at?: string | null
  produits?: AdminDispatchProduit[]
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
  pickup?: {
    fournisseur_id: number | null
    shop_name: string | null
    address: string | null
    ville: string | null
    phone: string | null
    latitude: number | null
    longitude: number | null
  }
  commandes: AdminDispatchCommande[]
}

export interface AdminDispatchAnomalie {
  id: number
  commande_id: number
  type_anomalie: string
  detected_at: string | null
  resolved_at: string | null
  resolution: string | null
  date_tournee_ratee: string | null
  livreur_defaillant: AdminDispatchLivreur
  commande: AdminDispatchCommande | null
}

export interface AdminDispatchTourneesResponse {
  status: string
  target_date: string
  tournees: AdminDispatchTournee[]
  anomalies?: AdminDispatchAnomalie[]
}

export interface AdminDispatchRunDailyResponse {
  status: string
  target_date: string
  count?: number
  tournees_created?: number
  commandes_assigned?: number
  available_livreurs?: number
  retours_depot?: number
}

export interface ReassignDispatchResponse {
  status: string
  commande_id: number
  nouvelle_tournee_id: number
  ordre_passage: number
}

export interface ResolveAnomalieResponse {
  status: string
  anomalie_id: number
  commande_id: number
  resolution: string
  nouveau_statut: string
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

export interface JITZoneExecutionResult {
  statut: string
  log_id?: number | null
  volume_total_kg?: number
  nombre_commandes?: number
  nombre_verrouillees?: number
  montant_total?: number
  message?: string | null
}

export interface JITExecutionResponse {
  statut: string
  zones: Record<string, JITZoneExecutionResult>
  nombre_zones: number
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

export interface JITDernierLogResponse {
  logs: JITLogDTO[]
  nombre: number
  mode: "regional" | "global"
}

export interface DeliveryEventRequest {
  target_status: "EN_ROUTE" | "LIVRE" | "ABSENT" | "REFUS"
  client_event_id: string
  device_timestamp: string
  expected_version?: number
}

export interface LivraisonDecisionRequest {
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

export interface TourneeRefusResponse {
  status: string
  client_event_id: string
  commandes_refusees: number
  commande_ids: number[]
  dispatch_reassign_triggered: boolean
  dispatch_status?: string | null
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
  is_blacklisted?: boolean | null
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
  is_active: boolean
  image_url: string | null
  marge_cible: number
  coussin_securite: number
  niveau: ProduitNiveau
  volatilite: ProduitVolatilite
  prix_gros_saisi: number | null
  prix_khddar_reel: number | null
  prix_affiche: number | null
  prix_vente_manuel: number | null
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
  prix_khddar_reel?: number | null
  prix_vente_manuel?: number | null
}

export interface ProductCreateDTO {
  nom_fr: string
  nom_darija: string
  prix_kg: number
  unite: string
  niveau: ProduitNiveau
  marge_cible: number
  coussin_securite: number
  volatilite: ProduitVolatilite
  prix_gros_saisi?: number | null
  prix_khddar_reel?: number | null
  prix_vente_manuel?: number | null
}

export interface ProductImageDTO {
  image_url: string
}

export interface CatalogueProductDTO {
  id: number
  nom_fr: string
  nom_darija: string
  prix_kg: number
  prix_affiche: number | null
  prix_khddar_estime: number | null
  is_active: boolean
  image_url: string | null
  niveau: ProduitNiveau
  unite: string
  stock: number
}

export type ProduitSuggestionDTO = CatalogueProductDTO

export interface SuggestionsRequestDTO {
  exclude_ids: number[]
  panier_total: number
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
  panier_moyen_precedent: number
  marge_brute: number
  marge_brute_precedent: number
  taux_marge: number
  parrainages_en_attente: number
  filleuls_convertis: number
  credit_parrainage_distribue: number
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

export interface BlacklistStatusDTO {
  is_blacklisted: boolean
  last_action: string | null
  last_reason: string | null
  last_date: string | null
  lift_notification_seen: boolean
}

export interface LiftRequestDTO {
  motif: string
}

export interface LiftRejectDTO {
  motif: string
}

export interface PendingLiftRequestDTO {
  log_id: number
  client_id: number
  client_label: string | null
  phone: string | null
  motif: string | null
  created_at: string
}

export async function apiCall<T = any>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...options.headers,
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  const fetchOptions: RequestInit = {
    method: options.method || "GET",
    headers,
    signal: options.signal,
    cache: options.cache,
    // Envoie le cookie httpOnly d'authentification.
    credentials: "include",
  }

  if (options.body !== undefined) {
    fetchOptions.body = isFormData ? options.body as BodyInit : JSON.stringify(options.body)
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

export interface AdminCommandeException {
  id: number
  statut: string | null
  raisons: string[]
  date_commande: string | null
  client_nom: string
  client_phone: string | null
  ville: string | null
  montant_total: number
  fournisseur_id: number | null
  fournisseur_nom: string | null
  tournee_id: number | null
  livreur_id: number | null
}

export interface AdminCommandeExceptionsPage {
  status: string
  items: AdminCommandeException[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export async function confirmerRamassageLivreur(token: string, tourneeId: number) {
  return apiCall<RamassageResponse>(`/api/livreur/tournees/${tourneeId}/ramassage`, {
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

export async function refuserTourneeLivreur(token: string, body: LivraisonDecisionRequest) {
  return apiCall<TourneeRefusResponse>("/api/livreur/tournee/refuser", {
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
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), 30000)

  try {
    return await apiCall<JITExecutionResponse>("/api/jit/executer", {
      method: "POST",
      token,
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(408, "Le backend ne répond pas pour le lancement JIT. Vérifiez que l'API est démarrée et accessible.")
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export async function jitDeverrouiller(token: string) {
  return apiCall<JITDeverrouillerResponse>("/api/jit/deverrouiller", {
    method: "POST",
    token,
  })
}

export async function jitDernierLog(token: string) {
  const response = await apiCall<JITDernierLogResponse>("/api/jit/logs/dernier", { token })
  const logs = [...(response.logs || [])]
  logs.sort((a, b) => {
    const dateA = a.date_execution ? new Date(a.date_execution).getTime() : 0
    const dateB = b.date_execution ? new Date(b.date_execution).getTime() : 0
    return dateB - dateA
  })

  if (!logs[0]) {
    throw new ApiError(404, "Aucun log JIT trouvé")
  }

  return logs[0]
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
  signal?: AbortSignal
) {
  return apiCall<AdminDispatchTourneesResponse>(`/api/v1/admin/dispatch/tournees?_=${Date.now()}`, {
    token,
    signal,
    cache: "no-store",
    headers: {
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    },
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

export async function getAdminCommandeExceptions(
  token: string,
  params: {
    raison?: string
    search?: string
    date_from?: string
    date_to?: string
    page?: number
    page_size?: number
  } = {},
) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value))
  })
  return apiCall<AdminCommandeExceptionsPage>(
    `/api/admin/commandes/exceptions${query.size ? `?${query}` : ""}`,
    { token, cache: "no-store" },
  )
}

export async function rattacherAdminCommandeFournisseur(
  token: string,
  commandeId: number,
  fournisseurId: number,
) {
  return apiCall(`/api/admin/commandes/${commandeId}/rattacher-fournisseur`, {
    method: "POST",
    token,
    body: { fournisseur_id: fournisseurId },
  })
}

export async function replanifierAdminCommande(token: string, commandeId: number) {
  return apiCall(`/api/admin/commandes/${commandeId}/replanifier`, {
    method: "POST",
    token,
  })
}

export async function annulerAdminCommande(token: string, commandeId: number) {
  return apiCall(`/api/admin/commandes/${commandeId}/annuler`, {
    method: "POST",
    token,
  })
}

export async function reassignerAdminCommandeException(
  token: string,
  commandeId: number,
  nouvelleTourneeId: number,
) {
  return apiCall(`/api/admin/commandes/${commandeId}/reassigner`, {
    method: "POST",
    token,
    body: { nouvelle_tournee_id: nouvelleTourneeId },
  })
}

export async function replanifierAdminAnomalie(token: string, anomalieId: number) {
  return apiCall<ResolveAnomalieResponse>(
    `/api/v1/admin/anomalies/${anomalieId}/replanifier`,
    {
      method: "POST",
      token,
    }
  )
}

export async function annulerAdminAnomalie(token: string, anomalieId: number) {
  return apiCall<ResolveAnomalieResponse>(
    `/api/v1/admin/anomalies/${anomalieId}/annuler`,
    {
      method: "POST",
      token,
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

export async function getBlacklistStatus(token: string) {
  return apiCall<BlacklistStatusDTO>("/api/client/blacklist/status", { token })
}

export async function requestBlacklistLift(token: string, motif: string) {
  return apiCall<{ message: string }>("/api/client/blacklist/lift-request", {
    method: "POST",
    token,
    body: { motif } satisfies LiftRequestDTO,
  })
}

export async function markBlacklistLiftNotificationSeen(token: string): Promise<void> {
  await apiCall<{ ok: boolean }>("/api/client/blacklist/lift-notification-seen", {
    method: "PATCH",
    token,
  })
}

export async function getPendingLiftRequests(token: string) {
  return apiCall<PendingLiftRequestDTO[]>("/admin/blacklist/lift-requests", { token })
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

export interface ParrainageAdminItemDTO {
  id: number
  parrain_id: number
  parrain_contact: string | null
  code_utilise: string
  filleul_id: number
  filleul_contact: string | null
  statut: string
  credit_total: number
  created_at: string | null
  converted_at: string | null
}

export interface ParrainageTopParrainDTO {
  parrain_id: number
  parrain_contact: string | null
  filleuls_convertis: number
  credit_genere: number
}

export interface ParrainageAdminOverviewDTO {
  total: number
  en_attente: number
  convertis: number
  rejetes: number
  taux_conversion: number
  credit_distribue: number
  top_parrains: ParrainageTopParrainDTO[]
  recent: ParrainageAdminItemDTO[]
}

export async function getAdminParrainages(token: string, signal?: AbortSignal) {
  return apiCall<ParrainageAdminOverviewDTO>("/admin/parrainages", { token, signal })
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

export async function createProduit(token: string, data: ProductCreateDTO): Promise<ProduitPricingDTO> {
  return apiCall<ProduitPricingDTO>("/api/produits", {
    method: "POST",
    token,
    body: data,
  })
}

export async function deleteProduit(token: string, produitId: number): Promise<{ success: boolean; message: string }> {
  return apiCall<{ success: boolean; message: string }>(`/api/produits/${produitId}`, {
    method: "DELETE",
    token,
  })
}

export async function uploadProduitImage(
  token: string,
  produitId: number,
  file: File
): Promise<ProduitPricingDTO> {
  const formData = new FormData()
  formData.append("file", file)

  return apiCall<ProduitPricingDTO>(`/api/produits/${produitId}/image/upload`, {
    method: "POST",
    token,
    body: formData,
  })
}

export async function updateProduitImageUrl(
  token: string,
  produitId: number,
  imageUrl: string
): Promise<ProduitPricingDTO> {
  return apiCall<ProduitPricingDTO>(`/api/produits/${produitId}/image/url`, {
    method: "PATCH",
    token,
    body: { image_url: imageUrl } satisfies ProductImageDTO,
  })
}

export async function getCatalogueSuggestions(
  excludeIds: number[],
  panierTotal: number,
  signal?: AbortSignal
): Promise<ProduitSuggestionDTO[]> {
  return apiCall<ProduitSuggestionDTO[]>("/api/catalogue/suggestions", {
    method: "POST",
    body: {
      exclude_ids: excludeIds.slice(0, 20),
      panier_total: panierTotal,
    } satisfies SuggestionsRequestDTO,
    signal,
  })
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

export async function rejectLiftRequest(
  token: string,
  clientId: number,
  motif: string
) {
  return apiCall(`/admin/blacklist/${clientId}/lift-reject`, {
    method: "POST",
    token,
    body: { motif } satisfies LiftRejectDTO,
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

export async function fetchUserFavorites(token: string): Promise<CatalogueProductDTO[]> {
  try {
    const orders = await apiCall<CommandeHistoriqueDTO[]>("/api/commandes/historique", { token })
    const productCounts: Record<string, { product: ProduitCommandeJourDTO; count: number }> = {}

    for (const order of orders) {
      if (order.produits) {
        for (const ligne of order.produits) {
          const key = ligne.product_id?.toString() || ligne.nom_fr
          if (!productCounts[key]) {
            productCounts[key] = { product: ligne, count: 0 }
          }
          productCounts[key].count++
        }
      }
    }

    // Return top 8 most ordered products mapped to CatalogueProductDTO shape
    return Object.values(productCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map(item => ({
        id: item.product.product_id ?? 0,
        nom_fr: item.product.nom_fr,
        nom_darija: "",
        prix_kg: item.product.sous_total ? item.product.sous_total / (item.product.quantite_kg || 1) : 0,
        prix_affiche: item.product.sous_total ? item.product.sous_total / (item.product.quantite_kg || 1) : null,
        prix_khddar_estime: null,
        is_active: true,
        image_url: item.product.image ?? null,
        niveau: 1 as ProduitNiveau,
        unite: "kg",
        stock: 100,
      }))
  } catch {
    return []
  }
}

export async function generateParrainageCode(token: string): Promise<{ code_parrainage: string }> {
  return apiCall<{ code_parrainage: string }>("/api/user/parrainage/generate", {
    method: "POST",
    token,
  })
}
