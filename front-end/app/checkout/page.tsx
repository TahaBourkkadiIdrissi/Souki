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
  MessageCircle
} from "lucide-react"
import { API_BASE_URL } from "@/lib/api"
import { cn } from "@/lib/utils"

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=300&fit=crop"

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  unit: string
  image: string
}

const timeSlots = [
  { id: "8-10", label: "8h-10h" },
  { id: "10-12", label: "10h-12h" },
  { id: "11-13", label: "11h-13h" },
]

const paymentMethods = [
  { id: "cod", icon: Banknote, label: "Cash on Delivery", desc: "Payez à la porte, confirmation appel la veille" },
  { id: "wallet", icon: Wallet, label: "Wallet SOUKI", desc: "Solde : 125,50 DH" },
  { id: "cmi", icon: CreditCard, label: "Carte Bancaire CMI", desc: "Visa / Mastercard marocain — Frais 2% inclus" },
]

function CheckoutContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const commandeId = searchParams.get('commande_id')
  const panierId = searchParams.get('panier_id')
  const cartParam = searchParams.get('cart')
  
  // États
  const [voiceData, setVoiceData] = useState<any>(null)
  const [panierData, setPanierData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(!!commandeId || !!panierId)
  const [voiceError, setVoiceError] = useState(false)
  
  // On initialise le panier vide, on le remplira dynamiquement dans le useEffect
  const [cart, setCart] = useState<CartItem[]>([])
  
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("8-10")
  const [selectedPayment, setSelectedPayment] = useState("cod")
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [address, setAddress] = useState("123 Rue Ibn Battouta, Fès-Médina")
  const [instructions, setInstructions] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Récupération des données et INITIALISATION DU PANIER au bon moment
  useEffect(() => {
    if (commandeId) {
      // Flux voix: récupérer CommandeCheckoutDTO
      fetch(`${API_BASE_URL}/api/commandes/${commandeId}`)
        .then(res => {
          if (!res.ok) throw new Error("Commande non trouvée")
          return res.json()
        })
        .then(data => {
          setVoiceData(data)
          
          if (data.lignes && data.lignes.length > 0) {
            const realCart = data.lignes.map((l: any) => ({
              id: String(l.product_id),
              name: l.nom_produit || l.nom_fr || "Produit inconnu", 
              price: parseFloat(l.prix_unitaire || l.prix_kg || 0),
              quantity: parseFloat(l.quantite_effective || l.quantite_kg || 1),
              unit: l.unite || "kg",
              image: l.image || DEFAULT_IMAGE
            }))
            setCart(realCart)
          }
          setIsLoading(false)
        })
        .catch(() => {
          setVoiceError(true)
          setIsLoading(false)
        })
    } else if (panierId) {
      // Flux manuel: récupérer PanierDetailsDTO
      fetch(`${API_BASE_URL}/api/paniers/${panierId}`)
        .then(res => {
          if (!res.ok) throw new Error("Panier non trouvé")
          return res.json()
        })
        .then(data => {
          setPanierData(data)
          
          if (data.lignes && data.lignes.length > 0) {
            const realCart = data.lignes.map((l: any) => ({
              id: String(l.product_id),
              name: l.nom_produit || l.nom_fr || "Produit inconnu", 
              price: parseFloat(l.prix_unitaire || l.prix_kg || 0),
              quantity: parseFloat(l.quantite_kg || 1),
              unit: l.unite || "kg",
              image: l.image || DEFAULT_IMAGE
            }))
            setCart(realCart)
          }
          setIsLoading(false)
        })
        .catch(() => {
          setVoiceError(true)
          setIsLoading(false)
        })
    } else if (cartParam) {
      // Si on vient de l'ancien système d'URL (sans voix)
      setCart(JSON.parse(decodeURIComponent(cartParam)))
    } else {
      // Faux panier par défaut si on accède à la page sans rien
      setCart([
        { id: "1", name: "Tomates Marocaines", price: 7, quantity: 5, unit: "kg", image: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea" },
        { id: "3", name: "Oignons", price: 9, quantity: 3, unit: "kg", image: "https://images.unsplash.com/photo-1620574387735-3624d75b2dbc" },
        { id: "4", name: "Carottes", price: 8.5, quantity: 2, unit: "kg", image: "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400&h=300&fit=crop" },
      ])
    }
  }, [commandeId, panierId, cartParam])

  const walletBalance = 125.50
  const merchantPrice = cart.reduce((sum, item) => sum + (item.price * 1.1) * item.quantity, 0)
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const deliveryFee = 10
  const walletDiscount = 0
  const total = subtotal + deliveryFee - walletDiscount
  const savings = merchantPrice - subtotal

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

  const isWalletInsufficient = selectedPayment === "wallet" && walletBalance < total

  const handleFinalSubmit = async () => {
    if (!acceptTerms || cart.length === 0 || isWalletInsufficient || isSubmitting) return;

    setIsSubmitting(true)
    try {
      const payload = {
        items: cart.map(item => ({
          product_id: parseInt(item.id),
          quantity: item.quantity
        })),
        creneau_livraison: selectedTimeSlot,
        mode_paiement: selectedPayment,
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
        window.location.href = "/"
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
          <p className="text-[#1E8A3C] font-bold text-xl">Préparation de votre panier IA...</p>
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
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2 text-[#3D3D3D] hover:text-[#1E8A3C]">
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Retour à l'accueil</span>
            </Link>
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
                <div className="flex justify-between text-sm">
                  <span className="text-[#8A8A8A]">Sous-total produits</span>
                  <span className="font-medium">{subtotal.toFixed(2)} DH</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#8A8A8A]">Frais de livraison</span>
                  <span className="font-medium">{deliveryFee.toFixed(2)} DH</span>
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
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#4CB84A] focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#3D3D3D] mb-2">Ville</label>
                  <div className="px-4 py-3 bg-gray-100 rounded-xl text-[#3D3D3D]">Fès - Ville actuelle</div>
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
                {paymentMethods.map(method => {
                  const Icon = method.icon
                  const isSelected = selectedPayment === method.id
                  const isWallet = method.id === "wallet"
                  const insufficient = isWallet && walletBalance < total

                  return (
                    <button key={method.id} onClick={() => setSelectedPayment(method.id)} className={cn("w-full p-4 rounded-xl border-2 text-left transition-all flex items-start gap-4", isSelected ? "border-[#F07C00] bg-[#F07C00]/5" : "border-gray-200 hover:border-gray-300")}>
                      <div className={cn("p-2 rounded-lg", isSelected ? "bg-[#F07C00] text-white" : "bg-gray-100 text-[#3D3D3D]")}><Icon className="w-5 h-5" /></div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-[#3D3D3D]">{method.label}</p>
                          {method.id === "cmi" && (
                            <div className="flex items-center gap-1 ml-2">
                              <div className="bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 flex items-center justify-center shadow-sm">
                                <img src="https://logos-world.net/wp-content/uploads/2020/04/Visa-Logo.png" alt="Visa" className="h-5 w-auto object-contain" />
                              </div>
                              <div className="bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 flex items-center justify-center shadow-sm">
                                <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-5 w-auto object-contain" />
                              </div>
                            </div>
                          )}
                        </div>
                        <p className={cn("text-sm mt-1", isWallet && insufficient ? "text-red-500" : "text-[#8A8A8A]")}>
                          {method.desc}
                          {isWallet && insufficient && " - Solde insuffisant"}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-[#F07C00] flex items-center justify-center"><Check className="w-4 h-4 text-white" /></div>
                      )}
                    </button>
                  )
                })}
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
                disabled={!acceptTerms || cart.length === 0 || isWalletInsufficient || isSubmitting}
                className={cn("w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all", acceptTerms && cart.length > 0 && !isWalletInsufficient && !isSubmitting ? "bg-[#F07C00] text-white hover:bg-[#D66B00] shadow-lg shadow-[#F07C00]/30" : "bg-gray-200 text-gray-500 cursor-not-allowed")}
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
