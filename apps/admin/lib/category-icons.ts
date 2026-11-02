import { Apple, Banana, Carrot, Cherry, Citrus, Flower2, Grape, Leaf, Salad, ShoppingBasket, Snowflake, Sprout, Sun, Tag, Wheat, type LucideIcon } from "lucide-react"

// Meme liste que CategoryIcon (back-end/dto/category_dto.py) et que
// apps/client/lib/category-icons.ts : une cle ajoutee ici doit l'etre aussi la-bas.
export const CATEGORY_ICONS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "panier", label: "Panier", icon: ShoppingBasket },
  { key: "pomme", label: "Pomme", icon: Apple },
  { key: "carotte", label: "Carotte", icon: Carrot },
  { key: "feuille", label: "Feuille", icon: Leaf },
  { key: "agrume", label: "Agrume", icon: Citrus },
  { key: "raisin", label: "Raisin", icon: Grape },
  { key: "cerise", label: "Cerise", icon: Cherry },
  { key: "banane", label: "Banane", icon: Banana },
  { key: "salade", label: "Salade", icon: Salad },
  { key: "pousse", label: "Pousse", icon: Sprout },
  { key: "ble", label: "Blé", icon: Wheat },
  { key: "soleil", label: "Été", icon: Sun },
  { key: "flocon", label: "Hiver", icon: Snowflake },
  { key: "fleur", label: "Printemps", icon: Flower2 },
  { key: "etiquette", label: "Étiquette", icon: Tag },
]

export const categoryIcon = (key: string | null | undefined): LucideIcon =>
  CATEGORY_ICONS.find(item => item.key === key)?.icon ?? Tag
