"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSearchParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  MapPin,
  Clock,
  Banknote,
  Wallet,
  CreditCard,
  Check,
  Lock,
  Shield,
  PartyPopper,
  MessageCircle,
  Navigation,
  AlertTriangle
} from "lucide-react"
import {
  API_BASE_URL,
  getBlacklistStatus,
  markBlacklistLiftNotificationSeen,
  requestBlacklistLift,
  type BlacklistStatusDTO,
} from "@/lib/api"
import { isValidMoroccanPhone, normalizeMoroccanPhone, PHONE_ERROR_MSG } from "@/lib/phoneValidator"
import { cn } from "@/lib/utils"
import {
  DELIVERY_FEE,
  FREE_DELIVERY_THRESHOLD,
  CatalogueProduct,
  fetchCatalogueProducts,
  getCataloguePresentation,
} from "@/lib/catalogue"
import { MapboxLocator } from "@/components/souki/mapbox-locator"
import { MobileBottomNav } from "@/components/souki/mobile-bottom-nav"
import { PolicyLink } from "@/components/souki/policy-link"
import { PwaHeader, StickyBottomBar } from "@/components/souki/pwa"
import { useAuth } from "@/hooks/useAuth"
import { useHaptic } from "@/hooks/useHaptic"
import { useOrderLock } from "@/hooks/useOrderLock"
import { toast } from "sonner"

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=300&fit=crop"
const SEUIL = FREE_DELIVERY_THRESHOLD
const FRAIS = DELIVERY_FEE

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  unit: string
  image: string
}

interface UserProfile {
  prenom: string
  nom: string
  email: string
  telephone: string
  address: {
    adresse: string
    ville: string
    code_postal: string
  }
}

interface WalletState {
  has_wallet: boolean
  is_activated: boolean
  balance_centimes: number
}

// Updated time slots
// Livraison à l'heure exacte, contrainte entre 08h00 et 15h00.
const DELIVERY_MIN_TIME = "08:00"
const DELIVERY_MAX_TIME = "15:00"
const DELIVERY_TIME_PRESETS = ["08:00", "10:00", "12:00", "14:00"]
// Comparaison sûre car les chaînes "HH:MM" 24h zéro-paddées se trient lexicalement.
const isTimeInRange = (value: string) =>
  Boolean(value) && value >= DELIVERY_MIN_TIME && value <= DELIVERY_MAX_TIME
const formatDeliveryTime = (value: string) => (value ? value.replace(":", "h") : "—")

const paymentMethods = [
  { id: "cod", icon: Banknote, label: "Cash on Delivery", desc: "Payez à la porte, confirmation appel la veille" },
  { id: "wallet", icon: Wallet, label: "Wallet SOUKI", desc: "" },
  { id: "cmi", icon: CreditCard, label: "Carte Bancaire CMI", desc: "Visa / Mastercard marocain — Frais 2% inclus", disabled: true },
]

function CheckoutContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const haptic = useHaptic()
  const commandeId = searchParams.get('commande_id')
  const panierId = searchParams.get('panier_id')
  const cartParam = searchParams.get('cart')
  const isSmartBasket = searchParams.get('source') === 'smart'
  const editCartHref = isSmartBasket
    ? "/catalogue?assistant=smart"
    : panierId
    ? `/catalogue?panier_id=${panierId}`
    : commandeId
      ? `/catalogue?commande_id=${commandeId}`
      : "/catalogue"

  // États
  const [voiceData, setVoiceData] = useState<any>(null)
  const [panierData, setPanierData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(!!commandeId || !!panierId)
  const [voiceError, setVoiceError] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)

  // On initialise le panier vide, on le remplira dynamiquement dans le useEffect
  const [cart, setCart] = useState<CartItem[]>([])

  // Profile data
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [walletBalance, setWalletBalance] = useState(0)
  const [phoneNumber, setPhoneNumber] = useState("")

  const [selectedTimeSlot, setSelectedTimeSlot] = useState(DELIVERY_MIN_TIME)
  const [timeError, setTimeError] = useState("")
  const [selectedPayment, setSelectedPayment] = useState("cod")
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [instructions, setInstructions] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Commande validee par l'API : declenche l'overlay de celebration avant la redirection.
  const [confirmedOrderId, setConfirmedOrderId] = useState<number | null>(null)
  const [catalogueImages, setCatalogueImages] = useState<Record<number, string>>({})
  const [cataloguePrices, setCataloguePrices] = useState<Record<number, number>>({})
  const [catalogueProducts, setCatalogueProducts] = useState<CatalogueProduct[]>([])
  const [mapboxModalOpen, setMapboxModalOpen] = useState(false)
  const [blacklistStatus, setBlacklistStatus] = useState<BlacklistStatusDTO | null>(null)
  const [showLiftModal, setShowLiftModal] = useState(false)
  const [hideLiftNotification, setHideLiftNotification] = useState(false)
  const [liftMotif, setLiftMotif] = useState("")
  const [isSendingLiftRequest, setIsSendingLiftRequest] = useState(false)
  const [liftRequestMessage, setLiftRequestMessage] = useState("")
  // VULN-010 : plus aucun JWT dans le localStorage. `token` est un simple marqueur
  // de session non secret ; l'authentification reelle passe par le cookie httpOnly.
  const { token } = useAuth()
  // Verrou de commande restaure (BUG-004), aligne sur le cutoff backend.
  const { isLocked: isOrderCutoffActive, message: orderLockMessage } = useOrderLock()

  const isGenericImage = (imageUrl: string) =>
    imageUrl.includes("photo-1542838132-92c53300491e")

  const resolveCartItemImage = (
    rawImage: unknown,
    productId: number | null,
    productName: string
  ) => {
    // 1) Source la plus fiable: image catalogue par product_id
    if (productId !== null && catalogueImages[productId]) {
      return catalogueImages[productId]
    }
    // 2) Fallback métier: mapping catalogue par nom produit (avec alias)
    if (productName) {
      const mappedImage = getCataloguePresentation(productName).image
      if (!isGenericImage(mappedImage)) {
        return mappedImage
      }
    }
    // 3) Dernier recours: image backend seulement si non vide et non générique
    if (typeof rawImage === "string" && rawImage.trim().length > 0 && !isGenericImage(rawImage)) {
      return rawImage
    }
    return DEFAULT_IMAGE
  }

  const buildCartItems = (lines: any[]): CartItem[] => {
    return lines
      .map((line: any) => {
        const productId = Number(line.id ?? line.product_id)
        const productName = line.name || line.nom_produit || line.nom_fr || "Produit inconnu"
        const currentCataloguePrice = Number.isFinite(productId) ? cataloguePrices[productId] : undefined
        const price = Number(
          currentCataloguePrice ?? line.price ?? line.prix_unitaire ?? line.prix_kg ?? 0
        )
        const quantity = Number(
          line.quantity ?? line.quantite_effective ?? line.quantite_kg ?? 1
        )
        const unit = line.unit || line.unite || "kg"

        if (!Number.isFinite(productId) || !Number.isFinite(quantity) || quantity <= 0) {
          return null
        }

        return {
          id: String(productId),
          name: String(productName),
          price: Number.isFinite(price) ? price : 0,
          quantity,
          unit: String(unit),
          image: resolveCartItemImage(
            line.image,
            Number.isFinite(productId) ? productId : null,
            String(productName)
          ),
        }
      })
      .filter((item: CartItem | null): item is CartItem => item !== null)
  }

  const getCartOverrideFromUrl = (): CartItem[] | null => {
    if (!cartParam) {
      return null
    }

    try {
      const parsed = JSON.parse(cartParam)
      const items = Array.isArray(parsed) ? buildCartItems(parsed) : []
      return items.length > 0 ? items : null
    } catch {
      try {
        const parsed = JSON.parse(decodeURIComponent(cartParam))
        const items = Array.isArray(parsed) ? buildCartItems(parsed) : []
        return items.length > 0 ? items : null
      } catch {
        return null
      }
    }
  }

  // Helper function to extract city from address string
  const extractCityFromAddress = (fullAddress: string): string => {
    // Try to extract city from formatted address (usually the first meaningful word after street)
    // Format is typically: "Street Name, City" or similar
    const parts = fullAddress.split(",").map(p => p.trim())
    if (parts.length > 1) {
      return parts[parts.length - 1] // Return the last part (usually the city)
    }
    return ""
  }

  // Fetch user profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) {
        setProfileLoading(false)
        return
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/user/bootstrap`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok) {
          throw new Error("Impossible de charger le profil")
        }

        const data = await response.json()

        // Set profile data
        setUserProfile(data.profile)

        // Pre-fill address and city
        if (data.profile.address?.adresse) {
          setAddress(data.profile.address.adresse)
          setCity(data.profile.address.ville || extractCityFromAddress(data.profile.address.adresse))
        }

        // Set phone number
        if (data.profile.telephone) {
          setPhoneNumber(data.profile.telephone)
        }

        // Set wallet balance (convert centimes to DH)
        if (data.wallet?.balance_centimes !== undefined) {
          setWalletBalance(data.wallet.balance_centimes / 100)
        } else if (data.wallet?.solde_centimes !== undefined) {
          setWalletBalance(data.wallet.solde_centimes / 100)
        }
      } catch (err) {
        console.error("Erreur lors du chargement du profil:", err)
      } finally {
        setProfileLoading(false)
      }
    }

    fetchProfile()
  }, [token])

  useEffect(() => {
    if (!token) {
      setBlacklistStatus(null)
      return
    }

    let isMounted = true
    getBlacklistStatus(token)
      .then((status) => {
        if (isMounted) {
          setBlacklistStatus(status)
        }
      })
      .catch(() => {
        if (isMounted) {
          setBlacklistStatus(null)
        }
      })

    return () => {
      isMounted = false
    }
  }, [token])

  useEffect(() => {
    let isMounted = true
    fetchCatalogueProducts()
      .then((products) => {
        if (!isMounted) {
          return
        }
        const imageMap = products.reduce<Record<number, string>>((acc, product) => {
          acc[product.id] = product.image
          return acc
        }, {})
        const priceMap = products.reduce<Record<number, number>>((acc, product) => {
          acc[product.id] = product.price
          return acc
        }, {})
        setCatalogueProducts(products)
        setCatalogueImages(imageMap)
        setCataloguePrices(priceMap)
      })
      .catch(() => {
        // Fallback already handled in resolveCartItemImage.
      })
    return () => {
      isMounted = false
    }
  }, [])

  // Récupération des données et INITIALISATION DU PANIER au bon moment
  useEffect(() => {
    const cartOverride = getCartOverrideFromUrl()

    if (commandeId) {
      // Flux voix: récupérer CommandeCheckoutDTO
      fetch(`${API_BASE_URL}/api/commandes/${commandeId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then(res => {
          if (!res.ok) throw new Error("Commande non trouvée")
          return res.json()
        })
        .then(data => {
          setVoiceData(data)

          if (cartOverride) {
            setCart(cartOverride)
          } else if (data.lignes && data.lignes.length > 0) {
            setCart(buildCartItems(data.lignes))
          }
          setIsLoading(false)
        })
        .catch(() => {
          setVoiceError(true)
          setIsLoading(false)
        })
    } else if (panierId) {
      // Flux manuel: récupérer PanierDetailsDTO
      fetch(`${API_BASE_URL}/api/paniers/${panierId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then(res => {
          if (!res.ok) throw new Error("Panier non trouvé")
          return res.json()
        })
        .then(data => {
          setPanierData(data)

          if (data.lignes && data.lignes.length > 0) {
            setCart(buildCartItems(data.lignes))
          }
          setIsLoading(false)
        })
        .catch(() => {
          setVoiceError(true)
          setIsLoading(false)
        })
    } else if (cartParam) {
      // Si on vient de l'ancien système d'URL (sans voix)
      setCart(cartOverride ?? [])
    } else {
      // Faux panier par défaut si on accède à la page sans rien
      setCart([
        { id: "1", name: "Tomates Marocaines", price: 7, quantity: 5, unit: "kg", image: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea" },
        { id: "3", name: "Oignons", price: 9, quantity: 3, unit: "kg", image: "https://images.unsplash.com/photo-1620574387735-3624d75b2dbc" },
        { id: "4", name: "Carottes", price: 8.5, quantity: 2, unit: "kg", image: "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400&h=300&fit=crop" },
      ])
    }
  }, [commandeId, panierId, cartParam, catalogueImages, cataloguePrices, token])

  const merchantPrice = cart.reduce((sum, item) => sum + (item.price * 1.1) * item.quantity, 0)
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const totalProduits = subtotal
  const progressionLivraison = Math.min(100, (totalProduits / SEUIL) * 100)
  const deliveryFee = totalProduits >= SEUIL ? 0 : FRAIS
  const walletDiscount = 0
  const total = subtotal + deliveryFee - walletDiscount
  const savings = merchantPrice - subtotal
  const isCodBlocked = Boolean(blacklistStatus?.is_blacklisted)
  const shouldShowLiftNotification = Boolean(
    blacklistStatus?.last_action === "LIFTED" &&
    !blacklistStatus.lift_notification_seen &&
    !hideLiftNotification
  )

  useEffect(() => {
    if (isCodBlocked && selectedPayment === "cod") {
      setSelectedPayment("wallet")
    }
  }, [isCodBlocked, selectedPayment])

  const cartProductIds = new Set(cart.map((item) => Number(item.id)))
  const suggestionsByLevel = [1, 2, 3].map((level) => ({
    level,
    items: catalogueProducts
      .filter((product) => product.niveau === level && !cartProductIds.has(product.id))
      .slice(0, 3),
  })).filter((group) => group.items.length > 0)

  const updateQuantity = (id: string, delta: number) => {
    haptic("light")
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(0.5, item.quantity + delta)
        return { ...item, quantity: newQuantity }
      }
      return item
    }))
  }

  const removeItem = (id: string) => {
    haptic("light")
    setCart(prev => prev.filter(item => item.id !== id))
  }

  // Heure de livraison exacte : on borne à [08:00, 15:00]. Hors plage, on ramène
  // à la borne la plus proche et on affiche un message clair.
  const handleTimeChange = (value: string) => {
    if (!value) return
    haptic("light")
    if (!isTimeInRange(value)) {
      setSelectedTimeSlot(value < DELIVERY_MIN_TIME ? DELIVERY_MIN_TIME : DELIVERY_MAX_TIME)
      setTimeError("Livraison possible uniquement entre 08h00 et 15h00.")
      return
    }
    setTimeError("")
    setSelectedTimeSlot(value)
  }

  const addSuggestionToCart = (product: CatalogueProduct) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === String(product.id))
      if (existing) {
        return prev.map((item) =>
          item.id === String(product.id)
            ? { ...item, quantity: Number((item.quantity + product.quantityStep).toFixed(2)) }
            : item
        )
      }
      return [
        ...prev,
        {
          id: String(product.id),
          name: product.name,
          price: product.price,
          quantity: product.quantityStep,
          unit: product.unit,
          image: product.image,
        },
      ]
    })
  }

  // Handle address detection from Mapbox
  const handleAddressDetected = (detectedAddress: string, detectedCity: string) => {
    setAddress(detectedAddress)
    setCity(detectedCity || extractCityFromAddress(detectedAddress))
  }

  const isWalletInsufficient = selectedPayment === "wallet" && walletBalance < total
  const isPhoneMissing = phoneNumber.trim().length === 0
  const isPhoneInvalid = phoneNumber.trim().length > 0 && !isValidMoroccanPhone(phoneNumber)
  const isAddressMissing = address.trim().length === 0
  const isCityMissing = city.trim().length === 0
  const canSubmitOrder =
    acceptTerms &&
    cart.length > 0 &&
    !isWalletInsufficient &&
    !isPhoneMissing &&
    !isPhoneInvalid &&
    !isAddressMissing &&
    !isCityMissing &&
    !(isCodBlocked && selectedPayment === "cod") &&
    !isOrderCutoffActive &&
    !isSubmitting

  const submitLiftRequest = async () => {
    if (!token) {
      setLiftRequestMessage("Connectez-vous pour envoyer la demande.")
      return
    }

    const motif = liftMotif.trim()
    if (!motif) {
      setLiftRequestMessage("Expliquez la situation avant l'envoi.")
      return
    }

    setIsSendingLiftRequest(true)
    setLiftRequestMessage("")
    try {
      await requestBlacklistLift(token, motif)
      const status = await getBlacklistStatus(token)
      setBlacklistStatus(status)
      setLiftMotif("")
      setShowLiftModal(false)
      setLiftRequestMessage("Demande envoyée.")
    } catch (error) {
      setLiftRequestMessage(error instanceof Error ? error.message : "Impossible d'envoyer la demande.")
    } finally {
      setIsSendingLiftRequest(false)
    }
  }

  const acknowledgeLiftNotification = async () => {
    if (!token) {
      setHideLiftNotification(true)
      return
    }

    try {
      await markBlacklistLiftNotificationSeen(token)
      setBlacklistStatus((current) => current ? { ...current, lift_notification_seen: true } : current)
    } catch {
      // Keep the alert visible if the backend cannot persist the read receipt.
      return
    }
    setHideLiftNotification(true)
  }

  const handleFinalSubmit = async () => {
    if (!canSubmitOrder) return

    setIsSubmitting(true)
    try {
      const payload = {
        items: cart.map(item => ({
          product_id: parseInt(item.id),
          quantity: item.quantity
        })),
        creneau_livraison: selectedTimeSlot,
        mode_paiement: selectedPayment,
        contact_phone: phoneNumber.trim() ? normalizeMoroccanPhone(phoneNumber) : null,
        delivery_address: address.trim(),
        delivery_city: city.trim(),
        delivery_instructions: instructions.trim() || null,
        // On envoie l'ID du brouillon vocal s'il existe, sinon null
        brouillon_vocal_id: commandeId ? parseInt(commandeId) : null,
        panier_id: panierId ? parseInt(panierId) : null
      }

      // Authentification par cookie httpOnly (credentials: "include"), plus de JWT cote JS.
      const res = await fetch(`${API_BASE_URL}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const data = await res.json()
        // L'overlay anime remplace le toast comme feedback immediat ; la
        // redirection existante est juste differee le temps de la celebration.
        setConfirmedOrderId(data.commande_id)
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate([15, 40, 20])
        }
        window.setTimeout(() => {
          router.push(`/catalogue?commande_validee=${data.commande_id}`)
        }, 1600)
      } else {
        const errData = await res.json().catch(() => ({}))
        toast.error(errData.detail || "Erreur lors de la validation de la commande.")
      }
    } catch (error) {
      toast.error("Erreur de connexion au serveur.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#1E8A3C] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#1E8A3C] font-bold text-xl">Préparation du panier</p>
        </div>
      </div>
    )
  }

  if (voiceError) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-lg max-w-md">
          <p className="text-red-500 text-xl font-bold mb-4">Impossible de charger votre commande vocale.</p>
          <Link href="/" className="text-[#1E8A3C] font-bold hover:underline">Retour à l'accueil</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-40 md:pb-0">
      {confirmedOrderId !== null && (
        <div
          className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm px-6"
          role="status"
          aria-live="assertive"
        >
          <span className="relative flex h-24 w-24 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-[#4CB84A]/30 animate-souki-success-ring" />
            <span className="absolute -inset-3 rounded-full bg-[#4CB84A]/15 animate-souki-success-ring [animation-delay:0.35s]" />
            <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-[#1E8A3C] shadow-xl shadow-[#1E8A3C]/25 animate-souki-success-pop">
              <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" aria-hidden="true">
                <path
                  d="M6 12.5l4 4 8-9"
                  pathLength={100}
                  className="souki-check-draw"
                  stroke="white"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </span>
          <p className="mt-6 text-2xl font-bold text-[#233127] animate-fade-in-up">
            Commande N-{confirmedOrderId} confirmée
          </p>
          <p className="mt-2 text-sm text-[#66756B] animate-fade-in-up-delay-1">
            Vos produits frais arrivent demain matin, du champ au panier.
          </p>
          <img
            src="/illustrations/checkout-celebration.webp"
            alt=""
            decoding="async"
            width={144}
            height={144}
            aria-hidden="true"
            className="mt-4 h-36 w-36 object-contain animate-fade-in-up-delay-2"
          />
        </div>
      )}
      {/* En-tête mobile natif (← + titre centré), façon référence. Desktop garde son header. */}
      <div className="md:hidden">
        <PwaHeader title="Finaliser ma commande" onBack={() => router.push(editCartHref)} />
      </div>

      <header className="sticky top-0 z-10 hidden glass-ios26 border-b border-gray-100 md:block">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3">
            <div className="flex flex-col items-start gap-2">
              <Link
                href="/"
                className="group inline-flex items-center gap-2 rounded-xl bg-[#F0FAF1] px-4 py-2 text-sm font-semibold text-[#1E8A3C] shadow-sm ring-1 ring-[#D7EBD9] transition-all hover:-translate-y-0.5 hover:bg-[#E7F5E8] hover:shadow"
              >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                <span>Retour à l'accueil</span>
              </Link>
              <Link
                href={editCartHref}
                className="group inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#F07C00] shadow-sm ring-1 ring-[#F5D7B8] transition-all hover:-translate-y-0.5 hover:bg-[#FFF7EE] hover:shadow"
              >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                <span>Modifier dans le catalogue</span>
              </Link>
            </div>
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl shadow-sm overflow-hidden flex items-center justify-center bg-white p-0.5 pointer-events-none">
                <img src="/logo3.png" alt="SOUKI" className="w-[175%] h-full max-w-none object-cover" style={{ objectPosition: "left center" }} />
              </div>
              <span className="text-lg font-bold text-[#1E8A3C]">SOUKI</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 md:py-8 lg:px-8">
        <div className="mb-6 md:mb-8">
          <h1 className="hidden text-2xl font-bold leading-tight text-[#1E8A3C] md:block lg:text-3xl">Finaliser ma commande</h1>
          <p className="text-sm font-medium text-[#6F8070] md:hidden">
            Vérifiez le panier, choisissez la livraison, puis confirmez.
          </p>
        </div>

        {blacklistStatus && (blacklistStatus.is_blacklisted || shouldShowLiftNotification) && (
          <div className={cn("mb-6 rounded-2xl border p-4", blacklistStatus.is_blacklisted ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50")}>
            <div className="flex items-start gap-3">
              <AlertTriangle className={cn("mt-0.5 h-5 w-5 shrink-0", blacklistStatus.is_blacklisted ? "text-red-600" : "text-[#1E8A3C]")} />
              <div className="min-w-0">
                <p className={cn("text-sm font-semibold", blacklistStatus.is_blacklisted ? "text-red-700" : "text-[#1E8A3C]")}>
                  {blacklistStatus.is_blacklisted ? "Votre compte ne peut plus passer de commandes COD" : "Restriction COD levee"}
                </p>
                <p className={cn("mt-1 text-xs", blacklistStatus.is_blacklisted ? "text-red-500" : "text-[#1E8A3C]")}>
                  {blacklistStatus.is_blacklisted ? "Suite a un refus de livraison. Wallet et CMI restent disponibles." : "Vous pouvez a nouveau choisir le paiement a la livraison."}
                </p>
                {blacklistStatus.last_action === "LIFT_REQUESTED" && (
                  <p className="mt-2 text-xs font-medium text-amber-600">Demande de levee en attente de decision admin.</p>
                )}
                {blacklistStatus.last_action === "LIFT_REJECTED" && (
                  <p className="mt-2 text-xs font-medium text-red-600">Demande refusee. Motif : {blacklistStatus.last_reason}</p>
                )}
                {shouldShowLiftNotification && (
                  <p className="mt-2 text-xs font-medium text-[#1E8A3C]">Restriction levee. COD disponible a nouveau.</p>
                )}
                {shouldShowLiftNotification && (
                  <button
                    type="button"
                    onClick={() => void acknowledgeLiftNotification()}
                    className="mt-3 rounded-lg border border-[#1E8A3C] bg-white px-3 py-1.5 text-xs font-semibold text-[#1E8A3C] transition hover:bg-[#F0FAF1]"
                  >
                    J'ai compris
                  </button>
                )}
                {liftRequestMessage && <p className="mt-2 text-xs font-medium text-[#1E8A3C]">{liftRequestMessage}</p>}
                {blacklistStatus.last_action !== "LIFT_REQUESTED" && blacklistStatus.last_action !== "LIFTED" && (
                  <button
                    type="button"
                    onClick={() => {
                      setLiftRequestMessage("")
                      setShowLiftModal(true)
                    }}
                    className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    Demander la levee de restriction
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {voiceData && (
          <div className="bg-[#1E8A3C] text-white rounded-2xl p-5 mb-8 shadow-lg flex items-start gap-4">
            <MessageCircle className="w-8 h-8 shrink-0 mt-1" />
            <div>
              <h2 className="font-bold text-lg mb-1">Récapitulatif de votre commande vocale</h2>
              <p className="text-white/90 italic">« {voiceData.transcription} »</p>
              {voiceData.lignes.some((l: any) => l.message_ajustement) && (
                <p className="text-yellow-300 text-sm mt-2 font-medium">⚠️ Certains produits ont été ajustés selon leur disponibilité.</p>
              )}
            </div>
          </div>
        )}

        {panierData && (
          <div className="bg-[#1E8A3C] text-white rounded-2xl p-5 mb-8 shadow-lg flex items-start gap-4">
            <MessageCircle className="w-8 h-8 shrink-0 mt-1" />
            <div>
              <h2 className="font-bold text-lg mb-1">Récapitulatif de votre panier</h2>
              <p className="text-white/90">{panierData.nombre_articles || cart.length} article{(panierData.nombre_articles || cart.length) > 1 ? "s" : ""} pour {panierData.sous_total?.toFixed(2) || "calculé"} DH</p>
            </div>
          </div>
        )}

        {isSmartBasket && (
          <div className="bg-[#1E8A3C] text-white rounded-2xl p-5 mb-8 shadow-lg flex items-start gap-4">
            <MessageCircle className="w-8 h-8 shrink-0 mt-1" />
            <div>
              <h2 className="font-bold text-lg mb-1">Panier intelligent IA-SOUKI</h2>
              <p className="text-white/90">
                {cart.length} article{cart.length > 1 ? "s" : ""} genere{cart.length > 1 ? "s" : ""} par le modele ML, affiches dans votre checkout.
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.92fr)] lg:gap-8">
          {/* Left Column - Cart */}
          <div id="checkout-cart" className="space-y-6 lg:sticky lg:top-28 lg:self-start">
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="border-b border-gray-100 p-5 sm:p-6">
                <h2 className="text-xl font-bold text-[#1E8A3C]">{voiceData ? "Panier validé par l'IA" : isSmartBasket ? "Panier intelligent" : panierData ? "Votre panier validé" : "Votre Panier"}</h2>
              </div>

              <div className="divide-y divide-gray-100">
                {cart.map(item => (
                  <div key={item.id} className="flex gap-3 p-4 sm:gap-4">
                    <Image
                      src={item.image}
                      alt={item.name}
                      width={80}
                      height={80}
                      className="h-20 w-20 shrink-0 rounded-xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-[#3D3D3D]">{item.name}</h3>
                      <p className="text-[#F07C00] font-bold">{item.price.toFixed(2)} DH/{item.unit}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <div className="flex min-h-10 items-center overflow-hidden rounded-xl border border-gray-200">
                          <button onClick={() => updateQuantity(item.id, -0.5)} className="flex h-10 w-10 items-center justify-center hover:bg-gray-100"><Minus className="w-4 h-4" /></button>
                          <span className="min-w-16 px-2 text-center text-sm font-medium">{item.quantity} {item.unit}</span>
                          <button onClick={() => updateQuantity(item.id, 0.5)} className="flex h-10 w-10 items-center justify-center hover:bg-gray-100"><Plus className="w-4 h-4" /></button>
                        </div>
                        <button onClick={() => removeItem(item.id)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-red-400 hover:bg-red-50 hover:text-red-600" aria-label={`Retirer ${item.name}`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="font-bold text-[#3D3D3D]">{(item.price * item.quantity).toFixed(2)} DH</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 bg-[#F0FAF1] space-y-2">
                <div className="rounded-xl border border-[#D7EBD9] bg-white px-4 py-3">
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-[#3D3D3D]">Livraison</span>
                    <span className={cn(
                      "font-bold",
                      deliveryFee > 0 ? "text-amber-700" : "text-[#1E8A3C]"
                    )}>
                      {deliveryFee > 0 ? `${deliveryFee.toFixed(0)} DH` : "Offerte ✅"}
                    </span>
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${progressionLivraison}%`,
                        backgroundColor: progressionLivraison >= 100 ? "#1E8A3C" : "#F59E0B"
                      }}
                    />
                  </div>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-[#8A8A8A]">Sous-total produits</span>
                  <span className="font-medium">{subtotal.toFixed(2)} DH</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#8A8A8A]">Frais de livraison</span>
                  <span className="font-medium">
                    {deliveryFee > 0 ? `${deliveryFee.toFixed(2)} DH` : "Offerte ✅"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#8A8A8A]">Réduction Wallet</span>
                  <span className="font-medium">-{walletDiscount.toFixed(2)} DH</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-[#4CB84A]/30">
                  <span>Total TTC</span>
                  <span className="text-[#F07C00]">{total.toFixed(2)} DH</span>
                </div>
                <div className="flex items-center gap-2 text-[#1E8A3C] text-sm">
                  <PartyPopper className="w-4 h-4" />
                  <span>{voiceData ? "Commande traitée par IA-SOUKI" : isSmartBasket ? "Panier compose par le modele ML SOUKI" : `Économie vs marchand : -${savings.toFixed(2)} DH`}</span>
                </div>
              </div>
            </div>

            {isSmartBasket && suggestionsByLevel.length > 0 && (
              <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="border-b border-gray-100 p-5 sm:p-6">
                  <h2 className="text-lg font-bold text-[#1E8A3C]">Completer le panier par niveau</h2>
                  <p className="mt-1 text-sm font-medium text-[#6F8070]">
                    Suggestions catalogue pour enrichir votre panier genere.
                  </p>
                </div>
                <div className="space-y-5 p-5 sm:p-6">
                  {suggestionsByLevel.map((group) => (
                    <div key={group.level}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-[#264129]">Niveau {group.level}</span>
                        <span className="rounded-full bg-[#F0FAF1] px-3 py-1 text-xs font-bold text-[#1E8A3C]">
                          {group.items.length} suggestion{group.items.length > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {group.items.map((product) => (
                          <div key={product.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                            <img src={product.image} alt={product.name} className="h-24 w-full object-cover" />
                            <div className="p-3">
                              <p className="truncate text-sm font-semibold text-[#264129]">{product.name}</p>
                              <p className="mt-1 text-xs font-medium text-[#6F8070]">
                                {product.price.toFixed(2)} DH/{product.displayUnit}
                              </p>
                              <button
                                type="button"
                                onClick={() => addSuggestionToCart(product)}
                                className="mt-3 flex min-h-9 w-full items-center justify-center gap-2 rounded-xl bg-[#1E8A3C] px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-[#176B2E]"
                              >
                                <Plus className="h-4 w-4" />
                                Ajouter
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Details */}
          <div className="space-y-5 lg:space-y-6">
            <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
              <h3 className="font-bold text-[#3D3D3D] mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#1E8A3C]" />
                Adresse de livraison
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#3D3D3D] mb-2">Adresse</label>
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Entrez votre adresse de livraison" className="min-h-12 w-full rounded-xl border-2 border-gray-200 px-4 py-3 focus:border-[#4CB84A] focus:outline-none" />
                  {isAddressMissing && (
                    <p className="mt-2 text-xs font-semibold text-red-500">
                      Ajoutez votre adresse de livraison.
                    </p>
                  )}
                </div>

                {/* "Me localiser" button with Mapbox */}
                <button
                  onClick={() => setMapboxModalOpen(true)}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#1E8A3C] px-4 py-3 font-semibold text-[#1E8A3C] transition-colors hover:bg-[#F0FAF1]"
                >
                  <Navigation className="w-4 h-4" />
                  Me localiser
                </button>

                <div>
                  <label className="block text-sm font-medium text-[#3D3D3D] mb-2">Ville</label>
                  <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ville" className="min-h-12 w-full rounded-xl border-2 border-gray-200 px-4 py-3 focus:border-[#4CB84A] focus:outline-none" />
                  {isCityMissing && (
                    <p className="mt-2 text-xs font-semibold text-red-500">
                      Ajoutez votre ville pour la livraison.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#3D3D3D] mb-2">Numero de telephone</label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder={profileLoading ? "Chargement du numéro..." : "+212..."}
                    className="min-h-12 w-full rounded-xl border-2 border-gray-200 px-4 py-3 focus:border-[#4CB84A] focus:outline-none"
                  />
                  {isPhoneMissing && (
                    <p className="mt-2 text-xs font-semibold text-red-500">
                      Ajoutez un numéro pour que SOUKI confirme la livraison.
                    </p>
                  )}
                  {isPhoneInvalid && (
                    <p className="mt-2 text-xs font-semibold text-red-500">
                      {PHONE_ERROR_MSG}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#3D3D3D] mb-2">Instructions livraison (optionnel)</label>
                  <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Ex: 2ème étage, code porte 1234..." rows={3} className="w-full resize-none rounded-xl border-2 border-gray-200 px-4 py-3 focus:border-[#4CB84A] focus:outline-none" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
              <h3 className="mb-1 flex items-center gap-2 font-bold text-[#3D3D3D]">
                <Clock className="h-5 w-5 text-[#1E8A3C]" />
                Heure de livraison
              </h3>
              <p className="mb-4 text-sm text-[#8A8A8A]">
                Choisissez l&apos;heure exacte, demain entre 8h00 et 15h00.
              </p>

              {/* Heure choisie mise en avant + sélecteur précis */}
              <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-[#F0FAF1] px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#6F8070]">Livraison prévue vers</p>
                  <p className="souki-tabular-nums text-2xl font-black leading-tight text-[#1E8A3C]">
                    {formatDeliveryTime(selectedTimeSlot)}
                  </p>
                </div>
                <input
                  type="time"
                  min={DELIVERY_MIN_TIME}
                  max={DELIVERY_MAX_TIME}
                  step={900}
                  value={selectedTimeSlot}
                  onChange={(event) => handleTimeChange(event.target.value)}
                  aria-label="Heure de livraison souhaitée"
                  className="shrink-0 rounded-xl border-2 border-[#CDE8D0] bg-white px-3 py-2.5 text-base font-bold text-[#264129] outline-none transition-colors focus:border-[#4CB84A]"
                />
              </div>

              {/* Raccourcis d'heures fréquentes */}
              <div className="flex flex-wrap gap-2">
                {DELIVERY_TIME_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      haptic("light")
                      setTimeError("")
                      setSelectedTimeSlot(preset)
                    }}
                    className={cn(
                      "min-h-11 rounded-full px-4 py-2 text-sm font-bold transition-all active:scale-95",
                      selectedTimeSlot === preset
                        ? "bg-[#1E8A3C] text-white shadow-sm"
                        : "bg-gray-100 text-[#3D3D3D] hover:bg-gray-200",
                    )}
                  >
                    {formatDeliveryTime(preset)}
                  </button>
                ))}
              </div>

              {timeError ? (
                <p className="mt-3 text-xs font-semibold text-red-500">{timeError}</p>
              ) : (
                <p className="mt-3 text-sm text-[#8A8A8A]">Livraison le lendemain matin, à l&apos;heure choisie.</p>
              )}
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
              <h3 className="font-bold text-[#3D3D3D] mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#1E8A3C]" />
                Méthode de Paiement
              </h3>
              <div className="space-y-3">
                {/* Cash on Delivery */}
                <button
                  onClick={() => {
                    if (!isCodBlocked) {
                      haptic("light")
                      setSelectedPayment("cod")
                    }
                  }}
                  disabled={isCodBlocked}
                  className={cn("flex min-h-16 w-full items-start gap-4 rounded-xl border-2 p-4 text-left transition-all", selectedPayment === "cod" ? "border-[#F07C00] bg-[#F07C00]/5" : "border-gray-200 hover:border-gray-300", isCodBlocked && "cursor-not-allowed opacity-60")}
                >
                  <div className={cn("p-2 rounded-lg", selectedPayment === "cod" ? "bg-[#F07C00] text-white" : "bg-gray-100 text-[#3D3D3D]")}><Banknote className="w-5 h-5" /></div>
                  <div className="flex-1">
                    <p className="font-semibold text-[#3D3D3D]">Cash on Delivery</p>
                    {isCodBlocked && (
                      <p className="mt-1 text-xs font-semibold text-red-500">
                        Indisponible tant que la restriction est active.
                      </p>
                    )}
                    <p className="text-sm text-[#8A8A8A] mt-1">Payez à la porte, confirmation appel la veille</p>
                  </div>
                  {selectedPayment === "cod" && (
                    <div className="w-6 h-6 rounded-full bg-[#F07C00] flex items-center justify-center"><Check className="w-4 h-4 text-white" /></div>
                  )}
                </button>

                {/* Wallet */}
                <button
                  onClick={() => { haptic("light"); setSelectedPayment("wallet") }}
                  className={cn("flex min-h-16 w-full items-start gap-4 rounded-xl border-2 p-4 text-left transition-all", selectedPayment === "wallet" ? "border-[#F07C00] bg-[#F07C00]/5" : "border-gray-200 hover:border-gray-300")}
                >
                  <div className={cn("p-2 rounded-lg", selectedPayment === "wallet" ? "bg-[#F07C00] text-white" : "bg-gray-100 text-[#3D3D3D]")}><Wallet className="w-5 h-5" /></div>
                  <div className="flex-1">
                    <p className="font-semibold text-[#3D3D3D]">Wallet SOUKI</p>
                    <p className={cn("text-sm mt-1", isWalletInsufficient ? "text-red-500 font-semibold" : "text-[#8A8A8A]")}>
                      Solde : {walletBalance.toFixed(2)} DH
                      {isWalletInsufficient && " — Crédit insuffisant"}
                    </p>
                  </div>
                  {selectedPayment === "wallet" && (
                    <div className="w-6 h-6 rounded-full bg-[#F07C00] flex items-center justify-center"><Check className="w-4 h-4 text-white" /></div>
                  )}
                </button>

                {/* Card Payment - Disabled */}
                <button
                  disabled
                  className="flex min-h-16 w-full cursor-not-allowed items-start gap-4 rounded-xl border-2 border-gray-200 p-4 text-left opacity-60 transition-all"
                >
                  <div className="p-2 rounded-lg bg-gray-100 text-[#8A8A8A]"><CreditCard className="w-5 h-5" /></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-[#8A8A8A]">Carte Bancaire CMI</p>
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 text-[#8A8A8A] text-xs font-semibold rounded-lg">
                        <AlertTriangle className="w-3 h-3" />
                        Non disponible
                      </span>
                    </div>
                    <p className="text-sm text-[#8A8A8A] mt-1">Visa / Mastercard marocain — Bientôt disponible</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
              {isOrderCutoffActive && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                  {orderLockMessage}
                </div>
              )}
              <label className="flex items-start gap-3 cursor-pointer">
                <div onClick={() => setAcceptTerms(!acceptTerms)} className={cn("w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 mt-0.5", acceptTerms ? "bg-[#1E8A3C] border-[#1E8A3C]" : "border-gray-300")}>
                  {acceptTerms && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-sm text-[#3D3D3D]">J'ai lu et j'accepte la <PolicyLink className="text-[#1A4F8A] hover:underline" /></span>
              </label>

              <button
                onClick={handleFinalSubmit}
                disabled={!canSubmitOrder}
                className={cn("hidden min-h-14 w-full items-center justify-center gap-2 rounded-xl py-4 text-lg font-bold transition-all md:flex", canSubmitOrder ? "bg-[#F07C00] text-white hover:bg-[#D66B00] shadow-lg shadow-[#F07C00]/30" : "bg-gray-200 text-gray-500 cursor-not-allowed")}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Validation en cours...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Passer la Commande
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-sm text-[#8A8A8A]">
                <Shield className="w-4 h-4" />
                <span>Paiement sécurisé — Données protégées</span>
                <Lock className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </main>

      {showLiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[#3D3D3D]">Demande de levee</h3>
            <p className="mt-2 text-sm text-[#8A8A8A]">Expliquez la situation pour que l'admin puisse prendre une decision.</p>
            <textarea
              value={liftMotif}
              onChange={(event) => setLiftMotif(event.target.value)}
              placeholder="Expliquez la situation..."
              rows={5}
              className="mt-4 w-full resize-none rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-[#3D3D3D] outline-none transition-colors focus:border-red-300"
            />
            {liftRequestMessage && <p className="mt-2 text-xs font-medium text-red-500">{liftRequestMessage}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowLiftModal(false)
                  setLiftMotif("")
                  setLiftRequestMessage("")
                }}
                disabled={isSendingLiftRequest}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-[#3D3D3D] transition hover:bg-gray-50 disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void submitLiftRequest()}
                disabled={isSendingLiftRequest || liftMotif.trim().length === 0}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSendingLiftRequest ? "Envoi..." : "Envoyer la demande"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== CTA STICKY BAS (mobile) : total + passer la commande, à portée de pouce ===== */}
      {cart.length > 0 && confirmedOrderId === null && (
        <StickyBottomBar aboveNav>
          <button
            onClick={() => {
              haptic("medium")
              handleFinalSubmit()
            }}
            disabled={!canSubmitOrder}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-white transition-all active:scale-[0.98]",
              canSubmitOrder
                ? "bg-[#F07C00] shadow-[0_12px_28px_-14px_rgba(240,124,0,0.8)]"
                : "cursor-not-allowed bg-gray-300",
            )}
          >
            <span className="flex flex-col items-start leading-tight">
              <span className="text-[11px] font-semibold text-white/80">Total TTC</span>
              <span className="text-[17px] font-black souki-tabular-nums">{total.toFixed(2)} DH</span>
            </span>
            <span className="flex items-center gap-1.5 text-[15px] font-black">
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Validation…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Passer la commande
                </>
              )}
            </span>
          </button>
        </StickyBottomBar>
      )}

      {/* Mapbox Locator Modal */}
      <MapboxLocator
        isOpen={mapboxModalOpen}
        onClose={() => setMapboxModalOpen(false)}
        onAddressDetected={handleAddressDetected}
      />
      <MobileBottomNav
        cartCount={cart.length}
        onCartClick={() => document.getElementById("checkout-cart")?.scrollIntoView({ behavior: "smooth" })}
      />
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="text-[#1E8A3C]">Chargement...</div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  )
}
