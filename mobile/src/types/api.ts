export interface User {
  id: number
  email?: string
  phone?: string
  role: string
  legacy_role?: string | null
  roles: string[]
  permissions: string[]
  is_verified: boolean
  is_active: boolean
  default_dashboard: string
}

export interface AuthResponse {
  access_token: string
  token_type?: string
  // L'utilisateur complet est renvoye par les endpoints de login pour eviter
  // un second appel /auth/me (connexion instantanee).
  user?: User
}

export type ProduitNiveau = 1 | 2 | 3

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

export interface ManualBasketResponse {
  status: string
  panier_id: number
  total_dh: number
  nombre_articles: number
  frais_livraison: number
}

export interface PanierDetailsResponse {
  panier_id: number
  lignes: Array<{
    product_id: number
    nom_produit: string
    quantite_kg: number
    prix_unitaire: number
    sous_total: number
    unite: string
    image?: string
  }>
  sous_total: number
  frais_livraison: number
  montant_total: number
}

export interface CommandeCheckoutResponse {
  commande_id: number
  total_dh: number
}

export interface TourneeItem {
  commande_id: number
  client_phone: string | null
  client_label: string
  full_address: string
  statut: string
  status_version: number
  montant_total: number
  mode_paiement: string | null
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

export interface ProfileData {
  prenom: string
  nom: string
  email: string
  telephone: string
  photo_url?: string | null
  avatar_url?: string | null
  email_verified: boolean
  address: {
    adresse: string
    ville: string
    code_postal: string
  }
}

export interface DashboardDTO {
  total_commandes: number
  commandes_livrees: number
  commandes_en_route: number
  commandes_annulees: number
  ca_total: number
  panier_moyen: number
  total_clients_actifs: number
  livreurs_disponibles: number
  jit_execute_aujourdhui: boolean
}
