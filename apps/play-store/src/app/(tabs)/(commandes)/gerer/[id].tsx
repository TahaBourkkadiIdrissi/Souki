import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Alert, KeyboardAvoidingView, Pressable, ScrollView, View } from "react-native"
import Animated, { FadeIn, FadeOut, LinearTransition, useReducedMotion } from "react-native-reanimated"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Check, Clock, Info, Plus, Search, Trash2 } from "lucide-react-native"
import {
  formatDeliveryDate,
  formatDirhams,
  formatPriceUnit,
  normalizeSearchText,
  productMatches,
  productName,
  roundToStep,
  type CatalogueProduct,
  type OrderEditLineDTO,
  type OrderEditResponseDTO,
} from "@souki/shared"

import { AnimatedDigits } from "@/components/animated-digits"
import { BrandButton } from "@/components/brand-button"
import { BrandEmptyState } from "@/components/brand-empty-state"
import { Note, TextField } from "@/components/form-fields"
import { ProductImage } from "@/components/product-image"
import { SwipeToDelete } from "@/components/swipe-to-delete"
import { QuantityStepper } from "@/components/quantity-stepper"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { useCatalogue } from "@/hooks/use-catalogue"
import { useInvalidateOrders } from "@/hooks/use-orders"
import { ApiError, cancelOrder, fetchOrderForEdit, previewOrderEdit, saveOrderEdit } from "@/lib/api"
import { haptics } from "@/lib/haptics"
import { EASE_OUT } from "@/lib/motion"
import { colors, palette, radius, shadows } from "@/theme"

/** Delai avant de demander le nouveau total au serveur apres un changement. */
const PREVIEW_DELAY = 500
const ROW_REFLOW = LinearTransition.duration(220).easing(EASE_OUT)

/**
 * Gerer ma commande (EcranGerer, design system 2027 ; regles de order-editor.tsx du site) :
 * compte a rebours jusqu'a 01h00, lignes modifiables, « Ajouter des produits », recapitulatif
 * recalcule par le serveur (POST .../modification/apercu) a chaque changement, bouton colle
 * « Enregistrer les modifications ». Carte rouge pour annuler, puis alerte systeme.
 */
export default function GererScreen() {
  const router = useRouter()
  const { t, locale, dateLocale, direction } = useLocale()
  const insets = useSafeAreaInsets()
  const reducedMotion = useReducedMotion()
  const invalidateOrders = useInvalidateOrders()
  const { products, productsById } = useCatalogue()
  const { id } = useLocalSearchParams<{ id: string }>()
  const orderId = Number(id)

  const [order, setOrder] = useState<OrderEditResponseDTO | null>(null)
  const [items, setItems] = useState<OrderEditLineDTO[]>([])
  const [quote, setQuote] = useState<OrderEditResponseDTO | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mustReload, setMustReload] = useState(false)
  const [expired, setExpired] = useState(false)
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState("")
  /** Instant local de la cloture, d'apres l'heure du serveur (pas l'horloge du telephone). */
  const [deadlineAt, setDeadlineAt] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setQuote(null)
    try {
      const value = await fetchOrderForEdit(orderId)
      setOrder(value)
      setItems(value.items)
      setMustReload(false)
      const remaining = value.deadline ? Date.parse(value.deadline) - Date.parse(value.server_time) : 0
      setDeadlineAt(Date.now() + remaining)
      setExpired(remaining <= 0)
    } catch (caught) {
      setError(caught instanceof Error ? t(caught.message) : t("Impossible de charger la commande."))
    } finally {
      setLoading(false)
    }
  }, [orderId, t])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (deadlineAt === null) return
    const timer = setTimeout(() => {
      setExpired(true)
      setQuote(null)
    }, Math.max(0, deadlineAt - Date.now()))
    return () => clearTimeout(timer)
  }, [deadlineAt])

  const locked = !order?.editable || expired || mustReload
  const cancelLocked = !order?.cancellable || expired || mustReload
  const fullWallet = order?.mode_paiement.toLowerCase() === "wallet"
  const changed = useMemo(() => {
    if (!order) return false
    if (order.items.length !== items.length) return true
    return items.some((item) => order.items.find((original) => original.product_id === item.product_id)?.quantity !== item.quantity)
  }, [order, items])

  // Nouveau total demande au serveur apres chaque changement (comme « Vérifier le nouveau total »).
  const requestId = useRef(0)
  useEffect(() => {
    if (!order || locked || !changed || items.length === 0) {
      setQuote(null)
      return
    }
    const current = ++requestId.current
    setQuoting(true)
    const timer = setTimeout(() => {
      previewOrderEdit(orderId, { expected_version: order.version, items: items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })) })
        .then((value) => {
          if (current === requestId.current) setQuote(value)
        })
        .catch((caught) => {
          if (current !== requestId.current) return
          setQuote(null)
          setError(caught instanceof Error ? t(caught.message) : t("Impossible d'enregistrer les modifications."))
          if (caught instanceof ApiError && [403, 404, 409].includes(caught.status)) setMustReload(true)
        })
        .finally(() => {
          if (current === requestId.current) setQuoting(false)
        })
    }, PREVIEW_DELAY)
    return () => clearTimeout(timer)
  }, [order, items, locked, changed, orderId, t])

  const changeQuantity = (productId: number, quantity: number) => {
    if (locked || busy) return
    setError(null)
    setItems((current) =>
      quantity <= 0 ? current.filter((item) => item.product_id !== productId) : current.map((item) => (item.product_id === productId ? { ...item, quantity: Number(quantity.toFixed(3)) } : item)),
    )
  }

  const addProduct = (product: CatalogueProduct) => {
    if (locked || busy) return
    haptics.add()
    const existing = items.find((item) => item.product_id === product.id)
    if (existing) return changeQuantity(product.id, roundToStep(existing.quantity + product.quantityStep, product.quantityStep))
    // Un produit deja commande garde son prix ; un nouveau prend le prix du jour.
    const original = order?.items.find((item) => item.product_id === product.id)
    setError(null)
    setItems((current) => [
      ...current,
      original
        ? { ...original, quantity: product.quantityStep }
        : { product_id: product.id, name: product.name, unit: product.unit, quantity: product.quantityStep, unit_price: product.price, subtotal: product.price * product.quantityStep },
    ])
  }

  const save = async () => {
    if (!order || !quote || locked || busy) return
    setBusy(true)
    setError(null)
    try {
      await saveOrderEdit(orderId, { expected_version: order.version, items: items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })), expected_total: quote.total })
      haptics.success()
      void invalidateOrders()
      router.back()
      Alert.alert(t("Commande modifiée"), t("Votre commande N-{id} a été modifiée avec succès.", { id: orderId }))
    } catch (caught) {
      haptics.error()
      setQuote(null)
      setError(caught instanceof Error ? t(caught.message) : t("Impossible d'enregistrer les modifications."))
      if (caught instanceof ApiError && [403, 404, 409].includes(caught.status)) setMustReload(true)
    } finally {
      setBusy(false)
    }
  }

  const confirmCancel = () => {
    if (!order || cancelLocked) return
    haptics.warning()
    const detail = fullWallet
      ? t("Le total payé de {montant} DH, livraison comprise, sera recrédité sur votre Wallet.", { montant: formatDirhams(order.total) })
      : order.wallet_paid > 0
        ? t("Les {montant} DH payés par le Wallet seront recrédités, et vous n'aurez rien à payer à la livraison.", { montant: formatDirhams(order.wallet_paid) })
        : t("Vous n'aurez rien à payer pour cette commande.")
    Alert.alert(t("Annuler la commande N-{id} ?", { id: order.commande_id }), `${t("Cette action est définitive.")} ${detail}`, [
      { text: t("Garder ma commande"), style: "cancel" },
      { text: t("Confirmer l'annulation"), style: "destructive", onPress: () => void cancel() },
    ])
  }

  const cancel = async () => {
    if (!order) return
    setBusy(true)
    setError(null)
    try {
      await cancelOrder(orderId, order.version)
      haptics.success()
      void invalidateOrders()
      router.back()
      Alert.alert(t("Commande annulée"), t("Votre commande N-{id} a été annulée. Si elle était payée par Wallet, le total a été recrédité.", { id: orderId }))
    } catch (caught) {
      haptics.error()
      setError(caught instanceof Error ? t(caught.message) : t("Impossible d'annuler la commande."))
      if (caught instanceof ApiError && [403, 404, 409].includes(caught.status)) setMustReload(true)
    } finally {
      setBusy(false)
    }
  }

  if (loading && !order) {
    return (
      <View style={{ flex: 1, paddingTop: 140, alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={palette.market600} />
      </View>
    )
  }

  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <BrandEmptyState art="orders" title={t("Commande introuvable")} description={error ?? t("Impossible de charger la commande.")} action={{ label: t("Recharger la commande"), onPress: () => void load() }} />
      </View>
    )
  }

  const delivery = formatDeliveryDate(order.date_livraison, dateLocale)
  const summary = quote ?? order
  const query = normalizeSearchText(search)
  const addable = products.filter((product) => product.availability !== "out_of_stock" && (!query || productMatches(product, search)))

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background, direction }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 14, paddingBottom: 24 }}>
        <Text variant="body" color={palette.ink500} style={{ fontSize: 15, lineHeight: 21 }}>
          {delivery ? t("Commande N-{id} · livraison le {date}", { id: order.commande_id, date: delivery }) : t("Commande N-{id}", { id: order.commande_id })}
        </Text>

        {locked ? (
          <Note tone="orange">
            {mustReload ? t("Rechargez la commande pour consulter son état actuel.") : t(order.reason || "La clôture est atteinte. Cette commande ne peut plus être modifiée.")}
          </Note>
        ) : deadlineAt !== null ? (
          <Countdown deadlineAt={deadlineAt} />
        ) : null}

        <View style={{ gap: 8 }}>
          {items.length === 0 ? <Note tone="orange">{t("Ajoutez au moins un produit.")}</Note> : null}
          {items.map((item) => {
            const live = productsById.get(item.product_id)
            const step = live?.quantityStep ?? (item.unit === "kg" ? 0.5 : 1)
            const name = live ? productName(live, locale) : item.name
            return (
              <Animated.View
                key={item.product_id}
                layout={reducedMotion ? undefined : ROW_REFLOW}
                entering={reducedMotion ? undefined : FadeIn.duration(200)}
                exiting={reducedMotion ? undefined : FadeOut.duration(160)}
              >
                {/* Balayer pour retirer, comme les lignes du panier (CartLine). */}
                <SwipeToDelete label={t("Retirer {name}", { name })} disabled={locked || busy} onDelete={() => changeQuantity(item.product_id, 0)}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }}>
                <View style={{ width: 60, height: 60, borderRadius: 16, overflow: "hidden", backgroundColor: palette.photoBg }}>
                  {live ? <ProductImage uri={live.image} variant="inset" style={{ width: 60, height: 60 }} /> : null}
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text variant="callout" weight="bold" color={palette.ink900} numberOfLines={1} style={{ flex: 1, fontSize: 15 }}>
                      {name}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <Text variant="footnote" weight="semibold" numeric color={palette.ink500} style={{ fontSize: 12 }}>
                      {`${formatDirhams(item.unit_price)} DH / ${formatPriceUnit(item.unit, locale)}`}
                    </Text>
                    {locked ? (
                      <Text variant="callout" weight="heavy" numeric color={palette.ink900} style={{ fontSize: 14 }}>
                        {String(item.quantity).replace(".", ",")}
                      </Text>
                    ) : (
                      <QuantityStepper size="small" quantity={item.quantity} step={step} unit={item.unit} onChange={(next) => changeQuantity(item.product_id, next)} />
                    )}
                  </View>
                </View>
                </View>
                </SwipeToDelete>
              </Animated.View>
            )
          })}
        </View>

        {locked ? null : adding ? (
          <View style={{ gap: 10, padding: 14, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: shadows.card }}>
            <TextField icon={Search} value={search} onChangeText={setSearch} placeholder={t("Rechercher un produit")} autoCorrect={false} returnKeyType="search" />
            {products.length === 0 ? <Note tone="orange">{t("Catalogue indisponible. Vous pouvez modifier les quantités existantes ou recharger la page.")}</Note> : null}
            {addable.slice(0, 30).map((product) => (
              <View key={product.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, overflow: "hidden", backgroundColor: palette.photoBg }}>
                  <ProductImage uri={product.image} variant="inset" style={{ width: 40, height: 40 }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="callout" weight="semibold" color={palette.ink900} numberOfLines={1} style={{ fontSize: 14 }}>
                    {productName(product, locale)}
                  </Text>
                  <Text variant="footnote" numeric color={palette.ink500} style={{ fontSize: 12 }}>
                    {`${formatDirhams(order.items.find((line) => line.product_id === product.id)?.unit_price ?? product.price)} DH / ${formatPriceUnit(product.unit, locale)}`}
                  </Text>
                </View>
                <Pressable
                  onPress={() => addProduct(product)}
                  accessibilityRole="button"
                  accessibilityLabel={t("Ajouter {name}", { name: productName(product, locale) })}
                  hitSlop={6}
                  style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: palette.softFill, opacity: pressed ? 0.7 : 1 })}
                >
                  <Plus size={18} color={palette.souki900} strokeWidth={2.6} />
                </Pressable>
              </View>
            ))}
            <BrandButton tone="ghost" size="sm" label={t("Fermer")} onPress={() => setAdding(false)} />
          </View>
        ) : (
          <BrandButton tone="soft" icon={Plus} label={t("Ajouter des produits")} onPress={() => setAdding(true)} />
        )}

        <View style={{ padding: 18, gap: 10, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: shadows.card }}>
          <SumRow label={t("Montant actuel")} value={`${formatDirhams(order.total)} DH`} />
          <SumRow label={t("Produits")} value={`${formatDirhams(summary.subtotal)} DH`} />
          <SumRow label={t("Livraison")} value={summary.delivery_fee > 0 ? `${formatDirhams(summary.delivery_fee)} DH` : t("Offerte")} free={summary.delivery_fee === 0} />
          {fullWallet ? (
            quote && quote.difference !== 0 ? (
              <SumRow
                label={quote.difference > 0 ? t("Complément débité du Wallet") : t("Montant recrédité au Wallet")}
                value={`${quote.difference > 0 ? "" : "− "}${formatDirhams(Math.abs(quote.difference))} DH`}
                free={quote.difference < 0}
              />
            ) : null
          ) : (
            <>
              {summary.wallet_paid > 0 ? <SumRow label={t("Déjà payé par le Wallet")} value={`− ${formatDirhams(summary.wallet_paid)} DH`} free /> : null}
              {quote && order.wallet_paid > quote.wallet_paid ? <SumRow label={t("Montant recrédité au Wallet")} value={`${formatDirhams(order.wallet_paid - quote.wallet_paid)} DH`} free /> : null}
            </>
          )}
          <View style={{ height: 1, marginTop: 2, overflow: "hidden" }}>
            <View style={{ height: 3, borderWidth: 1, borderStyle: "dashed", borderColor: palette.line }} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingTop: 2 }}>
            <Text variant="headline" weight="black" color={palette.ink900} style={{ fontSize: 17 }}>
              {fullWallet ? t("Payé par votre Wallet") : t("À payer à la livraison")}
            </Text>
            <AnimatedDigits value={`${formatDirhams(fullWallet ? summary.total : summary.amount_due)} DH`} weight="black" color={palette.souki900} style={{ fontSize: 24, lineHeight: 30, letterSpacing: -0.7 }} />
          </View>
        </View>

        <Note icon={Info}>{t("La date de livraison et le numéro de commande restent identiques. Les prix des produits déjà commandés sont conservés.")}</Note>
        {error ? <Note tone="red">{error}</Note> : null}
        {mustReload ? <BrandButton tone="soft" label={t("Recharger la commande")} onPress={() => void load()} /> : null}

        <View style={{ padding: 16, gap: 10, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white, borderWidth: 1.5, borderColor: "#F6CACA" }}>
          <Text variant="headline" weight="heavy" color={palette.red600} style={{ fontSize: 16 }}>
            {t("Annuler la commande")}
          </Text>
          <Text variant="footnote" color={palette.ink500} style={{ fontSize: 13, lineHeight: 18 }}>
            {t("Possible avant 01 h le jour de la livraison, tant que la préparation n'a pas commencé.")}
          </Text>
          {cancelLocked && !mustReload ? (
            <Text variant="footnote" weight="semibold" color={palette.orange700} style={{ fontSize: 13 }}>
              {t(order.cancellation_reason || "L'annulation de cette commande est fermée.")}
            </Text>
          ) : null}
          <BrandButton tone="danger" size="md" fill={false} icon={Trash2} label={t("Annuler ma commande")} disabled={cancelLocked || busy} onPress={confirmCancel} />
        </View>
      </ScrollView>

      <View style={{ marginHorizontal: 12, marginBottom: Math.max(insets.bottom, 12), padding: 10, gap: 8, borderRadius: 30, borderCurve: "continuous", backgroundColor: palette.glass, boxShadow: `${shadows.float}, inset 0 0 0 1px rgba(255, 255, 255, 0.8)` }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 8 }}>
          <Text variant="footnote" weight="semibold" color={palette.ink500} style={{ fontSize: 13 }}>
            {t("Nouveau total")}
          </Text>
          {quoting ? (
            <ActivityIndicator size="small" color={palette.market600} />
          ) : (
            <AnimatedDigits value={`${formatDirhams(summary.total)} DH`} weight="black" color={palette.souki900} style={{ fontSize: 17, lineHeight: 22 }} />
          )}
        </View>
        <BrandButton
          icon={Check}
          label={busy ? t("Traitement…") : t("Enregistrer les modifications")}
          disabled={locked || busy || quoting || !quote || items.length === 0}
          onPress={() => void save()}
        />
      </View>
    </KeyboardAvoidingView>
  )
}

/** Carte verte : « Modifiable jusqu'à 01h00 » et le temps restant qui roule. */
function Countdown({ deadlineAt }: { deadlineAt: number }) {
  const { t } = useLocale()
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const remaining = Math.max(0, Math.floor((deadlineAt - now) / 1000))
  const value = [Math.floor(remaining / 3600), Math.floor((remaining % 3600) / 60), remaining % 60].map((part) => String(part).padStart(2, "0")).join(":")
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 20, borderCurve: "continuous", backgroundColor: palette.souki900 }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255, 255, 255, 0.12)" }}>
        <Clock size={22} color={palette.mint300} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="callout" weight="heavy" color={palette.white} style={{ fontSize: 15 }}>
          {t("Modifiable jusqu'à 01h00")}
        </Text>
        <Text variant="footnote" weight="semibold" color={palette.mint300} style={{ fontSize: 13, lineHeight: 18 }}>
          {t("Ajoutez, retirez ou changez les quantités.")}
        </Text>
      </View>
      <AnimatedDigits value={value} weight="black" color={palette.white} style={{ fontSize: 22, lineHeight: 28 }} />
    </View>
  )
}

function SumRow({ label, value, free = false }: { label: string; value: string; free?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
      <Text variant="callout" color={palette.ink700} style={{ flexShrink: 1, fontSize: 15 }}>
        {label}
      </Text>
      <Text variant="callout" weight={free ? "black" : "heavy"} numeric color={free ? palette.market700 : palette.ink900} style={{ fontSize: 15 }}>
        {value}
      </Text>
    </View>
  )
}
