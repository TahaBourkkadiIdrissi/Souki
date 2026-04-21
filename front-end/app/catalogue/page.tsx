"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ChevronDown,
  Clock,
  Filter,
  Leaf,
  Menu,
  MessageCircle,
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
import {
  BasketSelection,
  CatalogueProduct,
  CartItem,
  DELIVERY_FEE,
  fetchCommandeCheckout,
  fetchCatalogueProducts,
  fetchPanierDetails,
  formatQuantity,
  loadStoredCart,
  mergeSelectionsIntoCart,
  saveStoredCart,
  submitManualBasket,
  upsertCartItem,
} from "@/lib/catalogue"
import { cn } from "@/lib/utils"

const CATALOGUE_REFRESH_INTERVAL_MS = 5 * 60 * 1000

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

  const handleCheckout = () => {
    requireAuth("/checkout", async () => {
      if (cart.length === 0) {
        alert("Votre panier est vide.")
        return
      }

      setIsSubmittingCart(true)
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
        
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
  const cartTotal = cartSubtotal + DELIVERY_FEE

  return (
    <div className="min-h-screen bg-[#FBFDF9]">
      <div className="bg-[#F07C00] px-4 py-3 text-center text-sm font-semibold text-white">
        Commandes acceptees jusqu'a 20h00 - Livraison demain pour garnatir la fraicheur
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
                <span className="font-semibold">Commandez avant 20h00</span>
              </div>
              <p className="mt-2 text-sm text-[#718272]">
                Livraison demain pour garantir la fraicheur.
              </p>
            </div>

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
                  className="flex items-center justify-center gap-2 rounded-2xl border border-[#CFE6D2] bg-white px-5 py-3 font-semibold text-[#1E8A3C] transition-colors hover:bg-[#F0FAF1]"
                >
                  <MessageCircle className="h-5 w-5" />
                  Assistant vocale IA
                </button>
                <button
                  onClick={() => requireAuth("/catalogue", () => setActiveModal("smart"))}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-[#F07C00] px-5 py-3 font-semibold text-white transition-colors hover:bg-[#D66B00]"
                >
                  <Zap className="h-5 w-5" />
                  Panier intelligent
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-[#6F8070]">
                {filteredProducts.length} produit{filteredProducts.length > 1 ? "s" : ""} affiche
                {filteredProducts.length > 1 ? "s" : ""}
              </p>
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
            </div>
          </div>

          {isFetching && (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-[390px] animate-pulse rounded-[28px] bg-gradient-to-br from-[#F3F7F3] to-[#EAF3EB]"
                />
              ))}
            </div>
          )}

          {!isFetching && error && (
            <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-red-600">
              {error}
            </div>
          )}

          {!isFetching && !error && (
            <>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    image={product.image}
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
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-3 rounded-[24px] border border-[#E6F0E7] bg-[#F7FCF7] p-4"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
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
                            className="p-2 text-[#2E5A33] transition-colors hover:bg-[#E7F5E8]"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="min-w-[90px] px-3 text-center text-xs font-semibold text-[#264129]">
                            {formatQuantity(item.quantity, item.unit)}
                          </span>
                          <button
                            onClick={() => updateCartQuantity(item.id, item.quantityStep)}
                            className="p-2 text-[#2E5A33] transition-colors hover:bg-[#E7F5E8]"
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
                  <span className="font-semibold text-[#264129]">{DELIVERY_FEE.toFixed(2)} DH</span>
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
    </div>
  )
}
