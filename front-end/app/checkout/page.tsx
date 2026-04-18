"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { apiCall } from "@/lib/api"
import {
  CartItem,
  DELIVERY_FEE,
  formatQuantity,
  loadStoredCart,
  saveStoredCart,
} from "@/lib/catalogue"

const deliverySlots = [
  "Livraison demain matin 8h-13h",
  "Livraison demain",
]

const paymentMethods = [
  { id: "cash", label: "Paiement a la livraison" },
  { id: "cmi", label: "Carte bancaire / CMI" },
]

export default function CheckoutPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading, token } = useAuth()

  const [cart, setCart] = useState<CartItem[]>([])
  const [deliverySlot, setDeliverySlot] = useState(deliverySlots[0])
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0].id)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState<{ commandeId: number; total: number } | null>(null)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(`/login/client?redirect=${encodeURIComponent("/checkout")}`)
    }
  }, [isAuthenticated, isLoading, router])

  useEffect(() => {
    setCart(loadStoredCart())
  }, [])

  useEffect(() => {
    saveStoredCart(cart)
  }, [cart])

  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const cartTotal = cartSubtotal + DELIVERY_FEE

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

  const handleSubmit = async () => {
    if (!token) {
      router.replace(`/login/client?redirect=${encodeURIComponent("/checkout")}`)
      return
    }

    if (!cart.length) {
      setError("Votre panier est vide.")
      return
    }

    try {
      setIsSubmitting(true)
      setError("")

      const response = await apiCall("/api/checkout", {
        method: "POST",
        token,
        body: {
          items: cart.map((item) => ({
            product_id: item.id,
            quantity: item.quantity,
          })),
          creneau_livraison: deliverySlot,
          mode_paiement: paymentMethod,
        },
      })

      setSuccess({
        commandeId: response.commande_id as number,
        total: response.montant_total as number,
      })
      setCart([])
      saveStoredCart([])
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Impossible de valider la commande."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading || (!isAuthenticated && !success)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBFDF9]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1E8A3C]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FBFDF9]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/catalogue"
          className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-[#DDE7DE] bg-white px-4 py-3 text-sm font-semibold text-[#264129] transition-colors hover:bg-[#F2FAF2]"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au catalogue
        </Link>

        {success ? (
          <div className="rounded-[32px] border border-[#D8EEDC] bg-white p-8 text-center shadow-[0_20px_50px_-35px_rgba(0,0,0,0.2)]">
            <CheckCircle2 className="mx-auto h-14 w-14 text-[#1E8A3C]" />
            <h1 className="mt-5 text-3xl font-black text-[#1E8A3C]">
              Commande validee avec succes
            </h1>
            <p className="mt-3 text-[#6F8070]">
              Votre commande <span className="font-bold">#{success.commandeId}</span> a bien ete
              enregistree.
            </p>
            <p className="mt-2 text-[#264129]">
              Montant total: <span className="font-bold">{success.total.toFixed(2)} DH</span>
            </p>
            <Link
              href="/catalogue"
              className="mt-6 inline-flex rounded-2xl bg-[#F07C00] px-5 py-3 font-semibold text-white transition-colors hover:bg-[#D66B00]"
            >
              Revenir au catalogue
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-[32px] bg-white p-6 shadow-[0_20px_50px_-35px_rgba(0,0,0,0.2)] lg:p-8">
              <div className="mb-6">
                <h1 className="text-3xl font-black text-[#1E8A3C]">Validation de commande</h1>
                <p className="mt-2 text-[#6F8070]">
                  Verifiez votre panier puis envoyez votre commande au back-end.
                </p>
              </div>

              {cart.length === 0 ? (
                <div className="rounded-[28px] border border-[#E6EFE7] bg-[#F8FCF8] p-8 text-center">
                  <ShoppingCart className="mx-auto mb-3 h-12 w-12 text-[#D6DFD7]" />
                  <p className="text-[#6F8070]">Votre panier est vide.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 rounded-[28px] border border-[#E6F0E7] bg-[#F8FCF8] p-4"
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-20 w-20 rounded-3xl object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h2 className="text-lg font-bold text-[#264129]">{item.name}</h2>
                            <p className="text-sm text-[#6F8070]">
                              {item.price.toFixed(2)} DH / {item.displayUnit}
                            </p>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="rounded-full p-2 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center rounded-full border border-[#CDE8D0] bg-white">
                            <button
                              onClick={() => updateCartQuantity(item.id, -item.quantityStep)}
                              className="p-2 text-[#2E5A33] transition-colors hover:bg-[#E7F5E8]"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="min-w-[100px] px-4 text-center text-sm font-semibold text-[#264129]">
                              {formatQuantity(item.quantity, item.unit)}
                            </span>
                            <button
                              onClick={() => updateCartQuantity(item.id, item.quantityStep)}
                              className="p-2 text-[#2E5A33] transition-colors hover:bg-[#E7F5E8]"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                          <span className="text-lg font-black text-[#F07C00]">
                            {(item.price * item.quantity).toFixed(2)} DH
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <aside className="rounded-[32px] bg-white p-6 shadow-[0_20px_50px_-35px_rgba(0,0,0,0.2)] lg:p-8">
              <h2 className="text-2xl font-black text-[#264129]">Resume</h2>

              <div className="mt-6 space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#264129]">
                    Creneau de livraison
                  </label>
                  <select
                    value={deliverySlot}
                    onChange={(event) => setDeliverySlot(event.target.value)}
                    className="w-full rounded-2xl border border-[#DDE7DE] bg-[#FAFCFA] px-4 py-3 text-sm text-[#264129] outline-none focus:border-[#4CB84A]"
                  >
                    {deliverySlots.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#264129]">
                    Mode de paiement
                  </label>
                  <div className="space-y-2">
                    {paymentMethods.map((method) => (
                      <button
                        key={method.id}
                        onClick={() => setPaymentMethod(method.id)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                          paymentMethod === method.id
                            ? "border-[#1E8A3C] bg-[#F0FAF1] text-[#1E8A3C]"
                            : "border-[#DDE7DE] bg-white text-[#264129] hover:bg-[#F8FCF8]"
                        }`}
                      >
                        {method.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[28px] border border-[#E6F0E7] bg-[#F8FCF8] p-5">
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between text-[#6F8070]">
                      <span>Sous-total</span>
                      <span className="font-semibold text-[#264129]">{cartSubtotal.toFixed(2)} DH</span>
                    </div>
                    <div className="flex items-center justify-between text-[#6F8070]">
                      <span>Livraison</span>
                      <span className="font-semibold text-[#264129]">{DELIVERY_FEE.toFixed(2)} DH</span>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-[#E6F0E7] pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-black text-[#264129]">Total</span>
                      <span className="text-2xl font-black text-[#F07C00]">{cartTotal.toFixed(2)} DH</span>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || cart.length === 0}
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 font-semibold text-white transition-colors ${
                    isSubmitting || cart.length === 0
                      ? "cursor-not-allowed bg-gray-300"
                      : "bg-[#F07C00] hover:bg-[#D66B00]"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Validation...
                    </>
                  ) : (
                    "Confirmer la commande"
                  )}
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}
