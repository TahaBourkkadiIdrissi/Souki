/**
 * Formes des reponses de l'API publique, recopiees des DTO Pydantic du back-end.
 * Source de verite : back-end/dto/product_dto.py (ProductResponseDTO) et
 * back-end/controllers/category_controller.py (CatalogueCategoryDTO).
 */

export type ProduitNiveau = 1 | 2 | 3

export type ProductAvailability = "in_stock" | "preorder" | "out_of_stock"

/** GET /api/catalogue */
export interface CatalogueProductDTO {
  description?: string | null
  id: number
  nom_fr: string
  /** Nom du produit en darija, translittere en lettres latines ("batata"). */
  nom_darija: string
  /**
   * Nom en darija ecrit en lettres arabes ("بطاطا"), affiche quand l'interface est en arabe.
   * Renvoye par l'API en production ; optionnel tant que tous les back-ends ne l'exposent pas.
   */
  nom_ar?: string | null
  description_ar?: string | null
  prix_kg: number
  prix_affiche: number | null
  prix_khddar_estime: number | null
  is_active: boolean
  image_url: string | null
  niveau: ProduitNiveau
  unite: string
  stock: number
  updated_at?: string | null
  availability?: ProductAvailability
}

/** GET /api/catalogue/categories : rayon defini dans l'admin, trie par ordre. */
export interface CatalogueCategoryDTO {
  id: number
  slug: string
  nom: string
  /** Nom saisi en arabe dans l'admin (facultatif). */
  nom_ar?: string | null
  icone: string | null
  /** Produit actif dont la photo sert de tuile ; null sinon. */
  produit_vedette_id: number | null
  ordre: number
  product_ids: number[]
}

/** GET /api/order-schedule : fenetre de commande calculee par le serveur (heure du Maroc). */
export interface OrderScheduleDTO {
  closed: boolean
  server_time: string
  next_transition: string
  delivery_date: string | null
}
