import { useCallback, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  buildCatalogue,
  toCatalogueSections,
  type CatalogueCategoryDTO,
  type CatalogueProduct,
  type CatalogueProductDTO,
  type CatalogueSection,
} from "@souki/shared"

import { fetchCatalogue, fetchCatalogueCategories } from "@/lib/api"
import { readJson, writeJson } from "@/lib/local-store"

type Stored<T> = { savedAt: number; data: T } | null

const PRODUCTS_KEY = "souki_catalogue_v1"
const SECTIONS_KEY = "souki_catalogue_categories_v1"

/**
 * Requete gardee sur le telephone : au lancement, l'ecran montre tout de suite le dernier
 * catalogue recu (meme hors connexion), puis React Query le recharge s'il a vieilli.
 */
function usePersistedQuery<T>(key: string, fetcher: (signal: AbortSignal) => Promise<T>) {
  const stored = useMemo(() => readJson<Stored<T>>(key, null), [key])
  return useQuery({
    queryKey: [key],
    queryFn: async ({ signal }) => {
      const data = await fetcher(signal)
      writeJson(key, { savedAt: Date.now(), data })
      return data
    },
    initialData: stored?.data,
    initialDataUpdatedAt: stored?.savedAt,
  })
}

export type CatalogueState = {
  products: CatalogueProduct[]
  sections: CatalogueSection[]
  productsById: Map<number, CatalogueProduct>
  /** Premier chargement sans aucune donnee enregistree. */
  isLoading: boolean
  /** Echec sans donnee a montrer. */
  isError: boolean
  isRefetching: boolean
  refetch: () => Promise<void>
}

/** Produits du jour + rayons de l'admin (repli silencieux sur les rayons historiques). */
export function useCatalogue(): CatalogueState {
  const productsQuery = usePersistedQuery<CatalogueProductDTO[]>(PRODUCTS_KEY, fetchCatalogue)
  const sectionsQuery = usePersistedQuery<CatalogueCategoryDTO[]>(SECTIONS_KEY, fetchCatalogueCategories)

  const sections = useMemo(() => toCatalogueSections(sectionsQuery.data), [sectionsQuery.data])
  const products = useMemo(
    () => (productsQuery.data ? buildCatalogue(productsQuery.data, sections) : []),
    [productsQuery.data, sections],
  )
  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products])

  const { refetch: refetchProducts } = productsQuery
  const { refetch: refetchSections } = sectionsQuery
  const refetch = useCallback(async () => {
    await Promise.all([refetchProducts(), refetchSections()])
  }, [refetchProducts, refetchSections])

  return {
    products,
    sections,
    productsById,
    isLoading: productsQuery.isPending,
    isError: productsQuery.isError && !productsQuery.data,
    isRefetching: productsQuery.isRefetching,
    refetch,
  }
}
