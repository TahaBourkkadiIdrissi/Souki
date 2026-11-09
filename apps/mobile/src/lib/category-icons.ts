import {
  Apple,
  Banana,
  Carrot,
  Cherry,
  Citrus,
  Flower2,
  Grape,
  Leaf,
  Salad,
  ShoppingBasket,
  Snowflake,
  Sprout,
  Sun,
  Tag,
  Wheat,
  type LucideIcon,
} from "lucide-react-native"

/**
 * Icones des rayons, memes cles et memes icones Lucide que la PWA
 * (apps/client/lib/category-icons.ts et back-end/dto/category_dto.py).
 */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  panier: ShoppingBasket,
  pomme: Apple,
  carotte: Carrot,
  feuille: Leaf,
  agrume: Citrus,
  raisin: Grape,
  cerise: Cherry,
  banane: Banana,
  salade: Salad,
  pousse: Sprout,
  ble: Wheat,
  soleil: Sun,
  flocon: Snowflake,
  fleur: Flower2,
  etiquette: Tag,
}

/** Rayons historiques, comme les tuiles de l'accueil PWA. */
const LEGACY_ICONS: Record<string, LucideIcon> = { legumes: Carrot, fruits: Apple, herbes: Leaf }

export function categoryIcon(key: string | null | undefined, slug?: string): LucideIcon {
  return (key && CATEGORY_ICONS[key]) || (slug && LEGACY_ICONS[slug]) || Tag
}
