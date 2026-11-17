import { useCallback, useEffect, useRef } from "react"
import { ActivityIndicator, RefreshControl, ScrollView, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"
import { Gift, Info, Receipt } from "lucide-react-native"
import { formatOrderDay } from "@souki/shared"

import { BrandButton } from "@/components/brand-button"
import { BrandEmptyState } from "@/components/brand-empty-state"
import { Note } from "@/components/form-fields"
import { LoyaltyCard, RulesList, TransactionRow, WalletCard } from "@/components/loyalty-parts"
import { useDockInset } from "@/components/tab-bar"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { useWallet } from "@/hooks/use-loyalty"
import { useRefresh } from "@/hooks/use-refresh"
import { haptics } from "@/lib/haptics"
import { colors, palette, radius, shadows } from "@/theme"

/**
 * Wallet SOUKI (EcranWallet, design system 2027) : carte a deux soldes (credit offert, utilise
 * en premier, et remboursements), historique avec les libelles du site, « Bon à savoir ». Pas
 * de « Recharger » ni « Envoyer » : ces fonctions n'existent pas. Credit recu : le solde roule,
 * la barre s'allonge et haptique de succes.
 */
export default function WalletScreen() {
  const router = useRouter()
  const { t, dateLocale, direction } = useLocale()
  const dockInset = useDockInset()
  const { data, isLoading, isError, refetch } = useWallet()
  const { refreshing, onRefresh } = useRefresh(refetch)
  const previous = useRef<number | null>(null)

  useFocusEffect(
    useCallback(() => {
      void refetch()
    }, [refetch]),
  )

  const balance = (data?.balance_centimes ?? 0) / 100
  const gift = (data?.solde_offert_centimes ?? 0) / 100
  const refund = data?.solde_rembourse_centimes !== undefined ? data.solde_rembourse_centimes / 100 : Math.max(0, balance - gift)

  useEffect(() => {
    if (!data) return
    if (previous.current !== null && balance > previous.current) haptics.success()
    previous.current = balance
  }, [data, balance])

  const transactions = data?.transactions ?? []
  const empty = Boolean(data) && balance <= 0 && transactions.length === 0

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ direction, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 14, paddingBottom: dockInset }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={palette.market600} />}
    >
      {isLoading ? (
        <View style={{ paddingVertical: 60, alignItems: "center" }}>
          <ActivityIndicator color={palette.market600} />
        </View>
      ) : isError && !data ? (
        <View style={{ gap: 12 }}>
          <Note tone="red">{t("Impossible de charger votre Wallet pour le moment.")}</Note>
          <BrandButton tone="soft" label={t("Réessayer")} onPress={() => void refetch()} />
        </View>
      ) : (
        <>
          <WalletCard gift={gift} refund={refund} />
          {empty ? (
            <View style={{ marginHorizontal: -16 }}>
              <BrandEmptyState
                art="favorites"
                title={t("Votre Wallet est vide")}
                description={t("Il se remplit avec vos remboursements (réclamation, annulation) et vos crédits de parrainage. Il se déduit ensuite du montant à payer.")}
                action={{ label: t("Parrainer un proche"), onPress: () => router.push("/parrainage") }}
                actionTone="soft"
              />
            </View>
          ) : (
            <>
              <Note icon={Info}>{t("Votre crédit se déduit du montant à payer ; le reste se règle en cash à la livraison. Le crédit offert est utilisé en premier.")}</Note>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <BrandButton tone="soft" size="md" icon={Gift} label={t("Parrainer")} onPress={() => router.push("/parrainage")} />
                </View>
                <View style={{ flex: 1 }}>
                  <BrandButton tone="soft" size="md" icon={Receipt} label={t("Mes commandes")} onPress={() => router.navigate("/commandes")} />
                </View>
              </View>
              {transactions.length > 0 ? (
                <>
                  <Text accessibilityRole="header" variant="title2" color={palette.ink900} style={{ fontSize: 21, marginTop: 6 }}>
                    {t("Historique")}
                  </Text>
                  <View style={{ borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: shadows.card, overflow: "hidden" }}>
                    {transactions.map((transaction, index) => (
                      <TransactionRow
                        key={transaction.id}
                        first={index === 0}
                        type={transaction.type}
                        amount={transaction.montant_centimes / 100}
                        date={formatOrderDay(transaction.date, dateLocale, true) ?? ""}
                      />
                    ))}
                  </View>
                </>
              ) : null}
            </>
          )}
          <LoyaltyCard title={t("Bon à savoir")}>
            <RulesList
              rules={[
                t("L'argent remboursé (réclamation, annulation) vous revient toujours."),
                t("Commande refusée à la porte : le crédit offert utilisé est perdu, le trajet du livreur ayant déjà été payé."),
              ]}
            />
          </LoyaltyCard>
        </>
      )}
    </ScrollView>
  )
}
