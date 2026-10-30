import {
  AlertTriangle, CircleDollarSign, Gift, LayoutDashboard, MapPinned, Package, QrCode, Repeat, ShieldBan, Tags, Truck, Users,
  type LucideIcon,
} from "lucide-react"

export type AdminNavItem = { label: string; href: string; icon: LucideIcon; permission: string; description: string }
export type AdminNavGroup = { label: string; items: AdminNavItem[] }

// Menu unique de l'admin : l'ordre suit la journee (piloter, livrer, servir les clients, vendre).
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "Pilotage",
    items: [
      { label: "Tableau de bord", href: "/admin", icon: LayoutDashboard, permission: "admin.panel.access", description: "Performances de la période" },
    ],
  },
  {
    label: "Journée",
    items: [
      { label: "Commandes du jour", href: "/admin/orders", icon: Package, permission: "orders.read", description: "Livraisons du jour et du lendemain, JIT et COD" },
      { label: "Logistique & livreurs", href: "/admin/livreur", icon: Truck, permission: "admin.panel.access", description: "Tournées, réassignations et retours dépôt" },
      { label: "Exceptions", href: "/admin/commandes/exceptions", icon: AlertTriangle, permission: "admin.panel.access", description: "Commandes à reprendre à la main" },
    ],
  },
  {
    label: "Clients",
    items: [
      { label: "Clients", href: "/admin/clients", icon: Users, permission: "clients.read", description: "Comptes, fiches et historique" },
      { label: "Blacklist", href: "/admin/blacklist", icon: ShieldBan, permission: "clients.blacklist", description: "Blocages COD et demandes de levée" },
      { label: "Abonnements", href: "/admin/abonnements", icon: Repeat, permission: "admin.panel.access", description: "Commandes récurrentes créées à 01h00" },
      { label: "Parrainage", href: "/admin/parrainage", icon: Gift, permission: "admin.panel.access", description: "Parrains, filleuls et crédits" },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { label: "Produits & prix", href: "/admin/pricing", icon: CircleDollarSign, permission: "admin.panel.access", description: "Prix de gros, marges et fiches produit" },
      { label: "Catégories", href: "/admin/categories", icon: Tags, permission: "admin.panel.access", description: "Rayons du catalogue client" },
    ],
  },
  {
    label: "Réglages",
    items: [
      { label: "Zones de livraison", href: "/admin/zones", icon: MapPinned, permission: "admin.panel.access", description: "Villes et rayons desservis" },
      { label: "Campagnes", href: "/admin/compaign", icon: QrCode, permission: "admin.panel.access", description: "Liens courts, QR codes et trafic" },
    ],
  },
]

export const ADMIN_NAV_ITEMS = ADMIN_NAV.flatMap((group) => group.items)

export function findAdminNavItem(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/"
  if (path === "/admin/produits") return ADMIN_NAV_ITEMS.find((item) => item.href === "/admin/pricing")
  return [...ADMIN_NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => path === item.href || (item.href !== "/admin" && path.startsWith(`${item.href}/`)))
}
