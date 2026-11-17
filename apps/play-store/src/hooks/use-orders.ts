import { useCallback, useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getOrderHours, resolveProductImage, type CatalogueProduct, type OrderHistoryDTO, type OrderHours, type OrderProductDTO } from "@souki/shared"

import { useAuth } from "@/contexts/auth-context"
import { fetchOrderHistory } from "@/lib/api"

export const ORDERS_KEY = ["orders"] as const

/**
 * Commandes du compte (GET /api/commandes/historique), partagees entre l'historique, le
 * suivi et la reclamation. Toujours rechargees au retour sur l'ecran (statut en direct).
 */
export function useOrders() {
  const { status } = useAuth()
  const query = useQuery({
    queryKey: ORDERS_KEY,
    queryFn: ({ signal }) => fetchOrderHistory(signal),
    enabled: status === "signedIn",
    staleTime: 0,
  })
  const refetch = useCallback(async () => {
    await query.refetch()
  }, [query])
  return { orders: query.data ?? [], isLoading: query.isLoading, isError: query.isError && !query.data, refetch }
}

export function useOrder(id: number) {
  const { orders, ...rest } = useOrders()
  return { order: orders.find((order) => order.id === id) ?? null, ...rest }
}

/** Apres une modification, une annulation ou une reclamation : l'historique se recharge. */
export function useInvalidateOrders() {
  const client = useQueryClient()
  return useCallback(() => client.invalidateQueries({ queryKey: ORDERS_KEY }), [client])
}

/** Photo d'une ligne : celle du catalogue du jour, sinon la photo du produit par son nom. */
export function orderLineImage(line: OrderProductDTO, productsById: Map<number, CatalogueProduct>): string {
  const live = line.product_id ? productsById.get(line.product_id) : undefined
  return live?.image ?? resolveProductImage(line.nom_fr, null)
}

/** Vignettes d'une commande (toutes les lignes). */
export function orderImages(order: OrderHistoryDTO, productsById: Map<number, CatalogueProduct>): string[] {
  return order.produits.map((line) => orderLineImage(line, productsById))
}

/**
 * Fenetre de commande pour « Gérer » (ferme 01h-08h, date de livraison en cours), relue
 * toutes les 30 s : l'historique ne se redessine pas chaque seconde. Le serveur redit
 * `editable` a l'ouverture de « Gérer ».
 */
export function useOrderWindow(): { closed: boolean; deliveryDate: string | null } {
  const [orderWindow, setOrderWindow] = useState(() => pickWindow(getOrderHours()))
  useEffect(() => {
    const timer = setInterval(() => {
      const next = pickWindow(getOrderHours())
      setOrderWindow((current) => (current.closed === next.closed && current.deliveryDate === next.deliveryDate ? current : next))
    }, 30_000)
    return () => clearInterval(timer)
  }, [])
  return orderWindow
}

function pickWindow(hours: OrderHours) {
  return { closed: hours.closed, deliveryDate: hours.deliveryDate }
}
