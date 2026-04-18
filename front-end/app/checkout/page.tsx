"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
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
  PartyPopper
} from "lucide-react"
import { cn } from "@/lib/utils"

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
  { 
    id: "cod", 
    icon: Banknote, 
    label: "Cash on Delivery", 
    desc: "Payez à la porte, confirmation appel la veille" 
  },
  { 
    id: "wallet", 
    icon: Wallet, 
    label: "Wallet SOUKI", 
    desc: "Solde : 125,50 DH" 
  },
  { 
    id: "cmi", 
    icon: CreditCard, 
    label: "Carte Bancaire CMI", 
    desc: "Visa / Mastercard marocain — Frais 2% inclus" 
  },
]

function CheckoutContent() {
  const searchParams = useSearchParams()
  const commandeId = searchParams.get('commande_id')
  
  const [cart, setCart] = useState<CartItem[]>([])
  const [isLoading, setIsLoading] = useState(!!commandeId)

  // --- LE PONT VERS LE BACKEND ---
  useEffect(() => {
    if (!commandeId) return
    setIsLoading(true)

    fetch(`http://localhost:8000/api/commandes/${commandeId}`)
      .then(res => {
        if (!res.ok) throw new Error("Commande introuvable")
        return res.json()
      })
      .then(data => {
        const formattedCart: CartItem[] = data.lignes.map((ligne: any) => ({
          id: String(ligne.product_id),
          name: ligne.nom_produit,
          price: ligne.prix_unitaire,
          quantity: ligne.quantite_effective,
          unit: ligne.unite,
          image: ligne.image
        }))
        setCart(formattedCart)
      })
      .catch(err => console.error("Erreur fetch checkout:", err))
      .finally(() => setIsLoading(false))
  }, [commandeId])

  const [selectedTimeSlot, setSelectedTimeSlot] = useState("8-10")
  const [selectedPayment, setSelectedPayment] = useState("cod")
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [address, setAddress] = useState("123 Rue Ibn Battouta, Fès-Médina")
  const [instructions, setInstructions] = useState("")

  const walletBalance = 125.50
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const deliveryFee = 10
  const walletDiscount = 0
  const total = subtotal + deliveryFee - walletDiscount
  const merchantPrice = cart.reduce((sum, item) => sum + (item.price * 1.1) * item.quantity, 0)
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="text-[#1E8A3C] text-xl font-bold animate-pulse">Chargement du panier IA-SOUKI...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/catalogue" className="flex items-center gap-2 text-[#3D3D3D] hover:text-[#1E8A3C]">
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Retour au catalogue</span>
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

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Cart */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-[#1E8A3C]">Votre Panier</h2>
              </div>

              {cart.length === 0 && !isLoading && (
                <div className="p-10 text-center text-[#8A8A8A]">
                  Votre panier est vide. Impossible de finaliser la commande.
                </div>
              )}

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
                          <button
                            onClick={() => updateQuantity(item.id, -0.5)}
                            className="p-2 hover:bg-gray-100"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="px-3 font-medium">{item.quantity} {item.unit}</span>
                          <button
                            onClick={() => updateQuantity(item.id, 0.5)}
                            className="p-2 hover:bg-gray-100"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#3D3D3D]">
                        {(item.price * item.quantity).toFixed(2)} DH
                      </p>
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
                  <span>Économie vs marchand : -{savings.toFixed(2)} DH</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Details */}
          <div className="space-y-6">
            {/* Address */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-bold text-[#3D3D3D] mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#1E8A3C]" />
                Adresse de livraison
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#3D3D3D] mb-2">Adresse</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#4CB84A] focus:outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[#3D3D3D] mb-2">Ville</label>
                  <div className="px-4 py-3 bg-gray-100 rounded-xl text-[#3D3D3D]">
                    Fès - Ville actuelle
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#3D3D3D] mb-2">Instructions livraison (optionnel)</label>
                  <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Ex: 2ème étage, code porte 1234..."
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#4CB84A] focus:outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Time Slot */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-bold text-[#3D3D3D] mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#1E8A3C]" />
                Créneau de livraison
              </h3>
              
              <div className="flex gap-3">
                {timeSlots.map(slot => (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedTimeSlot(slot.id)}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-xl font-semibold transition-all",
                      selectedTimeSlot === slot.id
                        ? "bg-[#1E8A3C] text-white"
                        : "bg-gray-100 text-[#3D3D3D] hover:bg-gray-200"
                    )}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
              <p className="text-sm text-[#8A8A8A] mt-3">Livraison le lendemain matin</p>
            </div>

            {/* Payment */}
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
                    <button
                      key={method.id}
                      onClick={() => setSelectedPayment(method.id)}
                      className={cn(
                        "w-full p-4 rounded-xl border-2 text-left transition-all flex items-start gap-4",
                        isSelected
                          ? "border-[#F07C00] bg-[#F07C00]/5"
                          : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <div className={cn(
                        "p-2 rounded-lg",
                        isSelected ? "bg-[#F07C00] text-white" : "bg-gray-100 text-[#3D3D3D]"
                      )}>
                        <Icon className="w-5 h-5" />
                      </div>
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
                        <p className={cn(
                          "text-sm mt-1",
                          isWallet && insufficient ? "text-red-500" : "text-[#8A8A8A]"
                        )}>
                          {method.desc}
                          {isWallet && insufficient && " - Solde insuffisant"}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-[#F07C00] flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Terms & Submit */}
            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <div
                  onClick={() => setAcceptTerms(!acceptTerms)}
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 mt-0.5",
                    acceptTerms ? "bg-[#1E8A3C] border-[#1E8A3C]" : "border-gray-300"
                  )}
                >
                  {acceptTerms && <Check className="w-3 h-3 text-white />}
                </div>
                <span className="text-sm text-[#3D3D3D]">
                  J'ai lu et j'accepte les{" "}
                  <Link href="/cgu" className="text-[#1A4F8A] hover:underline">CGU</Link>
                </span>
              </label>

              <button
                disabled={!acceptTerms || cart.length === 0 || isWalletInsufficient}
                className={cn(
                  "w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all",
                  acceptTerms && cart.length > 0 && !isWalletInsufficient
                    ? "bg-[#F07C00] text-white hover:bg-[#D66B00] shadow-lg shadow-[#F07C00]/30"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed"
                )}
              >
                <Check className="w-5 h-5" />
                Passer la Commande
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
      <div className="min-h-screen bg-[#Fichier de la mort/...">
        <div className="text-[#1E8A3C]">Chargement...</div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  )
}