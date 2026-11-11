import { useState } from "react"
import { Pressable, ScrollView, View } from "react-native"
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated"
import { useLocalSearchParams, useRouter } from "expo-router"
import { LinearGradient } from "expo-linear-gradient"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Check, Wallet } from "lucide-react-native"
import {
  canClaimOrder,
  CLAIM_REASONS,
  claimRefund,
  formatDirhams,
  formatOrderDay,
  formatQuantity,
  productName,
  roundToStep,
  type ClaimReason,
  type OrderProductDTO,
} from "@souki/shared"

import { AnimatedDigits } from "@/components/animated-digits"
import { BrandButton } from "@/components/brand-button"
import { BrandEmptyState } from "@/components/brand-empty-state"
import { Note } from "@/components/form-fields"
import { PhotoSlot, type PickedPhoto } from "@/components/photo-slot"
import { ProductImage } from "@/components/product-image"
import { QuantityStepper } from "@/components/quantity-stepper"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { useCatalogue } from "@/hooks/use-catalogue"
import { orderLineImage, useInvalidateOrders, useOrder } from "@/hooks/use-orders"
import { ApiError, submitClaim, uploadClaimPhoto } from "@/lib/api"
import { haptics } from "@/lib/haptics"
import { DUR_BASE, EASE_OUT_2027 } from "@/lib/motion"
import { colors, palette, radius, shadows } from "@/theme"

type Selection = { reason: ClaimReason | null; quantity: number; photo?: PickedPhoto | null }

/**
 * Signaler un probleme (EcranReclamation, regles de claim_service.py) : commande livree,
 * dans les 24 h, ligne par ligne, quantite au plus egale a la quantite commandee, un des 6
 * motifs. Le montant est recredite aussitot sur le Wallet. Photo optionnelle par ligne (B5) :
 * envoyee juste apres la reclamation (POST /api/v1/claims/photo) ; si elle echoue, le
 * remboursement reste acquis et l'ecran le dit.
 */
export default function ReclamationScreen() {
  const router = useRouter()
  const { t, dateLocale, direction } = useLocale()
  const insets = useSafeAreaInsets()
  const invalidateOrders = useInvalidateOrders()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { order } = useOrder(Number(id))
  const { productsById } = useCatalogue()
  const [selected, setSelected] = useState<Record<number, Selection>>({})
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ refunded: number; balance: number; photosFailed: number } | null>(null)

  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <BrandEmptyState art="orders" title={t("Commande introuvable")} description={t("Cette commande est introuvable dans votre compte.")} action={{ label: t("Voir mes commandes"), onPress: () => router.back() }} />
      </View>
    )
  }

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, direction }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}>
          <BrandEmptyState
            art="favorites"
            title={t("{montant} DH remboursés", { montant: formatDirhams(done.refunded) })}
            description={t("Merci de nous l'avoir signalé. Le montant est recrédité sur votre Wallet SOUKI.")}
          />
          <View style={{ marginHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: radius.card, borderCurve: "continuous", overflow: "hidden", backgroundColor: palette.souki900 }}>
            <LinearGradient colors={[palette.souki900, palette.forest800]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
            <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255, 255, 255, 0.14)" }}>
              <Wallet size={22} color={palette.white} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="footnote" weight="semibold" color={palette.mint300} style={{ fontSize: 12 }}>
                {t("Nouveau solde du Wallet")}
              </Text>
              <AnimatedDigits value={`${formatDirhams(done.balance)} DH`} weight="black" color={palette.white} style={{ fontSize: 22, lineHeight: 28 }} />
            </View>
            <View style={{ height: 26, paddingHorizontal: 10, borderRadius: radius.pill, justifyContent: "center", backgroundColor: palette.leaf500 }}>
              <Text variant="footnote" weight="heavy" numeric color={palette.white} style={{ fontSize: 12 }}>
                {`+ ${formatDirhams(done.refunded)} DH`}
              </Text>
            </View>
          </View>
          {done.photosFailed > 0 ? (
            <View style={{ marginHorizontal: 16, marginTop: 12 }}>
              <Note tone="orange">{t("La photo n'a pas pu être envoyée. Votre remboursement est bien enregistré.")}</Note>
            </View>
          ) : null}
        </ScrollView>
        <View style={{ gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) }}>
          <BrandButton icon={Wallet} label={t("Voir mon Wallet")} onPress={() => router.navigate("/wallet", { withAnchor: true })} />
          <BrandButton tone="soft" label={t("Retour à la commande")} onPress={() => router.back()} />
        </View>
      </View>
    )
  }

  if (!canClaimOrder(order)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <BrandEmptyState
          art="offline"
          title={t("Réclamation impossible")}
          description={t("La fenêtre de réclamation de 24 h est expirée pour cette commande.")}
          action={{ label: t("Voir mes commandes"), onPress: () => router.back() }}
          actionTone="soft"
        />
      </View>
    )
  }

  const lines = order.produits.filter((line) => typeof line.ligne_panier_id === "number" && line.quantite_kg > 0)
  const chosen = lines.filter((line) => selected[line.ligne_panier_id as number]?.reason)
  const total = chosen.reduce((sum, line) => sum + claimRefund(line, selected[line.ligne_panier_id as number].quantity), 0)

  const send = async () => {
    if (chosen.length === 0 || sending) return
    setSending(true)
    setError(null)
    try {
      const result = await submitClaim({
        commande_id: order.id,
        items: chosen.map((line) => {
          const selection = selected[line.ligne_panier_id as number]
          return { ligne_panier_id: line.ligne_panier_id as number, quantity_claimed: selection.quantity, reason: selection.reason as ClaimReason }
        }),
      })
      // Photos facultatives, une par ligne : un echec n'annule pas le remboursement deja fait.
      let photosFailed = 0
      for (const line of chosen) {
        const photo = selected[line.ligne_panier_id as number].photo
        if (!photo) continue
        try {
          await uploadClaimPhoto(order.id, line.ligne_panier_id as number, photo.uri, photo.mimeType)
        } catch {
          photosFailed += 1
        }
      }
      haptics.success()
      void invalidateOrders()
      setDone({ refunded: Number(result.amount_refunded) || 0, balance: Number(result.new_wallet_balance) || 0, photosFailed })
    } catch (caught) {
      haptics.error()
      setError(caught instanceof ApiError ? t(caught.message) : t("Impossible d'envoyer la réclamation."))
    } finally {
      setSending(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, direction }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 12, paddingBottom: 24 }}>
        <Text variant="body" color={palette.ink500} style={{ fontSize: 15, lineHeight: 21 }}>
          {t("Livrée le {date}. Possible pendant 24 h après la livraison.", { date: formatOrderDay(order.delivered_at, dateLocale, true) ?? "" })}
        </Text>
        <Text variant="footnote" weight="bold" color={palette.ink500} style={{ fontSize: 13 }}>
          {t("Quels produits sont concernés ?")}
        </Text>
        {lines.map((line) => {
          const key = line.ligne_panier_id as number
          return (
            <ClaimLine
              key={key}
              line={line}
              image={orderLineImage(line, productsById)}
              selection={selected[key] ?? null}
              onChange={(selection) =>
                setSelected((current) => {
                  const next = { ...current }
                  if (selection) next[key] = selection
                  else delete next[key]
                  return next
                })
              }
            />
          )
        })}
        {lines.length === 0 ? <Note tone="orange">{t("Cette commande ne contient aucune ligne eligible au SAV.")}</Note> : null}
        {error ? <Note tone="red">{error}</Note> : null}
      </ScrollView>
      <View style={{ marginHorizontal: 12, marginBottom: Math.max(insets.bottom, 12), padding: 10, gap: 8, borderRadius: 30, borderCurve: "continuous", backgroundColor: palette.glass, boxShadow: `${shadows.float}, inset 0 0 0 1px rgba(255, 255, 255, 0.8)` }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 8 }}>
          <Text variant="footnote" weight="semibold" color={palette.ink500} style={{ fontSize: 13 }}>
            {t("Remboursé sur le Wallet")}
          </Text>
          <AnimatedDigits value={`${formatDirhams(total)} DH`} weight="black" color={palette.souki900} style={{ fontSize: 17, lineHeight: 22 }} />
        </View>
        <BrandButton icon={Check} label={sending ? t("Envoi…") : t("Envoyer la réclamation")} disabled={total <= 0 || sending} onPress={() => void send()} />
      </View>
    </View>
  )
}

/**
 * Ligne de reclamation (ClaimLine) : on coche le produit, la carte s'ouvre (240 ms) sur les
 * motifs et la quantite concernee ; le montant rembourse s'affiche aussitot.
 */
function ClaimLine({ line, image, selection, onChange }: { line: OrderProductDTO; image: string; selection: Selection | null; onChange: (selection: Selection | null) => void }) {
  const { t, locale } = useLocale()
  const reducedMotion = useReducedMotion()
  const { productsById } = useCatalogue()
  const live = line.product_id ? productsById.get(line.product_id) : undefined
  const unit = live?.unit ?? "kg"
  const step = Math.min(live?.quantityStep ?? (unit === "kg" ? 0.5 : 1), line.quantite_kg)
  const name = live ? productName(live, locale) : locale === "ar" && line.nom_ar ? line.nom_ar : line.nom_fr
  const on = selection !== null

  return (
    <View style={{ borderRadius: 20, borderCurve: "continuous", overflow: "hidden", backgroundColor: palette.white, borderWidth: on ? 2 : 1.5, borderColor: on ? palette.souki900 : palette.line, boxShadow: on ? shadows.card : undefined }}>
      <Pressable
        onPress={() => {
          haptics.selection()
          onChange(on ? null : { reason: null, quantity: step })
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        accessibilityLabel={name}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 12, opacity: pressed ? 0.85 : 1 })}
      >
        <View style={{ width: 24, height: 24, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: on ? palette.souki900 : "transparent", borderWidth: on ? 0 : 2, borderColor: palette.ink300 }}>
          {on ? <Check size={14} color={palette.white} strokeWidth={3.2} /> : null}
        </View>
        <View style={{ width: 52, height: 52, borderRadius: 14, overflow: "hidden", backgroundColor: palette.photoBg }}>
          <ProductImage uri={image} variant="inset" style={{ width: 52, height: 52 }} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="callout" weight="bold" color={palette.ink900} numberOfLines={1} style={{ fontSize: 15 }}>
            {name}
          </Text>
          <Text variant="footnote" numeric color={palette.ink500} style={{ fontSize: 12 }}>
            {`${formatQuantity(line.quantite_kg, unit, locale)} · ${formatDirhams(line.sous_total ?? 0)} DH`}
          </Text>
        </View>
      </Pressable>
      {on ? (
        <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(DUR_BASE).easing(EASE_OUT_2027)} style={{ paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4, gap: 12 }}>
          <View accessibilityRole="radiogroup" accessibilityLabel={t("Motif")} style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {CLAIM_REASONS.map((reason) => {
              const active = selection.reason === reason.id
              return (
                <Pressable
                  key={reason.id}
                  onPress={() => {
                    haptics.selection()
                    onChange({ ...selection, reason: reason.id })
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  hitSlop={{ top: 4, bottom: 4 }}
                  style={({ pressed }) => ({
                    height: 36,
                    paddingHorizontal: 14,
                    borderRadius: radius.pill,
                    justifyContent: "center",
                    backgroundColor: active ? palette.souki900 : palette.white,
                    borderWidth: active ? 0 : 1.5,
                    borderColor: palette.line,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Text variant="footnote" weight="bold" color={active ? palette.white : palette.ink700} style={{ fontSize: 13 }}>
                    {t(reason.label)}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <Text variant="footnote" weight="bold" color={palette.ink900} style={{ fontSize: 13 }}>
              {t("Quantité concernée")}
            </Text>
            <QuantityStepper
              size="small"
              removable={false}
              quantity={selection.quantity}
              step={step}
              unit={unit}
              max={line.quantite_kg}
              onChange={(next) => onChange({ ...selection, quantity: Math.min(line.quantite_kg, Math.max(step, roundToStep(next, step))) })}
            />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <PhotoSlot title={t("Photo du produit")} photo={selection.photo ?? null} onChange={(photo) => onChange({ ...selection, photo })} />
            <Text variant="footnote" color={palette.ink500} style={{ flex: 1, fontSize: 12, lineHeight: 17 }}>
              {t("Photo facultative : elle aide SOUKI à améliorer la qualité.")}
            </Text>
          </View>
          {selection.reason ? (
            <View style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: palette.pale50 }}>
              <Text variant="footnote" weight="semibold" color={palette.souki900} style={{ fontSize: 13 }}>
                {t("Remboursé sur le Wallet : {montant} DH", { montant: formatDirhams(claimRefund(line, selection.quantity)) })}
              </Text>
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  )
}
