import { useEffect, useMemo, useState } from "react"
import { ActionSheetIOS, ActivityIndicator, Alert, KeyboardAvoidingView, Pressable, ScrollView, View } from "react-native"
import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { Banknote, CalendarDays, Check, Info, Pause, Play, Plus, Repeat, Search, SkipForward } from "lucide-react-native"
import {
  formatDeliveryDate,
  formatDirhams,
  formatPriceUnit,
  formatVariation,
  frequencyLabel,
  productMatches,
  productName,
  RECURRENCE_FREQUENCIES,
  RECURRENCE_STATUS_LABELS,
  resolveProductImage,
  roundToStep,
  type CatalogueProduct,
  type RecurrenceDTO,
} from "@souki/shared"

import { AnimatedDigits } from "@/components/animated-digits"
import { BrandButton } from "@/components/brand-button"
import { BrandEmptyState } from "@/components/brand-empty-state"
import { Note, TextField } from "@/components/form-fields"
import { LoyaltyCard } from "@/components/loyalty-parts"
import { ProductImage } from "@/components/product-image"
import { QuantityStepper } from "@/components/quantity-stepper"
import { SettingsGroup, SettingsRow } from "@/components/settings-group"
import { recurrenceName, recurrencePayment } from "@/components/subscription-card"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { useCatalogue } from "@/hooks/use-catalogue"
import { useRecurrences, useSoukiBaskets, useUpdateRecurrenceCache } from "@/hooks/use-loyalty"
import { ApiError, resumeRecurrence, skipRecurrence, stopRecurrence, updateRecurrence, updateRecurrenceLines } from "@/lib/api"
import { haptics } from "@/lib/haptics"
import { colors, palette, radius, shadows } from "@/theme"

type Line = { product_id: number; name: string; unit: string; quantite: number; prix: number; image: string; disponible: boolean }

/**
 * Gerer un abonnement (EcranAbonnements > Gerer, regles de mes-abonnements.tsx du site) :
 * produits modifiables, estimation (le montant exact est fixe a 01h00), rythme, paiement,
 * « Sauter la prochaine », « Mettre en pause » / « Reprendre », dernieres livraisons, « Arrêter ».
 */
export default function AbonnementScreen() {
  const router = useRouter()
  const { t, locale, dateLocale, direction } = useLocale()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { recurrences, isLoading } = useRecurrences()
  const baskets = useSoukiBaskets()
  const updateCache = useUpdateRecurrenceCache()
  const { products, productsById } = useCatalogue()
  const item = recurrences.find((entry) => entry.id === Number(id)) ?? null

  const toLines = (value: RecurrenceDTO): Line[] =>
    value.lignes.map((line) => ({
      product_id: line.product_id,
      name: line.nom_produit,
      unit: line.unite,
      quantite: line.quantite,
      prix: line.prix_unitaire,
      image: line.image_url || resolveProductImage(line.nom_produit, null),
      disponible: line.disponible,
    }))
  const [lines, setLines] = useState<Line[]>([])
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (item) setLines(toLines(item))
    // On repart des lignes du serveur a chaque nouvelle version de l'abonnement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item])

  const changed = useMemo(() => {
    if (!item) return false
    if (item.lignes.length !== lines.length) return true
    return lines.some((line) => item.lignes.find((original) => original.product_id === line.product_id)?.quantite !== line.quantite)
  }, [item, lines])

  if (!item) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {isLoading ? (
          <ActivityIndicator color={palette.market600} style={{ paddingTop: 140 }} />
        ) : (
          <BrandEmptyState art="orders" title={t("Abonnement introuvable")} description={t("Il a peut-être été arrêté.")} action={{ label: t("Abonnements"), onPress: () => router.back() }} />
        )}
      </View>
    )
  }

  const disabled = busy || !item.modifiable
  const name = recurrenceName(item, baskets.data, t, locale)
  const paused = item.statut === "EN_PAUSE"
  const nextDate = formatDeliveryDate(paused ? item.pause_jusqu_au : item.prochaine_livraison, dateLocale) ?? "—"

  const run = async (action: () => Promise<RecurrenceDTO>, success: string) => {
    setBusy(true)
    try {
      const next = await action()
      haptics.success()
      updateCache(next)
      Alert.alert(t(success))
      return next
    } catch (caught) {
      haptics.error()
      Alert.alert(t("Une erreur est survenue. Réessayez."), caught instanceof ApiError ? t(caught.message) : undefined)
      return null
    } finally {
      setBusy(false)
    }
  }

  const chooseFrequency = () => {
    const options = RECURRENCE_FREQUENCIES.map((frequency) => t(frequency.label))
    ActionSheetIOS.showActionSheetWithOptions({ title: t("Rythme de livraison"), options: [...options, t("Annuler")], cancelButtonIndex: options.length }, (index) => {
      const frequency = RECURRENCE_FREQUENCIES[index]
      if (frequency && frequency.value !== item.frequence) void run(() => updateRecurrence(item.id, { frequence: frequency.value }), "Rythme mis à jour.")
    })
  }

  const choosePayment = () => {
    const options = [t("Paiement à la livraison"), t("Wallet SOUKI")]
    ActionSheetIOS.showActionSheetWithOptions({ title: t("Mode de paiement"), options: [...options, t("Annuler")], cancelButtonIndex: options.length }, (index) => {
      const mode = index === 0 ? "cod" : index === 1 ? "wallet" : null
      if (mode && mode !== (item.mode_paiement === "wallet" ? "wallet" : "cod")) void run(() => updateRecurrence(item.id, { mode_paiement: mode }), "Paiement mis à jour.")
    })
  }

  const confirmStop = () => {
    Alert.alert(t("Arrêter l'abonnement ?"), t("Les prochaines commandes ne seront plus créées."), [
      { text: t("Garder l'abonnement"), style: "cancel" },
      {
        text: t("Arrêter"),
        style: "destructive",
        onPress: () => {
          void run(() => stopRecurrence(item.id), "Abonnement arrêté.").then((next) => {
            if (next) router.back()
          })
        },
      },
    ])
  }

  const saveLines = () => {
    if (lines.length === 0) return Alert.alert(t("Gardez au moins un produit, ou arrêtez l'abonnement."))
    void run(() => updateRecurrenceLines(item.id, lines.map(({ product_id, quantite }) => ({ product_id, quantite }))), "Liste mise à jour.")
  }

  const changeQuantity = (productId: number, quantity: number) =>
    setLines((current) => (quantity <= 0 ? current.filter((line) => line.product_id !== productId) : current.map((line) => (line.product_id === productId ? { ...line, quantite: Math.round(quantity * 1000) / 1000 } : line))))

  const addProduct = (product: CatalogueProduct) => {
    haptics.add()
    const existing = lines.find((line) => line.product_id === product.id)
    if (existing) return changeQuantity(product.id, roundToStep(existing.quantite + product.quantityStep, product.quantityStep))
    setLines((current) => [...current, { product_id: product.id, name: product.name, unit: product.unit, quantite: product.quantityStep, prix: product.price, image: product.image, disponible: true }])
  }

  const addable = products.filter((product) => product.availability !== "out_of_stock" && (!search.trim() || productMatches(product, search)))
  const status = RECURRENCE_STATUS_LABELS[item.statut] ?? item.statut
  const lastMotif = item.dernieres_livraisons[0]?.motif

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background, direction }}>
      <Stack.Screen options={{ title: name }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 14, paddingBottom: 32 }}>
        <Text variant="body" color={palette.ink500} style={{ fontSize: 15 }}>
          {`${t(frequencyLabel(item.frequence))} · ${recurrencePayment(item, t)}`}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderRadius: 18, borderCurve: "continuous", backgroundColor: paused ? palette.orange50 : palette.pale50 }}>
          <CalendarDays size={18} color={paused ? palette.orange700 : palette.souki900} strokeWidth={2.2} />
          <Text variant="footnote" weight="bold" color={paused ? palette.orange700 : palette.souki900} style={{ flex: 1, fontSize: 13 }}>
            {paused ? t("En pause jusqu'au {date}", { date: nextDate }) : t("Prochaine livraison : {date}", { date: nextDate })}
          </Text>
          <View style={{ height: 26, paddingHorizontal: 10, borderRadius: radius.pill, justifyContent: "center", backgroundColor: palette.white }}>
            <Text variant="footnote" weight="heavy" color={paused ? palette.orange700 : palette.market700} style={{ fontSize: 12 }}>
              {t(status)}
            </Text>
          </View>
        </View>

        {item.statut === "SUSPENDUE" ? (
          <Note tone="red">{t("Cet abonnement est suspendu{motif} Contactez SOUKI pour le réactiver.", { motif: lastMotif ? ` : ${t(lastMotif)}.` : "." })}</Note>
        ) : null}
        {Math.abs(item.variation_prix) >= 0.01 ? (
          <Note icon={Info} tone={item.variation_prix > 0 ? "orange" : "green"}>
            {t("Prix mis à jour : {variation} depuis votre dernière livraison", { variation: formatVariation(item.variation_prix) })}
          </Note>
        ) : null}
        {item.message ? <Note tone="orange">{t(item.message)}</Note> : null}

        <Text accessibilityRole="header" variant="title2" color={palette.ink900} style={{ fontSize: 21, marginTop: 6 }}>
          {t("Produits (prix du jour)")}
        </Text>
        <View style={{ gap: 8 }}>
          {lines.map((line) => {
            const live = productsById.get(line.product_id)
            const step = live?.quantityStep ?? (line.unit === "kg" ? 0.5 : 1)
            return (
              <View key={line.product_id} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: shadows.card, opacity: line.disponible ? 1 : 0.6 }}>
                <View style={{ width: 52, height: 52, borderRadius: 14, overflow: "hidden", backgroundColor: palette.photoBg }}>
                  <ProductImage uri={live?.image ?? line.image} variant="inset" style={{ width: 52, height: 52 }} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text variant="callout" weight="bold" color={palette.ink900} numberOfLines={1} style={{ fontSize: 15 }}>
                    {live ? productName(live, locale) : line.name}
                  </Text>
                  <Text variant="footnote" numeric color={palette.ink500} style={{ fontSize: 12 }}>
                    {`${formatDirhams(line.prix)} DH / ${formatPriceUnit(line.unit, locale)}${line.disponible ? "" : ` · ${t("indisponible aujourd'hui")}`}`}
                  </Text>
                </View>
                {item.modifiable ? (
                  <QuantityStepper size="small" quantity={line.quantite} step={step} unit={line.unit} onChange={(next) => changeQuantity(line.product_id, next)} />
                ) : null}
              </View>
            )
          })}
        </View>

        {item.modifiable ? (
          adding ? (
            <View style={{ gap: 10, padding: 14, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: shadows.card }}>
              <TextField icon={Search} value={search} onChangeText={setSearch} placeholder={t("Rechercher un produit")} autoCorrect={false} />
              {addable.slice(0, 30).map((product) => (
                <View key={product.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, overflow: "hidden", backgroundColor: palette.photoBg }}>
                    <ProductImage uri={product.image} variant="inset" style={{ width: 40, height: 40 }} />
                  </View>
                  <Text variant="callout" weight="semibold" color={palette.ink900} numberOfLines={1} style={{ flex: 1, fontSize: 14 }}>
                    {`${productName(product, locale)} · ${formatDirhams(product.price)} DH`}
                  </Text>
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
            <BrandButton tone="soft" icon={Plus} label={t("Ajouter un produit")} onPress={() => setAdding(true)} />
          )
        ) : null}
        {changed ? <BrandButton icon={Check} label={busy ? t("Enregistrement…") : t("Enregistrer la liste")} disabled={disabled} onPress={saveLines} /> : null}

        <View style={{ padding: 18, gap: 10, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: shadows.card }}>
          <Row label={t("Produits (prix du jour)")} value={`${formatDirhams(item.sous_total_estime)} DH`} />
          <Row label={t("Livraison")} value={item.frais_livraison_estimes > 0 ? `${formatDirhams(item.frais_livraison_estimes)} DH` : t("Offerte")} free={item.frais_livraison_estimes === 0} />
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingTop: 10, borderTopWidth: 1, borderTopColor: palette.line }}>
            <Text variant="headline" weight="black" color={palette.ink900} style={{ fontSize: 17 }}>
              {t("Estimation")}
            </Text>
            <AnimatedDigits value={`${formatDirhams(item.total_estime)} DH`} weight="black" color={palette.souki900} style={{ fontSize: 24, lineHeight: 30 }} />
          </View>
          <Text variant="footnote" color={palette.ink500} style={{ fontSize: 12 }}>
            {t("Le montant exact est fixé à 01h00 le jour de la livraison, au prix du site.")}
          </Text>
        </View>

        <SettingsGroup>
          <SettingsRow icon={Repeat} label={t("Rythme de livraison")} value={t(frequencyLabel(item.frequence))} onPress={disabled ? undefined : chooseFrequency} />
          <SettingsRow icon={Banknote} label={t("Mode de paiement")} value={item.mode_paiement === "wallet" ? t("Wallet SOUKI") : t("À la livraison")} onPress={disabled ? undefined : choosePayment} />
        </SettingsGroup>

        {item.statut === "ACTIVE" ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <BrandButton tone="soft" size="md" icon={SkipForward} label={t("Sauter la prochaine")} disabled={disabled} onPress={() => void run(() => skipRecurrence(item.id), "Livraison sautée.")} />
            </View>
            <View style={{ flex: 1 }}>
              <BrandButton tone="soft" size="md" icon={Pause} label={t("Mettre en pause")} disabled={disabled} onPress={() => router.push(`/abonnement-pause/${item.id}`)} />
            </View>
          </View>
        ) : paused ? (
          <BrandButton icon={Play} label={t("Reprendre")} disabled={disabled} onPress={() => void run(() => resumeRecurrence(item.id), "Abonnement repris.")} />
        ) : null}

        {item.dernieres_livraisons.length > 0 ? (
          <LoyaltyCard title={t("Dernières livraisons")}>
            {item.dernieres_livraisons.map((delivery, index) => {
              const created = delivery.statut === "CREEE"
              const skipped = delivery.statut === "SAUTEE"
              const Icon = skipped ? SkipForward : Check
              return (
                <Pressable
                  key={delivery.date_livraison}
                  disabled={!delivery.commande_id}
                  onPress={() => delivery.commande_id && router.navigate(`/suivi/${delivery.commande_id}`)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: palette.line }}
                >
                  <Icon size={16} color={palette.ink500} strokeWidth={2.4} />
                  <Text variant="footnote" weight="semibold" color={palette.ink900} style={{ flex: 1, fontSize: 13 }}>
                    {formatDeliveryDate(delivery.date_livraison, dateLocale) ?? delivery.date_livraison}
                    {delivery.motif ? ` · ${t(delivery.motif)}` : ""}
                  </Text>
                  <View style={{ height: 26, paddingHorizontal: 10, borderRadius: radius.pill, justifyContent: "center", backgroundColor: created ? palette.pale50 : palette.orange50 }}>
                    <Text variant="footnote" weight="heavy" color={created ? palette.market700 : palette.orange700} style={{ fontSize: 12 }}>
                      {created ? t("Commande créée") : skipped ? t("Sautée") : t("Non créée")}
                    </Text>
                  </View>
                </Pressable>
              )
            })}
          </LoyaltyCard>
        ) : null}

        {item.statut !== "ARRETEE" ? (
          <View style={{ padding: 16, gap: 10, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white, borderWidth: 1.5, borderColor: "#F6CACA" }}>
            <Text variant="headline" weight="heavy" color={palette.red600} style={{ fontSize: 16 }}>
              {t("Arrêter l'abonnement")}
            </Text>
            <Text variant="footnote" color={palette.ink500} style={{ fontSize: 13, lineHeight: 18 }}>
              {t("Les prochaines commandes ne seront plus créées.")}
            </Text>
            <BrandButton tone="danger" size="md" fill={false} label={t("Arrêter")} disabled={disabled} onPress={confirmStop} />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function Row({ label, value, free = false }: { label: string; value: string; free?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
      <Text variant="callout" color={palette.ink700} style={{ fontSize: 15 }}>
        {label}
      </Text>
      <Text variant="callout" weight={free ? "black" : "heavy"} numeric color={free ? palette.market700 : palette.ink900} style={{ fontSize: 15 }}>
        {value}
      </Text>
    </View>
  )
}
