import { useMemo, useRef, useState, type ComponentRef } from "react"
import { ScrollView, View } from "react-native"
import { useRouter } from "expo-router"
import { useQuery } from "@tanstack/react-query"
import { Info, RefreshCw, Search, ShoppingBasket, Soup, Sparkles, TriangleAlert } from "lucide-react-native"
import {
  BALANCED_BASKET,
  DISH_CATEGORIES,
  DISH_NEUTRAL_BUDGET,
  dishMatches,
  formatDirhams,
  productName,
  SMART_DEFAULTS,
  SMART_DURATIONS,
  SMART_PEOPLE,
  type SmartBasketResponseDTO,
} from "@souki/shared"

import { AiHero, AssistantFrame, BudgetMeter, ChoiceChips, DishRow, FieldRow, Generating, SuggestedLine } from "@/components/ai-parts"
import { BrandButton } from "@/components/brand-button"
import { Note, TextField } from "@/components/form-fields"
import { Text } from "@/components/text"
import { useCart } from "@/contexts/cart-context"
import { useLocale } from "@/contexts/locale-context"
import { useCatalogue } from "@/hooks/use-catalogue"
import { ApiError, fetchDishComposition, fetchDishes, generateSmartBasket } from "@/lib/api"
import { haptics } from "@/lib/haptics"
import { palette } from "@/theme"

type Phase = "form" | "dishes" | "generating" | "result"

/**
 * Panier intelligent (EcranPanierIntelligent, criteres reels de ai-modals.tsx du site) : budget,
 * personnes (1 a 8), duree (3 a 14 jours), « Équilibré » ou un plat marocain ; choix du plat
 * par recherche (aussi en darija) et categories ; generation par IA-SOUKI ; panier suggere
 * modifiable au prix du jour, « Ajouter au panier » et « Régénérer ». Pour un plat, budget et
 * duree ne s'appliquent pas, et les ingredients que SOUKI ne vend pas sont listes.
 */
export default function PanierIntelligentScreen() {
  const router = useRouter()
  const { t, locale } = useLocale()
  const { add } = useCart()
  const { productsById } = useCatalogue()
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null)
  const dishes = useQuery({ queryKey: ["dishes"], queryFn: ({ signal }) => fetchDishes(signal), staleTime: 30 * 60 * 1000 })

  const [phase, setPhase] = useState<Phase>("form")
  const [budget, setBudget] = useState(String(SMART_DEFAULTS.budget))
  const [people, setPeople] = useState<number>(SMART_DEFAULTS.people)
  const [duration, setDuration] = useState<number>(SMART_DEFAULTS.duration)
  const [plat, setPlat] = useState<string>(BALANCED_BASKET)
  const [dishMode, setDishMode] = useState(false)
  const [category, setCategory] = useState<string>(DISH_CATEGORIES[0].id)
  const [search, setSearch] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SmartBasketResponseDTO | null>(null)
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [missing, setMissing] = useState<string[]>([])

  const isDish = plat !== BALANCED_BASKET
  const dish = isDish ? dishes.data?.find((entry) => entry.dish_id === plat) ?? null : null
  const parsedBudget = Number(budget.replace(",", "."))

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const entry of dishes.data ?? []) map.set(entry.category, (map.get(entry.category) ?? 0) + 1)
    return map
  }, [dishes.data])
  const visibleDishes = (dishes.data ?? []).filter((entry) => (search.trim() ? dishMatches(entry, search) : entry.category === category))

  const generate = async () => {
    if (!isDish && (!Number.isFinite(parsedBudget) || parsedBudget <= 0)) {
      haptics.error()
      return setError(t("Entrez un budget valide pour generer le panier."))
    }
    // Meme plafond que PanierRequestDTO (budget <= 5000) : sinon Pydantic repond en anglais.
    if (!isDish && parsedBudget > DISH_NEUTRAL_BUDGET) {
      haptics.error()
      return setError(t("Le budget ne peut pas dépasser {max} DH.", { max: DISH_NEUTRAL_BUDGET }))
    }
    setError(null)
    setPhase("generating")
    scrollRef.current?.scrollTo({ y: 0, animated: false })
    try {
      const [data, composition] = await Promise.all([
        generateSmartBasket({ budget: isDish ? DISH_NEUTRAL_BUDGET : parsedBudget, personnes: people, duree: duration, plat }),
        isDish ? fetchDishComposition(plat, people).catch(() => null) : Promise.resolve(null),
      ])
      setResult(data)
      setQuantities(Object.fromEntries(data.lignes_panier.map((line) => [line.product_id, line.quantite_kg])))
      setMissing(composition?.ingredients_manquants ?? [])
      haptics.success()
      setPhase("result")
    } catch (caught) {
      haptics.error()
      setError(caught instanceof ApiError ? t(caught.message) : t("Impossible de generer le panier intelligent."))
      setPhase(dishMode ? "dishes" : "form")
    }
  }

  const lines = (result?.lignes_panier ?? []).filter((line) => (quantities[line.product_id] ?? 0) > 0)
  const total = lines.reduce((sum, line) => sum + line.prix_unitaire * (quantities[line.product_id] ?? 0), 0)

  const addToCart = () => {
    let added = 0
    for (const line of lines) {
      const live = productsById.get(line.product_id)
      if (!live || live.availability === "out_of_stock") continue
      add(live, quantities[line.product_id])
      added += 1
    }
    if (added === 0) return setError(t("Ces produits ne sont plus disponibles aujourd'hui."))
    haptics.success()
    router.back()
    router.navigate("/panier")
  }

  if (phase === "generating") {
    return (
      <AssistantFrame title={t("Panier intelligent")} onClose={() => router.back()} scrollRef={scrollRef}>
        <Generating title={t("Génération de votre panier en cours…")} detail={t("IA-SOUKI compose votre panier selon vos critères et votre choix. Encore quelques instants…")} />
      </AssistantFrame>
    )
  }

  if (phase === "result" && result) {
    return (
      <AssistantFrame
        title={t("Panier suggéré")}
        onBack={() => setPhase(dishMode ? "dishes" : "form")}
        onClose={() => router.back()}
        scrollRef={scrollRef}
        dock={
          <>
            <BrandButton icon={ShoppingBasket} label={t("Ajouter au panier")} trailing={`${formatDirhams(total)} DH`} disabled={lines.length === 0} onPress={addToCart} />
            <BrandButton tone="soft" icon={RefreshCw} label={t("Régénérer")} onPress={() => void generate()} />
          </>
        }
      >
        {dish ? (
          <AiHero icon={Soup} title={locale === "ar" ? dish.name_darija || dish.name_fr : dish.name_fr} detail={`${dish.name_darija} · ${t("pour {n} personnes", { n: people })}`} />
        ) : (
          <BudgetMeter used={total} budget={parsedBudget} caption={t("{p} personnes · {d} jours", { p: people, d: duration })} />
        )}
        {missing.length > 0 ? (
          <Note tone="orange" icon={Info}>
            {t("Pas vendus par SOUKI : {liste}. Prévoyez-les ailleurs.", { liste: missing.join(", ") })}
          </Note>
        ) : null}
        {result.model_warning ? <Note tone="orange" icon={TriangleAlert}>{t(result.model_warning)}</Note> : null}
        {error ? <Note tone="red">{error}</Note> : null}
        <View style={{ gap: 8 }}>
          {(result.lignes_panier ?? []).map((line, index) => {
            const live = productsById.get(line.product_id) ?? null
            const quantity = quantities[line.product_id] ?? 0
            if (quantity <= 0) return null
            return (
              <SuggestedLine
                key={line.product_id}
                index={index}
                product={live}
                name={live ? productName(live, locale) : locale === "ar" && line.nom_ar ? line.nom_ar : line.nom_produit}
                unit={live?.unit ?? line.unite}
                unitPrice={line.prix_unitaire}
                image={line.image}
                quantity={quantity}
                onChange={(next) => setQuantities((current) => ({ ...current, [line.product_id]: next }))}
              />
            )
          })}
        </View>
        {lines.length === 0 ? <Note tone="orange">{t("Ajoutez au moins un produit.")}</Note> : null}
        <Text variant="footnote" color={palette.ink500} align="center" style={{ fontSize: 12 }}>
          {t("Prix du jour. Modifiez les quantités avant d'ajouter au panier.")}
        </Text>
      </AssistantFrame>
    )
  }

  if (phase === "dishes") {
    return (
      <AssistantFrame
        title={t("Choisir un plat")}
        onBack={() => setPhase("form")}
        onClose={() => router.back()}
        scrollRef={scrollRef}
        dock={<BrandButton icon={Sparkles} label={t("Composer pour {n} personnes", { n: people })} disabled={!isDish} onPress={() => void generate()} />}
      >
        <TextField icon={Search} value={search} onChangeText={setSearch} placeholder={t("Rechercher un plat, aussi en darija")} autoCorrect={false} returnKeyType="search" />
        {search.trim() ? null : (
          <ChoiceChips
            label={t("Catégories")}
            value={category}
            onChange={setCategory}
            options={DISH_CATEGORIES.filter((entry) => counts.has(entry.id)).map((entry) => ({ value: entry.id, label: `${t(entry.label)} · ${counts.get(entry.id)}` }))}
          />
        )}
        {error ? <Note tone="red">{error}</Note> : null}
        <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
          {visibleDishes.map((entry) => (
            <DishRow key={entry.dish_id} icon={Soup} name={entry.name_fr} darija={entry.name_darija} servings={people} selected={plat === entry.dish_id} onPress={() => setPlat(entry.dish_id)} />
          ))}
        </View>
        {dishes.isLoading ? <Text variant="footnote" color={palette.ink500} align="center">{t("Chargement…")}</Text> : null}
        {!dishes.isLoading && visibleDishes.length === 0 ? <Note>{t("Aucun plat ne correspond à votre recherche.")}</Note> : null}
        <Note icon={Info}>{t("L'IA compose le panier autour de ce plat, adapté au nombre de personnes.")}</Note>
      </AssistantFrame>
    )
  }

  return (
    <AssistantFrame
      title={t("Panier intelligent")}
      onClose={() => router.back()}
      scrollRef={scrollRef}
      dock={
        dishMode ? (
          <BrandButton icon={Soup} label={isDish ? t("Changer de plat") : t("Choisir le plat")} onPress={() => setPhase("dishes")} />
        ) : (
          <BrandButton icon={Sparkles} label={t("Générer")} onPress={() => void generate()} />
        )
      }
    >
      <AiHero icon={ShoppingBasket} spark title={t("IA-SOUKI compose votre panier")} detail={t("Selon votre budget, votre foyer et vos envies. Vous le modifiez avant de commander.")} />
      <FieldRow label={t("Quel est votre budget ?")}>
        <TextField
          prefix="DH"
          value={dishMode ? "" : budget}
          onChangeText={setBudget}
          keyboardType="number-pad"
          placeholder={t("Ex : 150")}
          disabled={dishMode}
          help={dishMode ? t("Non applicable pour un plat — quantités selon le nombre de personnes.") : undefined}
          error={error && !dishMode ? error : null}
        />
      </FieldRow>
      <FieldRow label={t("Personnes")}>
        <ChoiceChips label={t("Nombre de personnes")} value={people} onChange={setPeople} options={SMART_PEOPLE.map((value) => ({ value, label: String(value) }))} />
      </FieldRow>
      <FieldRow label={t("Durée")} extra={dishMode ? t("(non applicable pour un plat)") : undefined}>
        <ChoiceChips label={t("Durée du panier")} value={duration} onChange={setDuration} disabled={dishMode} options={SMART_DURATIONS.map((value) => ({ value, label: t("{n} j", { n: value }) }))} />
      </FieldRow>
      <FieldRow label={t("Que voulez-vous préparer ?")}>
        <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
          <DishRow
            icon={ShoppingBasket}
            name={t("Équilibré")}
            darija={t("Tous fruits & légumes variés")}
            selected={!dishMode}
            onPress={() => {
              setDishMode(false)
              setPlat(BALANCED_BASKET)
            }}
          />
          <DishRow
            icon={Soup}
            name={dish ? dish.name_fr : t("Un plat marocain")}
            darija={dish ? dish.name_darija : t("{n} plats : tajines, couscous, soupes…", { n: dishes.data?.length ?? 0 })}
            selected={dishMode}
            onPress={() => {
              setDishMode(true)
              setError(null)
              if (!isDish) setPhase("dishes")
            }}
          />
        </View>
      </FieldRow>
      <Note icon={Info}>
        {dishMode
          ? t("L'IA compose le panier autour de ce plat, adapté au nombre de personnes.")
          : t("Panier équilibré : l'IA choisit des fruits & légumes variés selon vos critères.")}
      </Note>
      {dishMode && isDish ? <BrandButton tone="soft" icon={Sparkles} label={t("Composer pour {n} personnes", { n: people })} onPress={() => void generate()} /> : null}
    </AssistantFrame>
  )
}
