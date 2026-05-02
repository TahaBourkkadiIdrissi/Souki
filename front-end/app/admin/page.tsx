"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useAuth } from "@/hooks/useAuth"
import { 
  Leaf,
  LayoutDashboard,
  Package,
  Users,
  Bike,
  Truck,
  ShoppingBasket,
  BarChart3,
  Wallet,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Zap,
  AlertTriangle,
  CheckCircle,
  Phone,
  ChevronDown,
  TrendingUp,
  Clock
} from "lucide-react"
import { cn } from "@/lib/utils"
import { KPICard } from "@/components/souki/kpi-card"
import { StatusBadge } from "@/components/souki/status-badge"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts"

const adminNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/admin", active: true },
  { icon: Package, label: "Commandes du jour", href: "/admin/orders" },
  { icon: Users, label: "Clients & Blacklist", href: "/admin/clients" },
  { icon: Truck, label: "Logistique & Livreurs", href: "/admin/livreur" },
  { icon: ShoppingBasket, label: "Gestion Produits & Prix", href: "/admin/produits" },
  { icon: BarChart3, label: "Analytics", href: "/admin/analytics" },
  { icon: Users, label: "Abonnements Parentaux", href: "/admin/subscriptions" },
  { icon: Wallet, label: "Transactions Wallet", href: "/admin/wallet" },
  { icon: Settings, label: "Paramètres Système", href: "/admin/settings" },
]

const adminNavPermissions: Record<string, string> = {
  "/admin": "admin.panel.access",
  "/admin/orders": "orders.read",
  "/admin/clients": "clients.read",
  "/admin/livreur": "admin.panel.access",
  "/admin/produits": "products.manage",
  "/admin/analytics": "stats.read",
  "/admin/subscriptions": "parent.dashboard.access",
  "/admin/wallet": "wallets.read",
  "/admin/settings": "users.manage_roles",
}

const ordersToday = [
  { id: "CMD-2847", client: "Youssef M.", products: "Tomates, Oignons", total: 201, payment: "COD", livreur: "Mohammed B.", status: "enroute" as const },
  { id: "CMD-2848", client: "Fatima B.", products: "Carottes, Herbes", total: 89, payment: "Wallet", livreur: "Ahmed K.", status: "delivered" as const },
  { id: "CMD-2849", client: "Rachid K.", products: "Pommes de Terre", total: 156, payment: "COD", livreur: "-", status: "pending" as const },
  { id: "CMD-2850", client: "Khadija L.", products: "Aubergines, Piments", total: 134, payment: "CMI", livreur: "Mohammed B.", status: "preparing" as const },
  { id: "CMD-2851", client: "Omar S.", products: "Courgettes, Concombre", total: 178, payment: "COD", livreur: "-", status: "pending" as const },
]

const stockPricing = [
  { product: "Tomates", prixGros: 7, coutReel: 7.5, prixVente: 7, marge: -6.7, strategy: "appel" },
  { product: "Pommes de Terre", prixGros: 6, coutReel: 6.4, prixVente: 6, marge: -6.3, strategy: "appel" },
  { product: "Oignons", prixGros: 9, coutReel: 9.6, prixVente: 9, marge: -6.3, strategy: "lissage" },
  { product: "Carottes", prixGros: 8.5, coutReel: 9.1, prixVente: 10, marge: 9.9, strategy: "lissage" },
  { product: "Courgettes", prixGros: 13, coutReel: 13.9, prixVente: 13, marge: -6.5, strategy: "perte" },
]

const weeklyTrend = [
  { day: "Lun", revenue: 450, orders: 6 },
  { day: "Mar", revenue: 520, orders: 7 },
  { day: "Mer", revenue: 380, orders: 5 },
  { day: "Jeu", revenue: 610, orders: 8 },
  { day: "Ven", revenue: 590, orders: 8 },
  { day: "Sam", revenue: 720, orders: 10 },
  { day: "Dim", revenue: 593, orders: 8 },
]

const alerts = [
  { type: "danger", code: "7.14", message: "Prix tomates +45% au gros — Substitution activée : Courgettes" },
  { type: "warning", code: "7.6", message: "Client Rachid M. — 2 refus COD consécutifs — Confirmation requise" },
  { type: "success", code: "7.13", message: "Serveur nominal — Bot WhatsApp backup en veille" },
]

export default function AdminDashboard() {
  const { can } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState("tous")
  const [timeUntilCutoff, setTimeUntilCutoff] = useState({ hours: 0, minutes: 0 })
  const [currentDate, setCurrentDate] = useState("")

  useEffect(() => {
    // Set current date on client only
    setCurrentDate(new Date().toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }))

    // Calculate time until 20h00
    const calculateTime = () => {
      const now = new Date()
      const cutoff = new Date()
      cutoff.setHours(20, 0, 0, 0)
      const diff = cutoff.getTime() - now.getTime()
      const hours = Math.max(0, Math.floor(diff / (1000 * 60 * 60)))
      const minutes = Math.max(0, Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)))
      setTimeUntilCutoff({ hours, minutes })
    }

    calculateTime()
    const interval = setInterval(calculateTime, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [])

  const hoursUntil = timeUntilCutoff.hours
  const minutesUntil = timeUntilCutoff.minutes
  const codOrdersCount = ordersToday.filter(o => o.payment === "COD" && o.status === "pending").length
  const visibleAdminNavItems = adminNavItems.filter((item) =>
    can(adminNavPermissions[item.href] || "admin.panel.access")
  )

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-4 lg:px-6 h-16">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2"
            >
              <Menu className="w-6 h-6 text-[#3D3D3D]" />
            </button>
            <Link href="/admin" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl shadow-sm overflow-hidden flex items-center justify-center bg-white p-0.5 pointer-events-none">
                <img src="/logo3.png" alt="SOUKI" className="w-[175%] h-full max-w-none object-cover" style={{ objectPosition: "left center" }} />
              </div>
              <div className="hidden sm:block">
                <span className="text-xl font-bold text-[#1E8A3C]">SOUKI</span>
                <span className="text-sm text-[#8A8A8A] ml-1">Admin</span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 bg-[#F07C00]/10 rounded-xl">
            <Zap className="w-5 h-5 text-[#F07C00]" />
            <span className="text-[#F07C00] font-medium text-sm hidden sm:inline">
              Agrégation commandes dans {hoursUntil}h{minutesUntil.toString().padStart(2, '0')} (20h00)
            </span>
            <span className="text-[#F07C00] font-medium text-sm sm:hidden">
              {hoursUntil}h{minutesUntil.toString().padStart(2, '0')}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative p-2 text-[#3D3D3D] hover:bg-gray-100 rounded-xl">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <div className="w-10 h-10 bg-[#1E8A3C] rounded-full flex items-center justify-center text-white font-bold">
              A
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={cn(
          "fixed lg:sticky top-0 lg:top-16 left-0 z-40 w-64 h-screen lg:h-[calc(100vh-64px)] bg-[#1E8A3C] flex flex-col transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden absolute top-4 right-4 p-2 text-white"
          >
            <X className="w-5 h-5" />
          </button>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto mt-12 lg:mt-0">
            {visibleAdminNavItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors",
                  item.active
                    ? "bg-white/20 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-sm">{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-white/20">
            <button className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-colors">
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Déconnexion</span>
            </button>
          </div>
        </aside>

        {/* Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl lg:text-3xl font-bold text-[#1E8A3C]">
                Dashboard Opérationnel — {currentDate}
              </h1>
            </div>

            {/* Alert Banner */}
            {codOrdersCount > 0 && (
              <div className="mb-6 p-4 bg-[#F07C00] text-white rounded-2xl flex items-center gap-3">
                <Clock className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">
                  {codOrdersCount} commande{codOrdersCount > 1 ? 's' : ''} COD à confirmer par appel avant 19h00
                </span>
                <button className="ml-auto px-4 py-1.5 bg-white text-[#F07C00] rounded-lg font-semibold hover:bg-white/90 transition-colors flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Appeler
                </button>
              </div>
            )}

            {/* KPI Cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              <KPICard
                title="Commandes aujourd'hui"
                value="23"
                icon={Package}
                trend={{ value: 5, label: " vs hier" }}
              />
              <KPICard
                title="Revenu net estimé"
                value="592,94 DH"
                icon={TrendingUp}
                variant="success"
              />
              <KPICard
                title="Livreurs actifs"
                value="3/4"
                icon={Bike}
              />
              <KPICard
                title="Total Wallet"
                value="3.250 DH"
                icon={Wallet}
              />
              <KPICard
                title="Clients blacklistés"
                value="2"
                icon={AlertTriangle}
                variant="warning"
              />
            </div>

            {/* Chart & Alerts Row */}
            <div className="grid lg:grid-cols-3 gap-6 mb-8">
              {/* Weekly Trend Chart */}
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-6">
                <h2 className="text-lg font-bold text-[#3D3D3D] mb-4">Tendance hebdomadaire</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={weeklyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#8A8A8A' }} />
                    <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fill: '#8A8A8A' }} />
                    <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fill: '#8A8A8A' }} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#1E8A3C" strokeWidth={2} name="Revenue (DH)" dot={{ fill: '#1E8A3C' }} />
                    <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#F07C00" strokeWidth={2} name="Commandes" dot={{ fill: '#F07C00' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Alerts */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="text-lg font-bold text-[#3D3D3D] mb-4">Alertes & Risques</h2>
                <div className="space-y-3">
                  {alerts.map((alert, index) => (
                    <div
                      key={index}
                      className={cn(
                        "p-4 rounded-xl border-l-4",
                        alert.type === "danger" && "bg-red-50 border-red-500",
                        alert.type === "warning" && "bg-[#F07C00]/10 border-[#F07C00]",
                        alert.type === "success" && "bg-[#4CB84A]/10 border-[#4CB84A]"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {alert.type === "danger" && <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />}
                        {alert.type === "warning" && <AlertTriangle className="w-4 h-4 text-[#F07C00] flex-shrink-0 mt-0.5" />}
                        {alert.type === "success" && <CheckCircle className="w-4 h-4 text-[#4CB84A] flex-shrink-0 mt-0.5" />}
                        <div>
                          <p className="text-xs font-semibold text-[#8A8A8A] mb-1">Risk {alert.code}</p>
                          <p className="text-sm text-[#3D3D3D]">{alert.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Orders Table */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-8">
              <div className="p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-lg font-bold text-[#3D3D3D]">Commandes du jour</h2>
                <div className="flex gap-2">
                  {["tous", "COD", "Wallet", "CMI"].map(filter => (
                    <button
                      key={filter}
                      onClick={() => setSelectedFilter(filter)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                        selectedFilter === filter
                          ? "bg-[#1E8A3C] text-white"
                          : "bg-gray-100 text-[#3D3D3D] hover:bg-gray-200"
                      )}
                    >
                      {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[#8A8A8A] uppercase">#ID</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[#8A8A8A] uppercase">Client</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[#8A8A8A] uppercase">Produits</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[#8A8A8A] uppercase">Total</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[#8A8A8A] uppercase">Paiement</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[#8A8A8A] uppercase">Livreur</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[#8A8A8A] uppercase">Statut</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[#8A8A8A] uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ordersToday
                      .filter(order => selectedFilter === "tous" || order.payment === selectedFilter)
                      .map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-[#1E8A3C]">{order.id}</td>
                        <td className="px-6 py-4 text-[#3D3D3D]">{order.client}</td>
                        <td className="px-6 py-4 text-[#8A8A8A] text-sm">{order.products}</td>
                        <td className="px-6 py-4 font-semibold text-[#F07C00]">{order.total} DH</td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-xs font-medium",
                            order.payment === "COD" && "bg-yellow-100 text-yellow-700",
                            order.payment === "Wallet" && "bg-green-100 text-green-700",
                            order.payment === "CMI" && "bg-blue-100 text-blue-700"
                          )}>
                            {order.payment}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[#3D3D3D]">{order.livreur}</td>
                        <td className="px-6 py-4">
                          <StatusBadge status={order.status} size="sm" />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            {order.livreur === "-" && (
                              <button className="px-3 py-1 bg-[#1E8A3C] text-white rounded-lg text-xs font-medium hover:bg-[#176B2E]">
                                Assigner
                              </button>
                            )}
                            <button className="px-3 py-1 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50">
                              Détails
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Stock & Pricing */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#3D3D3D]">Stock & Prix du Marché</h2>
                <button className="px-4 py-2 bg-[#F07C00] text-white rounded-lg font-medium flex items-center gap-2 hover:bg-[#D66B00]">
                  <Zap className="w-4 h-4" />
                  Relancer Algo Substitution
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[#8A8A8A] uppercase">Produit</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[#8A8A8A] uppercase">Prix Gros</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[#8A8A8A] uppercase">Coût Réel</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[#8A8A8A] uppercase">Prix Vente</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[#8A8A8A] uppercase">Marge %</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-[#8A8A8A] uppercase">Stratégie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {stockPricing.map((item) => (
                      <tr key={item.product} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-[#3D3D3D]">{item.product}</td>
                        <td className="px-6 py-4 text-[#3D3D3D]">{item.prixGros} DH</td>
                        <td className="px-6 py-4 text-[#3D3D3D]">{item.coutReel} DH</td>
                        <td className="px-6 py-4 font-semibold text-[#F07C00]">{item.prixVente} DH</td>
                        <td className={cn(
                          "px-6 py-4 font-semibold",
                          item.marge >= 0 ? "text-[#4CB84A]" : "text-red-500"
                        )}>
                          {item.marge >= 0 ? "+" : ""}{item.marge.toFixed(1)}%
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium",
                            item.strategy === "appel" && "bg-green-100 text-green-700",
                            item.strategy === "lissage" && "bg-yellow-100 text-yellow-700",
                            item.strategy === "perte" && "bg-red-100 text-red-700"
                          )}>
                            {item.strategy === "appel" && "Produit d'appel"}
                            {item.strategy === "lissage" && "Lissage marge"}
                            {item.strategy === "perte" && "Perte stratégique"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
