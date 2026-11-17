import { useEffect, useMemo, useRef, useState } from "react"
import { FlatList, Pressable, RefreshControl, View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { ArrowUpDown, Clock, Mic, X } from "lucide-react-native"
import {
  CATALOGUE_SORTS,
  productInCategory,
  productMatches,
  sectionName,
  sortProducts,
  type CatalogueProduct,
  type CatalogueSort,
} from "@souki/shared"

import { showActionSheetWithOptions } from "@/components/action-sheet"
import { BrandButton } from "@/components/brand-button"
import { EmptyState } from "@/components/empty-state"
import { FilterChips, ScreenTitle, SearchField, VoiceFab } from "@/components/m3"
import { ProductCard } from "@/components/product-card"
import { ProductCardSkeleton } from "@/components/skeleton"
import { useDockBottom, useDockInset } from "@/components/tab-bar"
import { Text } from "@/components/text"
import { useCart } from "@/contexts/cart-context"
import { useLocale } from "@/contexts/locale-context"
import { useCatalogue } from "@/hooks/use-catalogue"
import { useOpenAssistant } from "@/hooks/use-open-assistant"
import { useRefresh } from "@/hooks/use-refresh"
import { haptics } from "@/lib/haptics"
import { readJson, writeJson } from "@/lib/local-store"
import { colors, m3, SCREEN_PADDING, sizes, states, withAlpha } from "@/theme"

const GAP = 12
const ALL = "tout"
const RECENT_KEY = "souki.recherches.v1"
const RECENT_MAX = 5

type Group = { key: string; title: string; products: CatalogueProduct[] }
type Item =
  | { type: "header"; key: string; group: Group }
  | { type: "row"; key: string; products: CatalogueProduct[] }

/**
 * Onglet Produits (ScreenCatalog du design system Android) : grand titre, barre de recherche
 * (aussi en darija) avec micro, chips de rayon, nombre de produits et tri, grille de 2 colonnes.
 * Recherche sans résultat : explication, « Dicter ma liste » et recherches récentes.
 * Bouton vocal flottant réduit (décision 3).
 */
export function ProductsScreen() {
  const params = useLocalSearchParams<{ rayon?: string; focus?: string }>()
  const { t, locale, direction } = useLocale()
  const catalogue = useCatalogue()
  const { count } = useCart()
  const { refreshing, onRefresh } = useRefresh(catalogue.refetch)
  const openAssistant = useOpenAssistant()
  const dockInset = useDockInset()
  const dockBottom = useDockBottom()
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<CatalogueSort>("popular")
  const [filter, setFilter] = useState<string>(ALL)
  const [recent, setRecent] = useState<string[]>(() => readJson<string[]>(RECENT_KEY, []))
  const listRef = useRef<FlatList<Item>>(null)

  // Rayon demandé depuis l'accueil (tuile de rayon).
  useEffect(() => {
    if (params.rayon) setFilter(params.rayon)
  }, [params.rayon])

  const searching = query.trim().length > 0
  const groups = useMemo<Group[]>(() => {
    if (searching) {
      const results = sortProducts(catalogue.products.filter((product) => productMatches(product, query)), sort, locale)
      return results.length > 0 ? [{ key: "resultats", title: t("Résultats"), products: results }] : []
    }
    return catalogue.sections
      .filter((section) => filter === ALL || section.slug === filter)
      .map((section) => ({
        key: section.slug,
        title: sectionName(section, locale),
        products: sortProducts(catalogue.products.filter((product) => productInCategory(product, section.slug)), sort, locale),
      }))
      .filter((group) => group.products.length > 0)
  }, [catalogue.products, catalogue.sections, query, searching, sort, locale, t, filter])

  const showHeaders = !searching && filter === ALL && groups.length > 1
  const items = useMemo<Item[]>(() => {
    const list: Item[] = []
    for (const group of groups) {
      if (showHeaders) list.push({ type: "header", key: `h-${group.key}`, group })
      for (let index = 0; index < group.products.length; index += 2) {
        list.push({ type: "row", key: `${group.key}-${index}`, products: group.products.slice(index, index + 2) })
      }
    }
    return list
  }, [groups, showHeaders])

  const total = groups.reduce((sum, group) => sum + group.products.length, 0)
  const currentSort = CATALOGUE_SORTS.find((option) => option.id === sort) ?? CATALOGUE_SORTS[0]
  const chips = useMemo(
    () => [
      { key: ALL, label: t("Tout") },
      ...catalogue.sections.map((section) => ({ key: section.slug, label: sectionName(section, locale) })),
    ],
    [catalogue.sections, locale, t],
  )

  const remember = (text: string) => {
    const value = text.trim()
    if (!value) return
    const next = [value, ...recent.filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(0, RECENT_MAX)
    setRecent(next)
    writeJson(RECENT_KEY, next)
  }

  const forget = (value: string) => {
    const next = recent.filter((item) => item !== value)
    setRecent(next)
    writeJson(RECENT_KEY, next)
  }

  // Menu de tri (menu M3 en feuille du bas) : le tri en cours est coché.
  const openSortMenu = () => {
    const labels = CATALOGUE_SORTS.map((option) => (option.id === sort ? `✓  ${t(option.label)}` : t(option.label)))
    showActionSheetWithOptions({ title: t("Trier les produits"), options: [...labels, t("Annuler")], cancelButtonIndex: labels.length }, (index) => {
      const option = CATALOGUE_SORTS[index]
      if (!option) return
      haptics.selection()
      setSort(option.id)
      listRef.current?.scrollToOffset({ offset: 0, animated: true })
    })
  }

  const header = (
    <View style={{ gap: 12, paddingBottom: 4 }}>
      <ScreenTitle title={t("Produits")} style={{ paddingBottom: 0 }} />
      <SearchField
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={(event) => remember(event.nativeEvent.text)}
        onVoice={() => openAssistant("voice")}
        autoFocus={params.focus === "1"}
        placeholder={t("Chercher un produit")}
        accessibilityLabel={t("Rechercher, aussi en darija")}
        style={{ marginHorizontal: SCREEN_PADDING }}
      />
      {searching ? null : <FilterChips options={chips} selected={filter} onSelect={setFilter} />}
      {total > 0 ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingStart: SCREEN_PADDING, paddingEnd: 8 }}>
          <Text variant="bodyMedium" numeric color={m3.onSurfaceVariant}>
            {t(total === 1 ? "{n} produit" : "{n} produits", { n: total })}
          </Text>
          <Pressable
            onPress={openSortMenu}
            accessibilityRole="button"
            accessibilityLabel={`${t("Trier les produits")} : ${t(currentSort.label)}`}
            android_ripple={{ color: withAlpha(m3.secondary, states.pressed) }}
            style={{ minHeight: sizes.touchMin, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, borderRadius: 20, overflow: "hidden" }}
          >
            <ArrowUpDown size={18} color={m3.secondary} strokeWidth={2} />
            <Text variant="labelLarge" color={m3.secondary}>
              {t(currentSort.label)}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )

  const renderItem = ({ item }: { item: Item }) => {
    if (item.type === "header") {
      return (
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, paddingHorizontal: SCREEN_PADDING, paddingTop: 16, paddingBottom: 12 }}>
          <Text accessibilityRole="header" variant="titleLarge" color={m3.onSurface} style={{ flex: 1 }}>
            {item.group.title}
          </Text>
          <Text variant="bodySmall" numeric color={m3.onSurfaceVariant}>
            {t(item.group.products.length === 1 ? "{n} produit" : "{n} produits", { n: item.group.products.length })}
          </Text>
        </View>
      )
    }
    return (
      <View style={{ flexDirection: "row", gap: GAP, paddingHorizontal: SCREEN_PADDING, paddingBottom: GAP }}>
        {item.products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
        {item.products.length === 1 ? <View style={{ flex: 1 }} /> : null}
      </View>
    )
  }

  const loading = catalogue.isLoading

  const noResults = (
    <View style={{ paddingHorizontal: SCREEN_PADDING, paddingTop: 16, gap: 8 }}>
      <Text accessibilityRole="header" variant="titleLarge" color={m3.onSurface}>
        {t("Aucun produit pour « {recherche} »", { recherche: query.trim() })}
      </Text>
      <Text variant="bodyMedium" color={m3.onSurfaceVariant}>
        {t("Le marché de ce matin n'en avait pas. Vérifiez l'orthographe ou dictez votre liste.")}
      </Text>
      <View style={{ paddingTop: 8 }}>
        <BrandButton tone="soft" size="md" fill={false} icon={Mic} label={t("Dicter ma liste")} onPress={() => openAssistant("voice")} />
      </View>
      {recent.length > 0 ? (
        <View style={{ paddingTop: 24 }}>
          <Text variant="labelLarge" color={m3.onSurfaceVariant} style={{ paddingBottom: 4 }}>
            {t("Recherches récentes")}
          </Text>
          {recent.map((value) => (
            <View key={value} style={{ flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: m3.outlineVariant }}>
              <Pressable
                onPress={() => setQuery(value)}
                accessibilityRole="button"
                android_ripple={{ color: withAlpha(m3.onSurface, states.pressed) }}
                style={{ flex: 1, minHeight: sizes.touchMin, flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <Clock size={20} color={m3.secondary} strokeWidth={2} />
                <Text variant="bodyLarge" color={m3.onSurface}>
                  {value}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => forget(value)}
                accessibilityRole="button"
                accessibilityLabel={t("Retirer « {recherche} »", { recherche: value })}
                android_ripple={{ color: withAlpha(m3.onSurface, states.pressed), borderless: true, radius: 24 }}
                style={{ width: sizes.touchMin, height: sizes.touchMin, alignItems: "center", justifyContent: "center" }}
              >
                <X size={20} color={m3.secondary} strokeWidth={2} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )

  return (
    <View style={{ flex: 1, direction, backgroundColor: colors.background }}>
      <FlatList
        ref={listRef}
        data={loading || catalogue.isError ? [] : items}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={{ paddingBottom: 8 }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: dockInset + sizes.controlLg + 16, flexGrow: 1 }}
        initialNumToRender={10}
        windowSize={9}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[m3.primary]} progressBackgroundColor={m3.surfaceContainerHigh} />}
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingHorizontal: SCREEN_PADDING, gap: GAP }}>
              {[0, 1, 2].map((row) => (
                <View key={row} style={{ flexDirection: "row", gap: GAP }}>
                  <ProductCardSkeleton />
                  <ProductCardSkeleton />
                </View>
              ))}
            </View>
          ) : catalogue.isError ? (
            <EmptyState
              art="offline"
              title={t("Hors connexion")}
              description={t("Les prix changent chaque matin : reconnectez-vous pour voir ceux du jour.")}
              action={{ label: t("Réessayer"), onPress: () => void catalogue.refetch() }}
            />
          ) : searching ? (
            noResults
          ) : (
            <EmptyState art="search" title={t("Aucun résultat")} description={t("Aucun produit ne correspond à votre recherche.")} />
          )
        }
      />
      <VoiceFab extended={false} onPress={() => openAssistant("voice")} bottom={dockBottom + sizes.tabBar + (count > 0 ? sizes.cartBar + 8 : 0) + 16} />
    </View>
  )
}
