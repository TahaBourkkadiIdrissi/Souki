"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { 
  Leaf,
  ArrowLeft,
  Plus,
  Search,
  Edit,
  BarChart3,
  Power,
  X,
  Save,
  AlertTriangle,
  CheckCircle,
  Zap
} from "lucide-react"
import { cn } from "@/lib/utils"

const products = [
  { id: "1", name: "Tomates Marocaines", image: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=100&h=100&fit=crop", prixGros: 7, coutReel: 7.5, prixVente: 7, marge: -6.7, stock: 50, strategy: "appel", available: true },
  { id: "2", name: "Pommes de Terre", image: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=100&h=100&fit=crop", prixGros: 6, coutReel: 6.4, prixVente: 6, marge: -6.3, stock: 80, strategy: "appel", available: true },
  { id: "3", name: "Oignons", image: "https://images.unsplash.com/photo-1620574387735-3624d75b2dbc?w=100&h=100&fit=crop", prixGros: 9, coutReel: 9.6, prixVente: 9, marge: -6.3, stock: 40, strategy: "lissage", available: true },
  { id: "4", name: "Carottes", image: "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=100&h=100&fit=crop", prixGros: 8.5, coutReel: 9.1, prixVente: 10, marge: 9.9, stock: 35, strategy: "lissage", available: true },
  { id: "5", name: "Courgettes", image: "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=100&h=100&fit=crop", prixGros: 13, coutReel: 13.9, prixVente: 13, marge: -6.5, stock: 25, strategy: "perte", available: true },
  { id: "6", name: "Piments", image: "https://images.unsplash.com/photo-1583119022894-919a68a3d0e3?w=100&h=100&fit=crop", prixGros: 12, coutReel: 12.8, prixVente: 12, marge: -6.3, stock: 15, strategy: "lissage", available: true },
  { id: "7", name: "Aubergines", image: "https://images.unsplash.com/photo-1628773822503-930a7eaecf80?w=100&h=100&fit=crop", prixGros: 8, coutReel: 8.5, prixVente: 8, marge: -5.9, stock: 30, strategy: "appel", available: true },
  { id: "8", name: "Concombres", image: "https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=100&h=100&fit=crop", prixGros: 11, coutReel: 11.7, prixVente: 11, marge: -6.0, stock: 20, strategy: "lissage", available: true },
  { id: "9", name: "Herbes Fraîches", image: "https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=100&h=100&fit=crop", prixGros: 3, coutReel: 3.2, prixVente: 3, marge: -6.3, stock: 60, strategy: "appel", available: false },
]

interface EditModalProps {
  product: typeof products[0]
  onClose: () => void
  onSave: (data: { prixGros: number; prixVente: number }) => void
}

function EditModal({ product, onClose, onSave }: EditModalProps) {
  const [prixGros, setPrixGros] = useState(product.prixGros)
  const [prixVente, setPrixVente] = useState(product.prixVente)
  
  const coutReel = prixGros * 1.07 // Adding 7% for handling
  const marge = ((prixVente - coutReel) / coutReel) * 100

  const strategy = marge <= -5 ? "perte" : marge <= 5 ? "lissage" : "appel"

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#3D3D3D]">Modifier Prix</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4 p-4 bg-[#F0FAF1] rounded-xl">
            <Image
              src={product.image}
              alt={product.name}
              width={60}
              height={60}
              className="rounded-lg object-cover"
            />
            <div>
              <h3 className="font-semibold text-[#3D3D3D]">{product.name}</h3>
              <p className="text-sm text-[#8A8A8A]">Stock: {product.stock} kg</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#3D3D3D] mb-2">
              Prix Gros (DH/kg)
            </label>
            <input
              type="number"
              value={prixGros}
              onChange={(e) => setPrixGros(parseFloat(e.target.value) || 0)}
              step="0.5"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#4CB84A] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#3D3D3D] mb-2">
              Coût Réel (calculé auto)
            </label>
            <div className="px-4 py-3 bg-gray-100 rounded-xl text-[#8A8A8A]">
              {coutReel.toFixed(2)} DH/kg
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#3D3D3D] mb-2">
              Prix Vente (DH/kg)
            </label>
            <input
              type="number"
              value={prixVente}
              onChange={(e) => setPrixVente(parseFloat(e.target.value) || 0)}
              step="0.5"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#4CB84A] focus:outline-none"
            />
          </div>

          <div className={cn(
            "p-4 rounded-xl flex items-center justify-between",
            marge >= 0 ? "bg-green-50" : "bg-red-50"
          )}>
            <div>
              <p className="text-sm text-[#8A8A8A]">Marge brute</p>
              <p className={cn(
                "text-2xl font-bold",
                marge >= 0 ? "text-[#4CB84A]" : "text-red-500"
              )}>
                {marge >= 0 ? "+" : ""}{marge.toFixed(1)}%
              </p>
            </div>
            <span className={cn(
              "px-3 py-1 rounded-full text-sm font-medium",
              strategy === "appel" && "bg-green-100 text-green-700",
              strategy === "lissage" && "bg-yellow-100 text-yellow-700",
              strategy === "perte" && "bg-red-100 text-red-700"
            )}>
              {strategy === "appel" && "Produit d'appel"}
              {strategy === "lissage" && "Lissage marge"}
              {strategy === "perte" && "Perte stratégique"}
            </span>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 rounded-xl font-medium hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={() => onSave({ prixGros, prixVente })}
            className="flex-1 py-3 bg-[#1E8A3C] text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-[#176B2E]"
          >
            <Save className="w-4 h-4" />
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminProductsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [editingProduct, setEditingProduct] = useState<typeof products[0] | null>(null)
  const [productList, setProductList] = useState(products)
  const [algoActive, setAlgoActive] = useState(true)

  const filteredProducts = productList.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const toggleAvailability = (id: string) => {
    setProductList(prev => prev.map(p => 
      p.id === id ? { ...p, available: !p.available } : p
    ))
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-4 lg:px-6 h-16">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="flex items-center gap-2 text-[#3D3D3D] hover:text-[#1E8A3C]">
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium hidden sm:inline">Retour</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl shadow-sm overflow-hidden flex items-center justify-center bg-white border border-gray-100 p-0.5">
                  <img src="/logo3.png" alt="SOUKI" className="w-[175%] h-full max-w-none object-cover" style={{ objectPosition: "left center" }} />
                </div>
              </Link>
              <div className="w-px h-6 bg-gray-200" />
              <span className="font-bold text-[#1E8A3C]">Gestion Produits & Prix</span>
            </div>
          </div>

          <button className="px-4 py-2 bg-[#1E8A3C] text-white rounded-xl font-medium flex items-center gap-2 hover:bg-[#176B2E]">
            <Plus className="w-4 h-4" />
            Nouveau Produit
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 lg:p-8">
        {/* Search & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A8A8A]" />
            <input
              type="text"
              placeholder="Rechercher un produit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-[#4CB84A] focus:outline-none"
            />
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#8A8A8A] uppercase">Image</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#8A8A8A] uppercase">Nom</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#8A8A8A] uppercase">Prix Gros</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#8A8A8A] uppercase">Coût Réel</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#8A8A8A] uppercase">Prix Vente</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#8A8A8A] uppercase">Marge %</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#8A8A8A] uppercase">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#8A8A8A] uppercase">Stratégie</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#8A8A8A] uppercase">Dispo</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#8A8A8A] uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Image
                        src={product.image}
                        alt={product.name}
                        width={48}
                        height={48}
                        className="rounded-lg object-cover"
                      />
                    </td>
                    <td className="px-6 py-4 font-medium text-[#3D3D3D]">{product.name}</td>
                    <td className="px-6 py-4 text-[#3D3D3D]">{product.prixGros} DH</td>
                    <td className="px-6 py-4 text-[#8A8A8A]">{product.coutReel} DH</td>
                    <td className="px-6 py-4 font-semibold text-[#F07C00]">{product.prixVente} DH</td>
                    <td className={cn(
                      "px-6 py-4 font-semibold",
                      product.marge >= 0 ? "text-[#4CB84A]" : "text-red-500"
                    )}>
                      {product.marge >= 0 ? "+" : ""}{product.marge.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 text-[#3D3D3D]">{product.stock} kg</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        product.strategy === "appel" && "bg-green-100 text-green-700",
                        product.strategy === "lissage" && "bg-yellow-100 text-yellow-700",
                        product.strategy === "perte" && "bg-red-100 text-red-700"
                      )}>
                        {product.strategy === "appel" && "Produit d'appel"}
                        {product.strategy === "lissage" && "Lissage"}
                        {product.strategy === "perte" && "Perte"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleAvailability(product.id)}
                        className={cn(
                          "relative w-12 h-6 rounded-full transition-colors",
                          product.available ? "bg-[#4CB84A]" : "bg-gray-300"
                        )}
                      >
                        <span className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                          product.available ? "right-1" : "left-1"
                        )} />
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setEditingProduct(product)}
                          className="p-2 text-[#1A4F8A] hover:bg-blue-50 rounded-lg"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-[#8A8A8A] hover:bg-gray-100 rounded-lg">
                          <BarChart3 className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-red-400 hover:bg-red-50 rounded-lg">
                          <Power className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Substitution Algorithm */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-[#3D3D3D]">Algorithme de Substitution — Risk 7.14</h2>
              <p className="text-sm text-[#8A8A8A]">Remplace automatiquement les produits trop chers par des alternatives</p>
            </div>
            <button
              onClick={() => setAlgoActive(!algoActive)}
              className={cn(
                "px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors",
                algoActive 
                  ? "bg-[#4CB84A] text-white" 
                  : "bg-gray-200 text-[#3D3D3D]"
              )}
            >
              {algoActive ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {algoActive ? "Actif" : "Inactif"}
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-4 bg-[#F0FAF1] rounded-xl">
              <p className="text-sm text-[#8A8A8A] mb-2">Seuil de déclenchement</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-[#1E8A3C]">Variance prix {'>'} 30%</span>
              </div>
            </div>

            <div className="p-4 bg-[#F07C00]/5 rounded-xl">
              <p className="text-sm text-[#8A8A8A] mb-2">Dernière substitution</p>
              <div>
                <p className="font-semibold text-[#3D3D3D]">Tomates → Courgettes</p>
                <p className="text-sm text-[#8A8A8A]">18 mars 2026 — Économie : 45 DH</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Edit Modal */}
      {editingProduct && (
        <EditModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSave={(data) => {
            setProductList(prev => prev.map(p => 
              p.id === editingProduct.id 
                ? { 
                    ...p, 
                    prixGros: data.prixGros, 
                    prixVente: data.prixVente,
                    coutReel: data.prixGros * 1.07,
                    marge: ((data.prixVente - data.prixGros * 1.07) / (data.prixGros * 1.07)) * 100
                  } 
                : p
            ))
            setEditingProduct(null)
          }}
        />
      )}
    </div>
  )
}
