"use client"

import { useCallback, useEffect, useState, type SyntheticEvent } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ChevronDown,
  Clock,
  AlertCircle,
  Filter,
  History,
  Leaf,
  Menu,
  MessageCircle,
  PackageCheck,
  ReceiptText,
  Search,
  ShoppingCart,
  Trash2,
  X,
  Zap,
  Minus,
  Plus,
} from "lucide-react"

import { AIModals } from "@/components/souki/ai-modals"
import { ProductCard } from "@/components/souki/product-card"
import { useAuth } from "@/hooks/useAuth"
import type { CommandeHistoriqueDTO, ProduitSuggestionDTO } from "@/lib/api"
import { getCatalogueSuggestions } from "@/lib/api"
import {
  BasketSelection,
  CatalogueProduct,
  ClaimReason,
  CartItem,
  deleteOrderFromHistory,
  fetchCommandeCheckout,
  fetchCatalogueProducts,
  fetchOrderHistory,
  fetchPanierDetails,
  formatQuantity,
  getCataloguePresentation,
  loadStoredCart,
  mergeSelectionsIntoCart,
  saveStoredCart,
  submitClaim,
  submitManualBasket,
  upsertCartItem,
} from "@/lib/catalogue"
import { cn } from "@/lib/utils"

const CATALOGUE_REFRESH_INTERVAL_MS = 5 * 60 * 1000
const CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000
const SEUIL = 300
const FRAIS = 15
const DEFAULT_CATALOGUE_IMAGE = getCataloguePresentation("").image

const applyImageFallback = (
  event: SyntheticEvent<HTMLImageElement>,
  fallbackImage?: string
) => {
  const resolvedFallback = fallbackImage || DEFAULT_CATALOGUE_IMAGE
  event.currentTarget.onerror = null
  event.currentTarget.src = resolvedFallback
}

const categories = [
  { id: "tous", label: "Tous" },
  { id: "legumes", label: "Legumes" },
  { id: "fruits", label: "Fruits" },
  { id: "herbes", label: "Herbes" },
] as const

const sortOptions = [
  { id: "popular", label: "Pertinence" },
  { id: "price-asc", label: "Prix croissant" },
  { id: "price-desc", label: "Prix decroissant" },
  { id: "name", label: "Ordre alphabetique" },
] as const

const claimReasonOptions: Array<{ id: ClaimReason; label: string }> = [
  { id: "abime", label: "Produit abime" },
  { id: "poids_incorrect", label: "Poids incorrect" },
  { id: "erreur_produit", label: "Erreur de produit" },
  { id: "produit_manquant", label: "Produit manquant" },
  { id: "qualite", label: "Qualite insuffisante" },
  { id: "autre", label: "Autre probleme" },
]

const formatOrderDate = (value?: string | null) => {
  if (!value) {
    return "Date non disponible"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "Date non disponible"
  }

  return new Intl.DateTimeFormat("fr-MA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

const getOrderStatusLabel = (status?: string | null) => {
  const normalizedStatus = (status || "").toUpperCase()
  const labels: Record<string, string> = {
    EN_ATTENTE: "En attente",
    EN_ROUTE: "En route",
    LIVRE: "Livree",
    ABSENT: "Absent",
    REFUS: "Refusee",
    ANNULE: "Annulee",
  }
  return labels[normalizedStatus] || status || "Statut inconnu"
}

const getOrderStatusClassName = (status?: string | null) => {
  const normalizedStatus = (status || "").toUpperCase()
  if (normalizedStatus === "LIVRE") {
    return "border-[#BFE6C4] bg-[#EAF8EC] text-[#1E8A3C]"
  }
  if (normalizedStatus === "EN_ROUTE") {
    return "border-[#B9D7F2] bg-[#EEF7FF] text-[#1A5F96]"
  }
  if (normalizedStatus === "ABSENT" || normalizedStatus === "REFUS" || normalizedStatus === "ANNULE") {
    return "border-[#F1C6C6] bg-[#FFF1F1] text-[#B42318]"
  }
  return "border-[#F5D7B8] bg-[#FFF7EE] text-[#9A5C11]"
}

const formatPaymentMode = (mode?: string | null) => {
  const normalizedMode = (mode || "").toLowerCase()
  const labels: Record<string, string> = {
    cod: "Cash a la livraison",
    cash: "Cash a la livraison",
    wallet: "Wallet SOUKI",
    cmi: "Carte bancaire CMI",
  }
  return labels[normalizedMode] || mode || "Paiement non precise"
}

const formatDh = (value: string | number) => `${Number(value || 0).toFixed(2)} DH`

const parseDate = (value?: string | null) => {
  if (!value) {
    return null
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const canClaimOrder = (order: CommandeHistoriqueDTO) => {
  if ((order.statut || "").toUpperCase() !== "LIVRE") {
    return false
  }
  const deliveredAt = parseDate(order.delivered_at)
  if (!deliveredAt) {
    return false
  }
  const elapsedMs = Date.now() - deliveredAt.getTime()
  return elapsedMs >= 0 && elapsedMs <= CLAIM_WINDOW_MS
}

const getClaimWindowLabel = (order: CommandeHistoriqueDTO) => {
  const deliveredAt = parseDate(order.delivered_at)
  if (!deliveredAt) {
    return "Disponible apres livraison"
  }
  const deadline = new Date(deliveredAt.getTime() + CLAIM_WINDOW_MS)
  if (Date.now() > deadline.getTime()) {
    return "Delai SAV expire"
  }
  return `SAV ouvert jusqu'au ${formatOrderDate(deadline.toISOString())}`
}

export default function CataloguePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading } = useAuth()

  const [products, setProducts] = useState<CatalogueProduct[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCategory, setSelectedCategory] =
    useState<(typeof categories)[number]["id"]>("tous")
  const [sortBy, setSortBy] = useState<(typeof sortOptions)[number]["id"]>("popular")
  const [searchQuery, setSearchQuery] = useState("")
  const [showSidebar, setShowSidebar] = useState(false)
  const [showCart, setShowCart] = useState(false)
  const [activeModal, setActiveModal] = useState<"voice" | "smart" | null>(null)
  const [isFetching, setIsFetching] = useState(true)
  const [error, setError] = useState("")
  const [isSubmittingCart, setIsSubmittingCart] = useState(false)
  const [orderHistory, setOrderHistory] = useState<CommandeHistoriqueDTO[]>([])
  const [isFetchingHistory, setIsFetchingHistory] = useState(false)
  const [historyError, setHistoryError] = useState("")
  const [showOrderHistory, setShowOrderHistory] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")
  const [claimOrder, setClaimOrder] = useState<CommandeHistoriqueDTO | null>(null)
  const [claimLineId, setClaimLineId] = useState<number | null>(null)
  const [claimQuantity, setClaimQuantity] = useState("1")
  const [claimReason, setClaimReason] = useState<ClaimReason>("abime")
  const [claimError, setClaimError] = useState("")
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false)
  const [deletingOrderId, setDeletingOrderId] = useState<number | null>(null)
  const [pricingSuggestions, setPricingSuggestions] = useState<CatalogueProduct[]>([])
  const [addedSuggestionIds, setAddedSuggestionIds] = useState<number[]>([])

  const toCatalogueProduct = (product: ProduitSuggestionDTO): CatalogueProduct => {
    const presentation = getCataloguePresentation(product.nom_fr)
    return {
      id: product.id,
      name: product.nom_fr,
      alias: product.nom_darija,
      price: product.prix_affiche ?? product.prix_kg,
      prix_khddar_estime: product.prix_khddar_estime,
      niveau: product.niveau,
      unit: product.unite,
      displayUnit: presentation.displayUnit || product.unite,
      image: product.image_url || presentation.image,
      fallbackImage: presentation.image,
      category: presentation.category,
      quantityStep: presentation.quantityStep || (product.unite === "kg" ? 0.5 : 1),
      stock: product.stock,
    }
  }

  const loadOrderHistory = useCallback(async (showLoader = true) => {
    if (!isAuthenticated) {
      setOrderHistory([])
      setHistoryError("")
      return
    }

    try {
      if (showLoader) {
        setIsFetchingHistory(true)
      }
      const history = await fetchOrderHistory()
      setOrderHistory(history)
      setHistoryError("")
    } catch (fetchError) {
      setHistoryError("Impossible de charger votre historique pour le moment.")
    } finally {
      if (showLoader) {
        setIsFetchingHistory(false)
      }
    }
  }, [isAuthenticated])

  useEffect(() => {
    let isMounted = true

    const loadCatalogue = async (showLoader = false) => {
      try {
        if (showLoader && isMounted) {
          setIsFetching(true)
        }
        const catalogue = await fetchCatalogueProducts()
        if (!isMounted) {
          return
        }
        setError("")
        setProducts(catalogue)
        setCart((currentCart) =>
          currentCart.map((item) => {
            const updated = catalogue.find((product) => product.id === item.id)
            return updated ? { ...item, price: updated.price } : item
          })
        )
      } catch (fetchError) {
        if (isMounted && showLoader) {
          setError("Impossible de charger le catalogue pour le moment.")
        }
      } finally {
        if (showLoader && isMounted) {
          setIsFetching(false)
        }
      }
    }

    loadCatalogue(true)
    setCart(loadStoredCart())
    const interval = window.setInterval(() => {
      loadCatalogue()
    }, CATALOGUE_REFRESH_INTERVAL_MS)

    return () => {
      isMounted = false
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    saveStoredCart(cart)
  }, [cart])

  useEffect(() => {
    if (isLoading || !isAuthenticated || cart.length === 0) {
      setPricingSuggestions([])
      return
    }

    const controller = new AbortController()
    const excludeIds = cart.map((item) => item.id)
    const panierTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

    getCatalogueSuggestions(excludeIds, panierTotal, controller.signal)
      .then((suggestions) => {
        setPricingSuggestions(suggestions.map(toCatalogueProduct))
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }
        setPricingSuggestions([])
      })

    return () => controller.abort()
  }, [cart, isAuthenticated, isLoading])

  useEffect(() => {
    if (isLoading) {
      return
    }

    if (!isAuthenticated) {
      setOrderHistory([])
      setHistoryError("")
      return
    }

    void loadOrderHistory()
  }, [isAuthenticated, isLoading, loadOrderHistory])

  useEffect(() => {
    const validatedOrderId = searchParams.get("commande_validee")
    if (!validatedOrderId) {
      return
    }

    setSuccessMessage(`Votre commande N-${validatedOrderId} a ete enregistree avec succes.`)
    setShowOrderHistory(true)
    router.replace("/catalogue")
  }, [router, searchParams])

  useEffect(() => {
    const assistantMode = searchParams.get("assistant")
    if (!assistantMode || isLoading || !isAuthenticated) {
      return
    }

    if (assistantMode === "voice" || assistantMode === "smart") {
      setActiveModal(assistantMode)
    }
  }, [isAuthenticated, isLoading, searchParams])

  useEffect(() => {
    const panierIdParam = searchParams.get("panier_id")
    const commandeIdParam = searchParams.get("commande_id")

    if (!isAuthenticated || products.length === 0 || (!panierIdParam && !commandeIdParam)) {
      return
    }

    const syncExistingOrderToCart = async () => {
      try {
        let remoteLines:
          | Array<{
              product_id: number
              quantite_kg?: number
              quantite_effective?: number
            }>
          | null = null

        if (panierIdParam) {
          const panierId = Number(panierIdParam)
          if (!Number.isFinite(panierId)) {
            return
          }
          const panierDetails = await fetchPanierDetails(panierId)
          remoteLines = panierDetails.lignes
        } else if (commandeIdParam) {
          const commandeId = Number(commandeIdParam)
          if (!Number.isFinite(commandeId)) {
            return
          }
          const commandeDetails = await fetchCommandeCheckout(commandeId)
          remoteLines = commandeDetails.lignes
        }

        if (!remoteLines || remoteLines.length === 0) {
          return
        }

        const rebuiltCart = remoteLines.reduce<CartItem[]>((acc, line) => {
          const product = products.find((item) => item.id === line.product_id)
          if (!product) {
            return acc
          }
          const quantity = Number(line.quantite_kg ?? line.quantite_effective ?? 0)
          if (!Number.isFinite(quantity) || quantity <= 0) {
            return acc
          }
          return upsertCartItem(acc, product, quantity)
        }, [])

        if (rebuiltCart.length > 0) {
          setCart(rebuiltCart)
          setShowCart(true)
        }
      } catch (error) {
        console.error("Impossible de recharger la commande à modifier:", error)
      } finally {
        router.replace("/catalogue")
      }
    }

    void syncExistingOrderToCart()
  }, [isAuthenticated, products, searchParams, router])

  useEffect(() => {
    const addProductName = searchParams.get("add_product")
    const qtyStr = searchParams.get("qty")
    if (addProductName && qtyStr && products.length > 0 && isAuthenticated) {
      const qty = Number(qtyStr)
      const product = products.find((p) => p.name === addProductName)
      if (product && !Number.isNaN(qty)) {
        setCart((currentCart) => upsertCartItem(currentCart, product, qty))
        setShowCart(true)
        router.replace("/catalogue")
      }
    }
  }, [searchParams, products, isAuthenticated, router])

  const redirectToLogin = (redirectTarget: string) => {
    router.push(`/login?redirect=${encodeURIComponent(redirectTarget)}`)
  }

  const requireAuth = (redirectTarget: string, action: () => void) => {
    if (isLoading) {
      return
    }
    if (!isAuthenticated) {
      redirectToLogin(redirectTarget)
      return
    }
    action()
  }

  const handleAddToCart = (id: number | string, quantity: number) => {
    requireAuth("/catalogue", () => {
      const normalizedId = Number(id)
      const product = products.find((item) => item.id === normalizedId)
      if (!product) {
        return
      }
      setCart((currentCart) => upsertCartItem(currentCart, product, quantity))
      setShowCart(true)
    })
  }

  const handleAddSuggestionToCart = (product: CatalogueProduct) => {
    requireAuth("/catalogue", () => {
      setAddedSuggestionIds((currentIds) =>
        currentIds.includes(product.id) ? currentIds : [...currentIds, product.id]
      )
      setCart((currentCart) => upsertCartItem(currentCart, product, product.quantityStep))
      setShowCart(true)
    })
  }

  const handleApplySelections = (selections: BasketSelection[]) => {
    requireAuth("/catalogue", () => {
      setCart((currentCart) => mergeSelectionsIntoCart(currentCart, products, selections))
      setShowCart(true)
    })
  }

  const updateCartQuantity = (id: number, delta: number) => {
    setCart((currentCart) =>
      currentCart
        .map((item) => {
          if (item.id !== id) {
            return item
          }
          const nextQuantity = Number((item.quantity + delta).toFixed(2))
          if (nextQuantity <= 0) {
            return null
          }
          return { ...item, quantity: nextQuantity }
        })
        .filter((item): item is CartItem => item !== null)
    )
  }

  const removeFromCart = (id: number) => {
    setCart((currentCart) => currentCart.filter((item) => item.id !== id))
  }

  const openClaimModal = (order: CommandeHistoriqueDTO) => {
    const claimableLines = order.produits.filter(
      (product) => typeof product.ligne_panier_id === "number" && product.quantite_kg > 0
    )
    if (!canClaimOrder(order)) {
      alert(getClaimWindowLabel(order))
      return
    }
    if (claimableLines.length === 0) {
      alert("Cette commande ne contient aucune ligne eligible au SAV.")
      return
    }
    const firstLine = claimableLines[0]
    setClaimOrder(order)
    setClaimLineId(firstLine.ligne_panier_id ?? null)
    setClaimQuantity(String(Math.min(1, firstLine.quantite_kg)))
    setClaimReason("abime")
    setClaimError("")
  }

  const closeClaimModal = () => {
    if (isSubmittingClaim) {
      return
    }
    setClaimOrder(null)
    setClaimLineId(null)
    setClaimError("")
  }

  const handleSubmitClaim = async () => {
    if (!claimOrder || claimLineId === null) {
      return
    }
    const selectedLine = claimOrder.produits.find((product) => product.ligne_panier_id === claimLineId)
    if (!selectedLine || typeof selectedLine.ligne_panier_id !== "number") {
      setClaimError("Selection de produit invalide.")
      return
    }
    const normalizedQuantity = Number(claimQuantity.replace(",", "."))
    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      setClaimError("La quantite reclamee doit etre positive.")
      return
    }
    if (normalizedQuantity > selectedLine.quantite_kg) {
      setClaimError("La quantite reclamee depasse la quantite commandee.")
      return
    }

    setIsSubmittingClaim(true)
    setClaimError("")
    try {
      const result = await submitClaim({
        commande_id: claimOrder.id,
        items: [
          {
            ligne_panier_id: selectedLine.ligne_panier_id,
            quantity_claimed: normalizedQuantity,
            reason: claimReason,
          },
        ],
      })
      setSuccessMessage(
        `Reclamation envoyee. ${formatDh(result.amount_refunded)} ont ete credites sur votre wallet SOUKI. Nouveau solde: ${formatDh(result.new_wallet_balance)}.`
      )
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("souki-wallet-updated", {
            detail: { balance: result.new_wallet_balance },
          })
        )
      }
      setClaimOrder(null)
      await loadOrderHistory(false)
    } catch (error) {
      setClaimError(error instanceof Error ? error.message : "Impossible d'envoyer la reclamation.")
    } finally {
      setIsSubmittingClaim(false)
    }
  }

  const handleDeleteOrderHistory = async (commandeId: number) => {
    const confirmed = window.confirm(
      `Supprimer la commande N-${commandeId} de votre historique ?`
    )
    if (!confirmed) {
      return
    }

    setDeletingOrderId(commandeId)
    try {
      const result = await deleteOrderFromHistory(commandeId)
      setOrderHistory((currentHistory) => currentHistory.filter((order) => order.id !== commandeId))
      setSuccessMessage(result.message || `Commande N-${commandeId} supprimee de l'historique.`)
    } catch (error) {
      setHistoryError(
        error instanceof Error ? error.message : "Impossible de supprimer cette commande de l'historique."
      )
    } finally {
      setDeletingOrderId(null)
    }
  }

  const handleCheckout = () => {
    requireAuth("/checkout", async () => {
      if (cart.length === 0) {
        alert("Votre panier est vide.")
        return
      }

      setIsSubmittingCart(true)
      try {
        const result = await submitManualBasket(cart)
        
        if (result && result.panier_id) {
          // Rediriger vers checkout avec panier_id
          router.push(`/checkout?panier_id=${result.panier_id}`)
          // Vider le panier local après succès
          saveStoredCart([])
        } else {
          alert("Erreur: réponse inattendue du serveur")
        }
      } catch (error: any) {
        const errorMsg = 
          error?.message || 
          error?.detail || 
          "Erreur lors de la création du panier"
        alert(errorMsg)
      } finally {
        setIsSubmittingCart(false)
      }
    })
  }

  const filteredProducts = products
    .filter((product) => {
      if (selectedCategory !== "tous" && product.category !== selectedCategory) {
        return false
      }

      if (!searchQuery.trim()) {
        return true
      }

      const normalizedQuery = searchQuery.toLowerCase()
      return (
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.alias.toLowerCase().includes(normalizedQuery)
      )
    })
    .sort((left, right) => {
      if (sortBy === "price-asc") {
        return left.price - right.price
      }
      if (sortBy === "price-desc") {
        return right.price - left.price
      }
      if (sortBy === "name") {
        return left.name.localeCompare(right.name)
      }
      return left.id - right.id
    })

  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const reste = Math.max(0, SEUIL - cartSubtotal)
  const progression = Math.min(100, (cartSubtotal / SEUIL) * 100)
  const cartDeliveryFee = cartSubtotal >= SEUIL ? 0 : FRAIS
  const cartTotal = cartSubtotal + cartDeliveryFee
  const firstLevelTwoSuggestionId = pricingSuggestions.find(
    (suggestion) => suggestion.niveau === 2
  )?.id
  const addedSuggestionItems = cart.filter((item) => addedSuggestionIds.includes(item.id))
  const suggestionSavings = addedSuggestionItems.reduce(
    (sum, item) => sum + item.price * 0.12,
    0
  )
  const claimableLines =
    claimOrder?.produits.filter(
      (product) => typeof product.ligne_panier_id === "number" && product.quantite_kg > 0
    ) ?? []
  const selectedClaimLine = claimableLines.find((product) => product.ligne_panier_id === claimLineId)
  const resolveOrderProductImage = (product: CommandeHistoriqueDTO["produits"][number]) => {
    if (product.image) {
      return product.image
    }
    const catalogueProduct = products.find((item) => item.id === product.product_id)
    return catalogueProduct?.image || getCataloguePresentation(product.nom_fr).image
  }

  return (
    <div className="min-h-screen bg-[#FBFDF9]">
      <div className="bg-[#F07C00] px-4 py-3 text-center text-sm font-semibold text-white">
        Commandes ouvertes - Livraison demain pour garantir la fraicheur
      </div>

      <nav className="sticky top-0 z-40 border-b border-[#E7F0E8] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar((value) => !value)}
              className="rounded-xl p-2 text-[#264129] lg:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white p-0.5 shadow-sm">
                <img
                  src="/logo3.png"
                  alt="SOUKI"
                  className="h-full w-[175%] max-w-none object-cover"
                  style={{ objectPosition: "left center" }}
                />
              </div>
              <div className="hidden sm:block">
                <span className="block text-xl font-bold leading-none text-[#1E8A3C]">SOUKI</span>
                <span className="text-[11px] uppercase tracking-widest text-[#7B8B7D]">
                  Fresh market
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCart((value) => !value)}
              className="relative rounded-xl p-2 text-[#264129] lg:hidden"
            >
              <ShoppingCart className="h-6 w-6" />
              {cart.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#F07C00] text-xs font-bold text-white">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      <div className="mx-auto flex max-w-[1600px]">
        <aside
          className={cn(
            "fixed left-0 top-0 z-30 h-screen w-72 overflow-y-auto border-r border-[#E6F0E7] bg-[#F2FAF2] p-6 transition-transform lg:sticky lg:top-20 lg:h-[calc(100vh-80px)] lg:translate-x-0",
            showSidebar ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          <button
            onClick={() => setShowSidebar(false)}
            className="absolute right-4 top-4 rounded-xl p-2 text-[#264129] lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="space-y-8">
            <div className="rounded-3xl bg-white p-4 shadow-sm">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7B8B7D]" />
                <input
                  type="text"
                  placeholder="Rechercher un produit..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full rounded-2xl border border-[#DDE7DE] bg-[#FAFCFA] py-3 pl-10 pr-4 text-sm text-[#264129] outline-none transition-colors focus:border-[#4CB84A]"
                />
              </div>
            </div>

            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#264129]">
                <Filter className="h-4 w-4" />
                Categories
              </h3>
              <div className="space-y-2">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={cn(
                      "w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-colors",
                      selectedCategory === category.id
                        ? "bg-[#1E8A3C] text-white"
                        : "bg-white text-[#264129] hover:bg-[#E7F5E8]"
                    )}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-[#D7EBD9] bg-white p-5">
              <div className="flex items-center gap-3 text-[#1E8A3C]">
                <Clock className="h-5 w-5" />
                <span className="font-semibold">Commandes ouvertes</span>
              </div>
              <p className="mt-2 text-sm text-[#718272]">
                Livraison demain pour garantir la fraicheur.
              </p>
            </div>

            {isAuthenticated && (
              <button
                onClick={() => setShowOrderHistory(true)}
                className={cn(
                  "flex w-full items-center justify-between rounded-3xl border px-5 py-4 text-left transition-colors",
                  showOrderHistory
                    ? "border-[#BFE6C4] bg-[#EAF8EC] text-[#1E8A3C]"
                    : "border-[#D7EBD9] bg-white text-[#264129] hover:bg-[#F0FAF1]"
                )}
              >
                <span className="flex items-center gap-3 font-semibold">
                  <History className="h-5 w-5" />
                  Historique commandes
                </span>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#F07C00]">
                  {orderHistory.length}
                </span>
              </button>
            )}

            {!isAuthenticated && !isLoading && (
              <div className="rounded-3xl border border-[#F3D8B2] bg-[#FFF7EE] p-5">
                <p className="text-sm font-semibold text-[#9A5C11]">
                  Connectez-vous pour ajouter des produits au panier et valider votre commande.
                </p>
                <button
                  onClick={() => redirectToLogin("/catalogue")}
                  className="mt-4 w-full rounded-2xl bg-[#F07C00] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#D66B00]"
                >
                  Se connecter
                </button>
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mb-8 rounded-[32px] bg-gradient-to-br from-[#F7FFF6] via-white to-[#FFF7EF] p-6 shadow-[0_18px_50px_-32px_rgba(0,0,0,0.18)] lg:p-8">
            <div className="mb-6 flex flex-col gap-5">
              <div className="max-w-3xl">
                <div className="mb-3 flex items-center gap-2 text-[#1E8A3C]">
                  <Leaf className="h-6 w-6" />
                  <span className="text-sm font-bold uppercase tracking-[0.22em]">
                    Catalogue du jour
                  </span>
                </div>
                <h1 className="text-3xl font-black text-[#1E8A3C] lg:text-4xl">
                  Fruits, legumes et herbes fraiches au prix du marche
                </h1>
                <p className="mt-3 max-w-2xl text-sm text-[#6F8070] lg:text-base">
                  Le catalogue est charge depuis votre back-end. Le panier et la validation de
                  commande passent par les routes de l'application.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => requireAuth("/catalogue", () => setActiveModal("voice"))}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-[#CFE6D2] bg-white px-5 py-3 font-semibold text-[#1E8A3C] transition-colors hover:bg-[#F0FAF1] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <MessageCircle className="h-5 w-5" />
                  Assistant vocale IA
                </button>
                <button
                  onClick={() => requireAuth("/catalogue", () => setActiveModal("smart"))}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-[#F07C00] px-5 py-3 font-semibold text-white transition-colors hover:bg-[#D66B00] disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  <Zap className="h-5 w-5" />
                  Panier intelligent
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-[#6F8070]">
                {showOrderHistory
                  ? `${orderHistory.length} commande${orderHistory.length > 1 ? "s" : ""} dans l'historique`
                  : `${filteredProducts.length} produit${filteredProducts.length > 1 ? "s" : ""} affiche${filteredProducts.length > 1 ? "s" : ""}`}
              </p>
              {!showOrderHistory && (
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(event) =>
                      setSortBy(event.target.value as (typeof sortOptions)[number]["id"])
                    }
                    className="appearance-none rounded-2xl border border-[#DDE7DE] bg-white px-4 py-3 pr-10 text-sm font-medium text-[#264129] outline-none transition-colors focus:border-[#4CB84A]"
                  >
                    {sortOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B8B7D]" />
                </div>
              )}
            </div>
          </div>

          {successMessage && (
            <div className="mb-6 rounded-2xl border border-[#BFE6C4] bg-[#EAF8EC] px-5 py-4 text-sm font-semibold text-[#1E8A3C]">
              {successMessage}
            </div>
          )}

          {isAuthenticated && showOrderHistory && (
            <div className="mb-6 flex items-center gap-2 border-b border-[#DDEBDD]">
              <button
                onClick={() => setShowOrderHistory(false)}
                className="rounded-t-2xl border border-b-0 border-[#DDEBDD] bg-[#F7FCF7] px-4 py-3 text-sm font-bold text-[#607061] transition-colors hover:bg-white"
              >
                Catalogue
              </button>
              <div className="flex items-center gap-3 rounded-t-2xl border border-b-0 border-[#1E8A3C] bg-[#1E8A3C] px-4 py-3 text-sm font-bold text-white">
                <span className="inline-flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Historique commandes
                </span>
                <button
                  onClick={() => setShowOrderHistory(false)}
                  className="rounded-full p-1 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                  aria-label="Fermer l'onglet historique"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {isAuthenticated && showOrderHistory && (
            <section className="mb-8">
              <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2 text-[#1E8A3C]">
                    <ReceiptText className="h-5 w-5" />
                    <h2 className="text-xl font-black">Historique des commandes</h2>
                  </div>
                  <p className="mt-1 text-sm text-[#6F8070]">
                    Retrouvez les commandes validees depuis le checkout.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void loadOrderHistory()}
                    disabled={isFetchingHistory}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#CFE6D2] bg-white px-4 py-3 text-sm font-semibold text-[#1E8A3C] transition-colors hover:bg-[#F0FAF1] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <History className="h-4 w-4" />
                    {isFetchingHistory ? "Actualisation..." : "Actualiser"}
                  </button>
                  <button
                    onClick={() => setShowOrderHistory(false)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#E5E8E3] bg-white px-4 py-3 text-sm font-semibold text-[#607061] transition-colors hover:bg-[#F7F8F5]"
                  >
                    <X className="h-4 w-4" />
                    Fermer
                  </button>
                </div>
              </div>

              {isFetchingHistory && (
                <div className="grid gap-4 lg:grid-cols-2">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-44 animate-pulse rounded-[24px] bg-gradient-to-br from-[#F3F7F3] to-[#EAF3EB]"
                    />
                  ))}
                </div>
              )}

              {!isFetchingHistory && historyError && (
                <div className="rounded-[24px] border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-600">
                  {historyError}
                </div>
              )}

              {!isFetchingHistory && !historyError && orderHistory.length === 0 && (
                <div className="rounded-[24px] border border-[#E6EFE7] bg-white p-8 text-center">
                  <PackageCheck className="mx-auto mb-3 h-10 w-10 text-[#B8C9BA]" />
                  <p className="font-semibold text-[#264129]">Aucune commande validee pour le moment.</p>
                  <p className="mt-1 text-sm text-[#6F8070]">
                    Vos prochaines commandes apparaitront ici apres validation.
                  </p>
                </div>
              )}

              {!isFetchingHistory && !historyError && orderHistory.length > 0 && (
                <div className="grid gap-4 lg:grid-cols-2">
                  {orderHistory.map((order) => (
                    <article
                      key={order.id}
                      className="rounded-[24px] border border-[#E6F0E7] bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7B8B7D]">
                            Commande N-{order.id}
                          </p>
                          <h3 className="mt-1 text-lg font-black text-[#264129]">
                            {formatOrderDate(order.date_commande)}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs font-bold",
                              getOrderStatusClassName(order.statut)
                            )}
                          >
                            {getOrderStatusLabel(order.statut)}
                          </span>
                          <button
                            onClick={() => void handleDeleteOrderHistory(order.id)}
                            disabled={deletingOrderId === order.id}
                            className="rounded-full border border-red-100 bg-red-50 p-2 text-red-500 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Supprimer de l'historique"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {order.produits.map((product, index) => (
                          <div
                            key={`${order.id}-${product.nom_fr}-${index}`}
                            className="flex items-center gap-3 rounded-2xl bg-[#F7FCF7] p-3 text-sm"
                          >
                            <img
                              src={resolveOrderProductImage(product)}
                              alt={product.nom_fr}
                              onError={(event) => applyImageFallback(event, getCataloguePresentation(product.nom_fr).image)}
                              className="h-12 w-12 shrink-0 rounded-xl object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-[#264129]">
                                {product.nom_fr}
                              </p>
                              <p className="text-xs font-semibold text-[#6F8070]">
                                {formatQuantity(product.quantite_kg, "kg")}
                              </p>
                            </div>
                            <span className="shrink-0 text-sm font-bold text-[#F07C00]">
                              {typeof product.sous_total === "number"
                                ? `${product.sous_total.toFixed(2)} DH`
                                : ""}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                        <div className="rounded-2xl bg-[#FBFDF9] p-3">
                          <p className="text-[#7B8B7D]">Paiement</p>
                          <p className="mt-1 font-bold text-[#264129]">
                            {formatPaymentMode(order.mode_paiement)}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-[#6F8070]">
                            {order.payment_validated ? "Paiement valide" : "Paiement non valide"}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-[#FFF7EE] p-3">
                          <p className="text-[#9A5C11]">Total</p>
                          <p className="mt-1 text-lg font-black text-[#F07C00]">
                            {(order.montant_total || 0).toFixed(2)} DH
                          </p>
                          {order.montant_a_encaisser ? (
                            <p className="mt-1 text-xs font-semibold text-[#9A5C11]">
                              A encaisser: {order.montant_a_encaisser.toFixed(2)} DH
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 text-xs font-semibold text-[#6F8070] sm:grid-cols-2">
                        {order.creneau_livraison && (
                          <p>
                            Creneau: <span className="text-[#264129]">{order.creneau_livraison}</span>
                          </p>
                        )}
                        {order.enroute_at && (
                          <p>
                            En route: <span className="text-[#264129]">{formatOrderDate(order.enroute_at)}</span>
                          </p>
                        )}
                        {order.delivered_at && (
                          <p>
                            Livree: <span className="text-[#264129]">{formatOrderDate(order.delivered_at)}</span>
                          </p>
                        )}
                        {order.absent_at && (
                          <p>
                            Absent: <span className="text-[#264129]">{formatOrderDate(order.absent_at)}</span>
                          </p>
                        )}
                      </div>

                      <div className="mt-4 space-y-2">
                        <button
                          onClick={() => openClaimModal(order)}
                          disabled={!canClaimOrder(order)}
                          className={cn(
                            "inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition-colors",
                            canClaimOrder(order)
                              ? "border-[#F3D8B2] bg-[#FFF7EE] text-[#9A5C11] hover:bg-[#FFEBD6]"
                              : "cursor-not-allowed border-[#E5E8E3] bg-[#F7F8F5] text-[#9AA49B]"
                          )}
                        >
                          <AlertCircle className="h-4 w-4" />
                          Signaler un probleme
                        </button>
                        <p className="text-center text-xs font-semibold text-[#7B8B7D]">
                          {getClaimWindowLabel(order)}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {!showOrderHistory && isFetching && (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-[390px] animate-pulse rounded-[28px] bg-gradient-to-br from-[#F3F7F3] to-[#EAF3EB]"
                />
              ))}
            </div>
          )}

          {!showOrderHistory && !isFetching && error && (
            <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-red-600">
              {error}
            </div>
          )}

          {!showOrderHistory && !isFetching && !error && (
            <>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    image={product.image}
                    fallbackImage={product.fallbackImage}
                    price={product.price}
                    unit={product.unit}
                    displayUnit={product.displayUnit}
                    quantityStep={product.quantityStep}
                    stock={product.stock}
                    onAddToCart={handleAddToCart}
                  />
                ))}
              </div>

              {filteredProducts.length === 0 && (
                <div className="rounded-[28px] border border-[#E6EFE7] bg-white p-12 text-center">
                  <p className="text-[#6F8070]">Aucun produit ne correspond a votre recherche.</p>
                </div>
              )}
            </>
          )}
        </main>

        <aside
          className={cn(
            "fixed right-0 top-0 z-30 flex h-screen w-80 flex-col border-l border-[#E6F0E7] bg-white transition-transform lg:sticky lg:top-20 lg:h-[calc(100vh-80px)] lg:w-[22rem] lg:translate-x-0 xl:w-[25rem]",
            showCart ? "translate-x-0" : "translate-x-full lg:translate-x-0"
          )}
        >
          <button
            onClick={() => setShowCart(false)}
            className="absolute right-4 top-4 rounded-xl p-2 text-[#264129] lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="border-b border-[#EEF2EE] p-6">
            <div className="flex items-center gap-2 text-[#1E8A3C]">
              <ShoppingCart className="h-5 w-5" />
              <h2 className="text-xl font-black">Votre panier</h2>
            </div>
            <p className="mt-2 text-sm text-[#6F8070]">
              {isAuthenticated
                ? "Ajustez vos quantites puis validez votre commande."
                : "Le panier est reserve aux utilisateurs connectes."}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {!isAuthenticated && !isLoading ? (
              <div className="rounded-[28px] border border-[#F3D8B2] bg-[#FFF7EE] p-5">
                <p className="text-sm font-semibold text-[#9A5C11]">
                  Connectez-vous pour utiliser le panier, modifier les quantites et commander.
                </p>
                <button
                  onClick={() => redirectToLogin("/catalogue")}
                  className="mt-4 w-full rounded-2xl bg-[#F07C00] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#D66B00]"
                >
                  Aller a la connexion
                </button>
              </div>
            ) : cart.length === 0 ? (
              <div className="py-10 text-center">
                <ShoppingCart className="mx-auto mb-3 h-12 w-12 text-[#D6DFD7]" />
                <p className="text-[#6F8070]">Votre panier est vide.</p>
              </div>
            ) : (
              <div className="space-y-4 pb-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 shadow-sm">
                  {reste > 0 ? (
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-bold leading-snug text-[#264129]">
                        Plus que {reste.toFixed(2)} DH pour la livraison gratuite 🎁
                      </p>
                      <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#9A5C11]">
                        Livraison {FRAIS.toFixed(0)} DH
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-[#1E8A3C]">Livraison offerte ✅</p>
                      <span className="shrink-0 rounded-full bg-[#F0FDF4] px-2.5 py-1 text-xs font-bold text-[#1E8A3C]">
                        Gratuite
                      </span>
                    </div>
                  )}

                  <div className="mt-3 w-full rounded-full bg-white h-2 ring-1 ring-gray-200">
                    <div
                      className="h-2 rounded-full bg-[#1E8A3C] transition-all duration-300"
                      style={{
                        width: `${progression}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-right text-[11px] font-semibold text-[#6F8070]">
                    {cartSubtotal.toFixed(2)} / {SEUIL.toFixed(0)} DH
                  </p>

                  {pricingSuggestions.length > 0 && (
                    <div className="mt-5">
                      <div className="mb-3 flex items-center gap-3">
                        <span className="h-px flex-1 bg-gray-200" />
                        <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                          À ne pas manquer
                        </span>
                        <span className="h-px flex-1 bg-gray-200" />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        {pricingSuggestions.map((suggestion) => {
                          const niveau = suggestion.niveau || 2
                          const isInCart = cart.some((item) => item.id === suggestion.id)
                          const isFeaturedLevelTwo = niveau === 2 && suggestion.id === firstLevelTwoSuggestionId
                          const resteSuggestions = Math.max(0, SEUIL - cartSubtotal)
                          const suffitPourSeuil = resteSuggestions > 0 && suggestion.price >= resteSuggestions

                          return (
                          <div
                            key={suggestion.id}
                            className={cn(
                              "overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md",
                              niveau === 3
                                ? "border-2 border-amber-400"
                                : isFeaturedLevelTwo
                                  ? "border-2 border-[#1E8A3C]"
                                  : "border-gray-200"
                            )}
                          >
                            <div className="relative flex h-[110px] items-center justify-center bg-gray-50">
                              <img
                                src={suggestion.image}
                                alt={suggestion.name}
                                onError={(event) => applyImageFallback(event, suggestion.fallbackImage)}
                                className="h-full w-full object-cover"
                              />
                              <span className={cn(
                                "absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-bold",
                                suffitPourSeuil
                                  ? "bg-amber-100 text-amber-700"
                                  : "hidden"
                              )}>
                                Suffit pour livraison gratuite
                              </span>
                              {suggestion.prix_khddar_estime && (
                                <span className="absolute bottom-2 right-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] text-gray-400 line-through">
                                  {suggestion.prix_khddar_estime.toFixed(2)} DH
                                </span>
                              )}
                            </div>
                            <div className="p-3">
                              <p className="truncate text-[13px] font-medium text-[#264129]">
                                {suggestion.name}
                              </p>
                              <p className="mt-1 truncate text-[11px] text-gray-400">
                                Ajout malin pour compléter ton panier
                              </p>
                              <div className="mt-3 flex items-center justify-between gap-2">
                                <span className="text-[15px] font-medium text-[#1E8A3C]">
                                  {suggestion.price.toFixed(2)} DH
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleAddSuggestionToCart(suggestion)}
                                  className={cn(
                                    "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold transition-colors",
                                    isInCart
                                      ? "border-[#1E8A3C] bg-[#1E8A3C] text-white"
                                      : "border-gray-300 bg-white text-[#264129] hover:border-[#1E8A3C] hover:text-[#1E8A3C]"
                                  )}
                                  aria-label={`Ajouter ${suggestion.name}`}
                                >
                                  {isInCart ? "✓" : "+"}
                                </button>
                              </div>
                            </div>
                          </div>
                          )
                        })}
                      </div>

                      {cart.length > 0 && addedSuggestionItems.length > 0 && (
                        <div className="mt-4 flex items-center gap-3 rounded-xl border border-green-200 bg-[#F0FDF4] px-4 py-3">
                          <Leaf className="h-5 w-5 shrink-0 text-[#1E8A3C]" />
                          <p className="text-sm font-semibold text-[#264129]">
                            Tu économises {suggestionSavings.toFixed(2)} DH vs le khddar sur cette sélection 🌿
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-3 rounded-[24px] border border-[#E6F0E7] bg-[#F7FCF7] p-4"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      onError={(event) => applyImageFallback(event, item.fallbackImage)}
                      className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-bold text-[#264129]">{item.name}</h3>
                          <p className="text-xs text-[#6F8070]">
                            {item.price.toFixed(2)} DH / {item.displayUnit}
                          </p>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="rounded-full p-1 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <div className="flex shrink-0 items-center rounded-full border border-[#CDE8D0] bg-white">
                          <button
                            onClick={() => updateCartQuantity(item.id, -item.quantityStep)}
                            className="p-2 text-[#2E5A33] transition-colors hover:bg-[#E7F5E8] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="min-w-[90px] px-3 text-center text-xs font-semibold text-[#264129]">
                            {formatQuantity(item.quantity, item.unit)}
                          </span>
                          <button
                            onClick={() => updateCartQuantity(item.id, item.quantityStep)}
                            className="p-2 text-[#2E5A33] transition-colors hover:bg-[#E7F5E8] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="ml-auto shrink-0 text-sm font-bold text-[#F07C00]">
                          {(item.price * item.quantity).toFixed(2)} DH
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isAuthenticated && cart.length > 0 && (
            <div className="border-t border-[#EEF2EE] p-5">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between text-[#6F8070]">
                  <span>Sous-total</span>
                  <span className="font-semibold text-[#264129]">{cartSubtotal.toFixed(2)} DH</span>
                </div>
                <div className="flex items-center justify-between text-[#6F8070]">
                  <span>Livraison</span>
                  <span className="font-semibold text-[#264129]">
                    {cartDeliveryFee > 0 ? `${cartDeliveryFee.toFixed(2)} DH` : "Offerte ✅"}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#EEF2EE] pt-4">
                <span className="text-lg font-black text-[#264129]">Total</span>
                <span className="text-2xl font-black text-[#F07C00]">{cartTotal.toFixed(2)} DH</span>
              </div>

              <button
                onClick={handleCheckout}
                disabled={isSubmittingCart}
                className="mt-5 w-full rounded-2xl bg-[#F07C00] px-4 py-3 font-semibold text-white transition-colors hover:bg-[#D66B00] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmittingCart ? "Validation en cours..." : "Valider la commande"}
              </button>

              <p className="mt-3 text-center text-xs text-[#6F8070]">
                Livraison demain pour garantir la fraicheur.
              </p>
            </div>
          )}
        </aside>
      </div>

      {(showSidebar || showCart) && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => {
            setShowSidebar(false)
            setShowCart(false)
          }}
        />
      )}

      <AIModals
        isOpen={activeModal !== null}
        onClose={() => setActiveModal(null)}
        mode={activeModal}
        products={products}
        onApplySelections={handleApplySelections}
      />

      {claimOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#122018]/55 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[28px] border border-[#DDEBDD] bg-white p-5 shadow-[0_30px_90px_rgba(18,32,24,0.25)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F07C00]">
                  SAV Wallet
                </p>
                <h3 className="mt-1 text-2xl font-black text-[#264129]">
                  Signaler un probleme
                </h3>
                <p className="mt-1 text-sm text-[#6F8070]">
                  Commande N-{claimOrder.id} · remboursement credite sur votre wallet SOUKI.
                </p>
              </div>
              <button
                onClick={closeClaimModal}
                disabled={isSubmittingClaim}
                className="rounded-2xl border border-[#E4ECE4] p-2 text-[#6F8070] transition-colors hover:bg-[#F7FCF7] disabled:opacity-60"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-bold text-[#264129]">Produit concerne</span>
                <select
                  value={claimLineId ?? ""}
                  onChange={(event) => {
                    const nextLineId = Number(event.target.value)
                    const nextLine = claimableLines.find((line) => line.ligne_panier_id === nextLineId)
                    setClaimLineId(Number.isFinite(nextLineId) ? nextLineId : null)
                    setClaimQuantity(nextLine ? String(Math.min(1, nextLine.quantite_kg)) : "1")
                  }}
                  className="mt-2 w-full rounded-2xl border border-[#DDE7DE] bg-white px-4 py-3 text-sm font-semibold text-[#264129] outline-none focus:border-[#4CB84A]"
                >
                  {claimableLines.map((line) => (
                    <option key={line.ligne_panier_id} value={line.ligne_panier_id ?? ""}>
                      {line.nom_fr} · {formatQuantity(line.quantite_kg, "kg")}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-bold text-[#264129]">Quantite a rembourser</span>
                  <input
                    type="number"
                    min="0.001"
                    max={selectedClaimLine?.quantite_kg ?? undefined}
                    step="0.001"
                    value={claimQuantity}
                    onChange={(event) => setClaimQuantity(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-[#DDE7DE] bg-white px-4 py-3 text-sm font-semibold text-[#264129] outline-none focus:border-[#4CB84A]"
                  />
                  {selectedClaimLine && (
                    <p className="mt-1 text-xs font-semibold text-[#7B8B7D]">
                      Maximum: {formatQuantity(selectedClaimLine.quantite_kg, "kg")}
                    </p>
                  )}
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-[#264129]">Raison</span>
                  <select
                    value={claimReason}
                    onChange={(event) => setClaimReason(event.target.value as ClaimReason)}
                    className="mt-2 w-full rounded-2xl border border-[#DDE7DE] bg-white px-4 py-3 text-sm font-semibold text-[#264129] outline-none focus:border-[#4CB84A]"
                  >
                    {claimReasonOptions.map((reason) => (
                      <option key={reason.id} value={reason.id}>
                        {reason.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="rounded-2xl border border-[#F3D8B2] bg-[#FFF7EE] p-4 text-sm text-[#7A4C0E]">
                Le remboursement est automatiquement credite sur votre wallet SOUKI. Aucun remboursement CB ou cash
                n'est propose pour ce parcours.
              </div>

              {claimError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                  {claimError}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  onClick={closeClaimModal}
                  disabled={isSubmittingClaim}
                  className="rounded-2xl border border-[#DDE7DE] px-5 py-3 text-sm font-bold text-[#607061] transition-colors hover:bg-[#F7FCF7] disabled:opacity-60"
                >
                  Annuler
                </button>
                <button
                  onClick={() => void handleSubmitClaim()}
                  disabled={isSubmittingClaim || !selectedClaimLine}
                  className="rounded-2xl bg-[#1E8A3C] px-5 py-3 text-sm font-black text-white transition-colors hover:bg-[#176B2E] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmittingClaim ? "Envoi en cours..." : "Crediter mon wallet"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
