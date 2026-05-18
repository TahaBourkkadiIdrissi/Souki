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
import { cn } from "@/lib/utils"
import { fetchCatalogueProducts, getCataloguePresentation } from "@/lib/catalogue"
import { MapboxLocator } from "@/components/souki/mapbox-locator"

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=300&fit=crop"
const SEUIL = 120
const FRAIS = 15

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
const timeSlots = [
  { id: "8-10", label: "8h – 10h" },
  { id: "11-13", label: "11h – 13h" },
  { id: "14-16", label: "14h – 16h" },
]

const paymentMethods = [
  { id: "cod", icon: Banknote, label: "Cash on Delivery", desc: "Payez à la porte, confirmation appel la veille" },
  { id: "wallet", icon: Wallet, label: "Wallet SOUKI", desc: "" },
  { id: "cmi", icon: CreditCard, label: "Carte Bancaire CMI", desc: "Visa / Mastercard marocain — Frais 2% inclus", disabled: true },
]

function CheckoutContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const commandeId = searchParams.get('commande_id')
  const panierId = searchParams.get('panier_id')
  const cartParam = searchParams.get('cart')
  const editCartHref = panierId
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
  
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("8-10")
  const [selectedPayment, setSelectedPayment] = useState("cod")
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [instructions, setInstructions] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [catalogueImages, setCatalogueImages] = useState<Record<number, string>>({})
  const [mapboxModalOpen, setMapboxModalOpen] = useState(false)
  const [blacklistStatus, setBlacklistStatus] = useState<BlacklistStatusDTO | null>(null)
  const [showLiftModal, setShowLiftModal] = useState(false)
  const [hideLiftNotification, setHideLiftNotification] = useState(false)
  const [liftMotif, setLiftMotif] = useState("")
  const [isSendingLiftRequest, setIsSendingLiftRequest] = useState(false)
  const [liftRequestMessage, setLiftRequestMessage] = useState("")
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

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
        const price = Number(line.price ?? line.prix_unitaire ?? line.prix_kg ?? 0)
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
        setCatalogueImages(imageMap)
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
  }, [commandeId, panierId, cartParam, catalogueImages, token])

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

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(0.5, item.quantity + delta)
        return { ...item, quantity: newQuantity }
      }
      return item
    }))
  }

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }

  // Handle address detection from Mapbox
  const handleAddressDetected = (detectedAddress: string, detectedCity: string) => {
    setAddress(detectedAddress)
    setCity(detectedCity || extractCityFromAddress(detectedAddress))
  }

  const isWalletInsufficient = selectedPayment === "wallet" && walletBalance < total
  const isPhoneMissing = phoneNumber.trim().length === 0
  const isAddressMissing = address.trim().length === 0
  const isCityMissing = city.trim().length === 0
  const canSubmitOrder =
    acceptTerms &&
    cart.length > 0 &&
    !isWalletInsufficient &&
    !isPhoneMissing &&
    !isAddressMissing &&
    !isCityMissing &&
    !(isCodBlocked && selectedPayment === "cod") &&
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
      setLiftRequestMessage("Demande envoyee.")
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
        contact_phone: phoneNumber.trim(),
        delivery_address: address.trim(),
        delivery_city: city.trim(),
        delivery_instructions: instructions.trim() || null,
        // On envoie l'ID du brouillon vocal s'il existe, sinon null
        brouillon_vocal_id: commandeId ? parseInt(commandeId) : null
      }

      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

      const res = await fetch(`${API_BASE_URL}/api/checkout`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const data = await res.json()
        alert(`Succès ! Votre commande définitive N°${data.commande_id} a été enregistrée.`)
        router.push(`/catalogue?commande_validee=${data.commande_id}`)
      } else {
        const errData = await res.json().catch(() => ({}))
        alert(errData.detail || "Erreur lors de la validation de la commande.")
      }
    } catch (error) {
      alert("Erreur de connexion au serveur.")
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
    <div className="min-h-screen bg-[#F5F5F0]">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-[#1E8A3C] mb-8">Finaliser ma commande</h1>

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
                <p className="text-yellow-300 text-sm mt-2 font-medium">⚠️ Certains produits ont été ajustés selon le stock disponible.</p>
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

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Cart */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-[#1E8A3C]">{voiceData ? "Panier validé par l'IA" : panierData ? "Votre panier validé" : "Votre Panier"}</h2>
              </div>

              <div className="divide-y divide-gray-100">
                {cart.map(item => (
                  <div key={item.id} className="p-4 flex gap-4">
                    <Image
                      src={item.image}
                      alt={item.name}
                      width={80}
                      height={80}
                      className="rounded-xl object-cover"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold text-[#3D3D3D]">{item.name}</h3>
                      <p className="text-[#F07C00] font-bold">{item.price.toFixed(2)} DH/{item.unit}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                          <button onClick={() => updateQuantity(item.id, -0.5)} className="p-2 hover:bg-gray-100"><Minus className="w-4 h-4" /></button>
                          <span className="px-3 font-medium">{item.quantity} {item.unit}</span>
                          <button onClick={() => updateQuantity(item.id, 0.5)} className="p-2 hover:bg-gray-100"><Plus className="w-4 h-4" /></button>
                        </div>
                        <button onClick={() => removeItem(item.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="text-right">
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
                  <span>{voiceData ? "Commande traitée par IA-SOUKI" : `Économie vs marchand : -${savings.toFixed(2)} DH`}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Details */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-bold text-[#3D3D3D] mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#1E8A3C]" />
                Adresse de livraison
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#3D3D3D] mb-2">Adresse</label>
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Entrez votre adresse de livraison" className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#4CB84A] focus:outline-none" />
                  {isAddressMissing && (
                    <p className="mt-2 text-xs font-semibold text-red-500">
                      Ajoutez votre adresse de livraison.
                    </p>
                  )}
                </div>
                
                {/* "Me localiser" button with Mapbox */}
                <button
                  onClick={() => setMapboxModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-[#1E8A3C] text-[#1E8A3C] rounded-xl font-semibold hover:bg-[#F0FAF1] transition-colors"
                >
                  <Navigation className="w-4 h-4" />
                  Me localiser
                </button>

                <div>
                  <label className="block text-sm font-medium text-[#3D3D3D] mb-2">Ville</label>
                  <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ville" className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#4CB84A] focus:outline-none" />
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
                    placeholder={profileLoading ? "Chargement du numero..." : "+212..."}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#4CB84A] focus:outline-none"
                  />
                  {isPhoneMissing && (
                    <p className="mt-2 text-xs font-semibold text-red-500">
                      Ajoutez un numero pour que SOUKI confirme la livraison.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#3D3D3D] mb-2">Instructions livraison (optionnel)</label>
                  <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Ex: 2ème étage, code porte 1234..." rows={3} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#4CB84A] focus:outline-none resize-none" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-bold text-[#3D3D3D] mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#1E8A3C]" />
                Créneau de livraison
              </h3>
              <div className="flex gap-3">
                {timeSlots.map(slot => (
                  <button key={slot.id} onClick={() => setSelectedTimeSlot(slot.id)} className={cn("flex-1 py-3 px-4 rounded-xl font-semibold transition-all", selectedTimeSlot === slot.id ? "bg-[#1E8A3C] text-white" : "bg-gray-100 text-[#3D3D3D] hover:bg-gray-200")}>
                    {slot.label}
                  </button>
                ))}
              </div>
              <p className="text-sm text-[#8A8A8A] mt-3">Livraison le lendemain matin</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-bold text-[#3D3D3D] mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#1E8A3C]" />
                Méthode de Paiement
              </h3>
              <div className="space-y-3">
                {/* Cash on Delivery */}
                <button
                  onClick={() => {
                    if (!isCodBlocked) {
                      setSelectedPayment("cod")
                    }
                  }}
                  disabled={isCodBlocked}
                  className={cn("w-full p-4 rounded-xl border-2 text-left transition-all flex items-start gap-4", selectedPayment === "cod" ? "border-[#F07C00] bg-[#F07C00]/5" : "border-gray-200 hover:border-gray-300", isCodBlocked && "cursor-not-allowed opacity-60")}
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
                  onClick={() => setSelectedPayment("wallet")}
                  className={cn("w-full p-4 rounded-xl border-2 text-left transition-all flex items-start gap-4", selectedPayment === "wallet" ? "border-[#F07C00] bg-[#F07C00]/5" : "border-gray-200 hover:border-gray-300")}
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
                  className="w-full p-4 rounded-xl border-2 border-gray-200 text-left transition-all flex items-start gap-4 opacity-60 cursor-not-allowed"
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

            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <div onClick={() => setAcceptTerms(!acceptTerms)} className={cn("w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 mt-0.5", acceptTerms ? "bg-[#1E8A3C] border-[#1E8A3C]" : "border-gray-300")}>
                  {acceptTerms && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-sm text-[#3D3D3D]">J'ai lu et j'accepte les <Link href="/cgu" className="text-[#1A4F8A] hover:underline">CGU</Link></span>
              </label>

              <button
                onClick={handleFinalSubmit}
                disabled={!canSubmitOrder}
                className={cn("w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all", canSubmitOrder ? "bg-[#F07C00] text-white hover:bg-[#D66B00] shadow-lg shadow-[#F07C00]/30" : "bg-gray-200 text-gray-500 cursor-not-allowed")}
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

      {/* Mapbox Locator Modal */}
      <MapboxLocator
        isOpen={mapboxModalOpen}
        onClose={() => setMapboxModalOpen(false)}
        onAddressDetected={handleAddressDetected}
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
