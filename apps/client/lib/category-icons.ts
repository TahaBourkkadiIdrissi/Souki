import { Apple, Banana, Carrot, Cherry, Citrus, Flower2, Grape, Leaf, Salad, ShoppingBasket, Snowflake, Sprout, Sun, Tag, Wheat, type LucideIcon } from "lucide-react"

// Meme liste que CategoryIcon (back-end/dto/category_dto.py) et que
// apps/admin/lib/category-icons.ts : une cle ajoutee ici doit l'etre aussi la-bas.
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

export const categoryIcon = (key: string | null | undefined): LucideIcon | null =>
  (key && CATEGORY_ICONS[key]) || null
