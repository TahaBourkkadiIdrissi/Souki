import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from "react"
import { ActionSheetIOS, FlatList, Pressable, RefreshControl, ScrollView, View, type LayoutRectangle } from "react-native"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated"
import { Stack, useLocalSearchParams } from "expo-router"
import { ChevronDown } from "lucide-react-native"
import {
  CATALOGUE_SORTS,
  productInCategory,
  productMatches,
  sectionName,
  sortProducts,
  type CatalogueProduct,
  type CatalogueSort,
} from "@souki/shared"

import { AssistantPills } from "@/components/assistant-cards"
import { EmptyState } from "@/components/empty-state"
import { ProductCard } from "@/components/product-card"
import { ProductCardSkeleton } from "@/components/skeleton"
import { useDockInset } from "@/components/tab-bar"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { useCatalogue } from "@/hooks/use-catalogue"
import { useOpenAssistant } from "@/hooks/use-open-assistant"
import { useRefresh } from "@/hooks/use-refresh"
import { haptics } from "@/lib/haptics"
import { DUR_BASE, EASE_OUT_2027, SPRING_FINGER } from "@/lib/motion"
import { colors, palette, SCREEN_PADDING, shadows } from "@/theme"

const GAP = 12
const CHIPS_HEIGHT = 60

type Group = { key: string; title: string; icon: string | null; products: CatalogueProduct[] }
type Item =
  | { type: "intro"; key: "intro" }
  | { type: "chips"; key: "chips" }
  | { type: "sort"; key: "sort" }
  | { type: "header"; key: string; group: Group }
  | { type: "row"; key: string; group: string; products: CatalogueProduct[] }

/**
 * Onglet Produits (EcranCatalogue, design system 2027) : grand titre qui se reduit, prix du
 * jour du marche de gros, recherche native (aussi en darija), raccourcis vers les deux
 * assistants, barre de rayons collee dont l'indicateur suit le rayon visible, tri systeme
 * et grilles de 2 colonnes par rayon.
 */
export function ProductsScreen() {
  const params = useLocalSearchParams<{ rayon?: string; focus?: string }>()
  const { t, locale, direction } = useLocale()
  const catalogue = useCatalogue()
  const { refreshing, onRefresh } = useRefresh(catalogue.refetch)
  const openAssistant = useOpenAssistant()
  const dockInset = useDockInset()
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<CatalogueSort>("popular")
  const [active, setActive] = useState<string | null>(null)
  const listRef = useRef<FlatList<Item>>(null)
  const scrollingTo = useRef<string | null>(null)

  const searching = query.trim().length > 0
  const groups = useMemo<Group[]>(() => {
    if (searching) {
      const results = sortProducts(catalogue.products.filter((product) => productMatches(product, query)), sort, locale)
      return results.length > 0 ? [{ key: "resultats", title: t("Résultats"), icon: null, products: results }] : []
    }
    return catalogue.sections
      .map((section) => ({
        key: section.slug,
        title: sectionName(section, locale),
        icon: section.icone,
        products: sortProducts(catalogue.products.filter((product) => productInCategory(product, section.slug)), sort, locale),
      }))
      .filter((group) => group.products.length > 0)
  }, [catalogue.products, catalogue.sections, query, searching, sort, locale, t])

  const items = useMemo<Item[]>(() => {
    const list: Item[] = [{ type: "intro", key: "intro" }, { type: "chips", key: "chips" }, { type: "sort", key: "sort" }]
    for (const group of groups) {
      list.push({ type: "header", key: `h-${group.key}`, group })
      for (let index = 0; index < group.products.length; index += 2) {
        list.push({ type: "row", key: `${group.key}-${index}`, group: group.key, products: group.products.slice(index, index + 2) })
      }
    }
    return list
  }, [groups])

  const headerIndex = useCallback((key: string) => items.findIndex((item) => item.type === "header" && item.group.key === key), [items])

  const jumpTo = useCallback(
    (key: string, animated = true) => {
      const index = headerIndex(key)
      if (index < 0) return
      scrollingTo.current = key
      setActive(key)
      listRef.current?.scrollToIndex({ index, animated, viewOffset: CHIPS_HEIGHT - 4 })
      setTimeout(() => {
        scrollingTo.current = null
      }, 600)
    },
    [headerIndex],
  )

  // Rayon demande depuis l'accueil : on y descend une fois la liste prete.
  const handledRayon = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!params.rayon || handledRayon.current === params.rayon || groups.length === 0) return
    handledRayon.current = params.rayon
    const timer = setTimeout(() => jumpTo(params.rayon!, true), 350)
    return () => clearTimeout(timer)
  }, [params.rayon, groups.length, jumpTo])

  useEffect(() => {
    if (!active && groups[0]) setActive(groups[0].key)
  }, [groups, active])

  // Suivi du defilement : le premier rayon visible devient actif.
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: { item: Item }[] }) => {
    if (scrollingTo.current) return
    const first = viewableItems.find((token) => token.item.type === "header" || token.item.type === "row")
    if (!first) return
    const key = first.item.type === "header" ? first.item.group.key : first.item.type === "row" ? first.item.group : null
    if (key) setActive((current) => (current === key ? current : key))
  }).current

  const renderItem = ({ item }: { item: Item }) => {
    if (item.type === "intro") {
      return (
        <View style={{ gap: 12, paddingBottom: 8 }}>
          <Text variant="footnote" weight="semibold" color={palette.ink500} style={{ paddingHorizontal: SCREEN_PADDING }}>
            {t("Prix du jour · marché de gros de Fès")}
          </Text>
          {searching ? null : <AssistantPills onVoice={() => openAssistant("voice")} onSmart={() => openAssistant("smart")} />}
        </View>
      )
    }
    if (item.type === "sort") {
      const total = groups.reduce((sum, group) => sum + group.products.length, 0)
      const current = CATALOGUE_SORTS.find((option) => option.id === sort) ?? CATALOGUE_SORTS[0]
      return (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SCREEN_PADDING }}>
          <Text variant="footnote" weight="bold" numeric color={palette.ink500} style={{ fontSize: 12 }}>
            {t(total === 1 ? "{n} produit" : "{n} produits", { n: total })}
          </Text>
          <Pressable
            onPress={openSortMenu}
            accessibilityRole="button"
            accessibilityLabel={`${t("Trier les produits")} : ${t(current.label)}`}
            style={({ pressed }) => ({ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4, opacity: pressed ? 0.6 : 1 })}
          >
            <Text variant="footnote" weight="semibold" color={palette.ink500}>
              {`${t("Trier")} · `}
              <Text variant="footnote" weight="heavy" color={palette.souki900}>
                {t(current.label)}
              </Text>
            </Text>
            <ChevronDown size={14} color={palette.souki900} strokeWidth={2.6} />
          </Pressable>
        </View>
      )
    }
    if (item.type === "chips") {
      return (
        <RayonBar
          groups={groups}
          active={active}
          onSelect={(key) => {
            haptics.selection()
            jumpTo(key)
          }}
        />
      )
    }
    if (item.type === "header") {
      return (
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, paddingHorizontal: SCREEN_PADDING, paddingTop: 22, paddingBottom: 12 }}>
          <Text accessibilityRole="header" variant="title2" color={palette.ink900} style={{ flex: 1 }}>
            {item.group.title}
          </Text>
          <Text variant="footnote" weight="bold" numeric color={palette.ink500} style={{ fontSize: 12 }}>
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

  // SortMenu : feuille d'actions systeme (ActionSheetIOS, comme prevu par la passation) ;
  // le tri en cours est marque d'une coche.
  const openSortMenu = () => {
    const labels = CATALOGUE_SORTS.map((option) => (option.id === sort ? `${t(option.label)}  ✓` : t(option.label)))
    ActionSheetIOS.showActionSheetWithOptions(
      { title: t("Trier les produits"), options: [...labels, t("Annuler")], cancelButtonIndex: labels.length, tintColor: palette.souki900 },
      (index) => {
        const option = CATALOGUE_SORTS[index]
        if (!option) return
        haptics.selection()
        setSort(option.id)
      },
    )
  }

  return (
    <>
      <FlatList
        ref={listRef}
        data={loading || catalogue.isError ? [] : items}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        stickyHeaderIndices={loading || catalogue.isError ? undefined : [1]}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 30, minimumViewTime: 60 }}
        onScrollToIndexFailed={({ index, averageItemLength }) =>
          listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: true })
        }
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        style={{ direction, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: dockInset, flexGrow: 1 }}
        initialNumToRender={12}
        windowSize={9}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.market600} />}
        ListEmptyComponent={
          loading ? (
            <View style={{ padding: SCREEN_PADDING, gap: GAP }}>
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
          ) : (
            <EmptyState art="search" title={t("Aucun résultat")} description={t("Aucun produit ne correspond à votre recherche.")} />
          )
        }
        ListFooterComponent={
          searching && groups.length === 0 ? (
            <EmptyState
              art="search"
              title={t("Aucun résultat pour « {recherche} »", { recherche: query.trim() })}
              description={t("SOUKI vend les fruits, légumes et herbes du marché de gros de Fès. Essayez « tomates » ou un nom en darija, comme « maticha ».")}
            />
          ) : undefined
        }
      />
      <Stack.SearchBar
        placeholder={t("Rechercher, aussi en darija")}
        autoFocus={params.focus === "1"}
        onChangeText={(event) => setQuery(event.nativeEvent.text)}
        onCancelButtonPress={() => setQuery("")}
        cancelButtonText={t("Annuler")}
        hideWhenScrolling={false}
        tintColor={palette.green900}
      />
    </>
  )
}

/**
 * Barre de rayons collee (CategoryBar, design system 2027) : l'indicateur souki-900 glisse
 * vers le rayon visible (translation en ressort, largeur en ease-out sur dur-base) ; chaque
 * pastille montre le nombre de produits.
 */
function RayonBar({ groups, active, onSelect }: { groups: Group[]; active: string | null; onSelect: (key: string) => void }) {
  const { direction } = useLocale()
  const reducedMotion = useReducedMotion()
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null)
  const [layouts, setLayouts] = useState<Record<string, LayoutRectangle>>({})
  const x = useSharedValue(0)
  const width = useSharedValue(0)

  useEffect(() => {
    const layout = active ? layouts[active] : undefined
    if (!layout) return
    if (reducedMotion) {
      x.set(layout.x)
      width.set(layout.width)
    } else {
      x.set(withSpring(layout.x, SPRING_FINGER))
      width.set(withTiming(layout.width, { duration: DUR_BASE, easing: EASE_OUT_2027 }))
    }
    scrollRef.current?.scrollTo({ x: Math.max(0, layout.x - 80), animated: true })
  }, [active, layouts, reducedMotion, x, width])

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }], width: width.get() }))

  if (groups.length <= 1) return <View style={{ height: 4, backgroundColor: colors.background }} />

  return (
    <View style={{ height: CHIPS_HEIGHT, justifyContent: "center", backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: palette.line }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ direction: "ltr", flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING, alignItems: "center" }}
      >
        <View style={{ flexDirection: direction === "rtl" ? "row-reverse" : "row", gap: 6 }}>
          <Animated.View
            pointerEvents="none"
            style={[{ position: "absolute", top: 0, height: 40, borderRadius: 20, backgroundColor: palette.souki900, boxShadow: shadows.button }, pillStyle]}
          />
          {groups.map((group) => {
            const selected = group.key === active
            return (
              <Pressable
                key={group.key}
                onPress={() => onSelect(group.key)}
                onLayout={(event) => {
                  const layout = event.nativeEvent.layout
                  setLayouts((current) => ({ ...current, [group.key]: layout }))
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                style={{
                  height: 40,
                  paddingHorizontal: 16,
                  borderRadius: 20,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  borderWidth: 1,
                  borderColor: selected ? "transparent" : palette.line,
                }}
              >
                <Text variant="callout" weight="heavy" color={selected ? palette.white : palette.ink700} style={{ fontSize: 14 }}>
                  {group.title}
                </Text>
                <Text variant="eyebrow" numeric color={selected ? palette.mint300 : palette.ink500} style={{ letterSpacing: 0 }}>
                  {String(group.products.length)}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </ScrollView>
    </View>
  )
}
