"use client"

import { useState, useEffect } from "react"
import { Mic, X, Trash2, Zap, ArrowRight, Sparkles, Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

interface AIModalsProps {
  isOpen: boolean
  onClose: () => void
  mode: "voice" | "smart" | null
}

export function AIModals({ isOpen, onClose, mode }: AIModalsProps) {
  const router = useRouter()
  const [isListening, setIsListening] = useState(false)
  const [budget, setBudget] = useState("150")
  const [duration, setDuration] = useState("1 semaine")

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      setIsListening(false)
    }
  }, [isOpen])

  if (!isOpen || !mode) return null

  const handleVoiceInteraction = () => {
    setIsListening(true)
    // Simulate generation after 3 seconds
    setTimeout(() => {
      setIsListening(false)
      onClose()
      router.push("/checkout?mode=voice")
    }, 3000)
  }

  const handleSmartGeneration = () => {
    setIsListening(true)
    setTimeout(() => {
      setIsListening(false)
      onClose()
      router.push("/checkout?mode=smart")
    }, 2000)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className={cn(
        "relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-200",
        mode === "voice" ? "bg-[#111116]" : "bg-white"
      )}>
        
        {/* === VOICE MODAL === */}
        {mode === "voice" && (
          <div className="flex flex-col h-full text-white">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full border border-[#1E8A3C]/30 flex items-center justify-center bg-gradient-to-br from-[#1E8A3C]/10 to-transparent">
                  <div className="w-8 h-8 rounded-full border border-[#1E8A3C]/20" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-lg leading-none tracking-tight">IA-SOUKI</span>
                  <div className="flex items-center gap-1 mt-1">
                    <Sparkles className="w-3 h-3 text-[#f5c400]" />
                    <span className="text-xs text-white/60">Prêt</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 px-2 py-1 rounded bg-[#2a2a35] text-xs font-medium text-[#4CB84A]">
                  <Check className="w-3 h-3" /> Auto
                </div>
                <button className="p-2 text-white/40 hover:text-white/80 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={onClose} className="p-2 text-white/40 hover:text-white/80 transition-colors rounded-full bg-white/5">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Visualizer Area */}
            <div className="py-12 border-b border-white/5 relative flex flex-col items-center justify-center">
              {/* Glow center */}
              <div className={cn(
                "relative w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-6 transition-all duration-700",
                isListening ? "bg-gradient-to-tr from-[#1E8A3C] to-[#4CB84A] shadow-[0_0_30px_#1E8A3C]" : "bg-white/10"
              )}>
                <div className="w-4 h-4 rounded-full bg-white opacity-80" />
              </div>
              
              {/* Bars placeholder */}
              <div className="flex items-center gap-1 justify-center h-8">
                {[...Array(15)].map((_, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "w-1.5 rounded-full bg-white/20 transition-all duration-300",
                      isListening ? "animate-pulse" : "h-2"
                    )}
                    style={{ 
                      height: isListening ? `${Math.max(8, Math.random() * 32)}px` : '8px',
                      animationDelay: `${i * 0.1}s`
                    }}
                  />
                ))}
              </div>
            </div>
            
            {/* Action Area */}
            <div className="p-6 flex flex-col items-center text-center">
              <div className="mb-6">
                <div className="w-10 h-10 mx-auto bg-white/5 rounded-full flex items-center justify-center mb-4">
                  <Mic className="w-5 h-5 text-white/60" />
                </div>
                <p className="text-sm font-medium text-white/80 mb-2">
                  {isListening ? "Je vous écoute..." : "Appuyez sur le micro et parlez à IA-SOUKI"}
                </p>
                <p className="text-[10px] text-white/40">
                  Détection automatique du silence • Réponse vocale directe
                </p>
              </div>
              
              <button 
                onClick={handleVoiceInteraction}
                className={cn(
                  "flex flex-col items-center justify-center w-full max-w-[200px] h-32 rounded-3xl transition-all duration-300 group",
                  isListening ? "bg-white/5" : "bg-white/5 hover:bg-white/10"
                )}
              >
                <div className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center mb-3 transition-colors duration-300",
                  isListening ? "bg-gradient-to-tr from-[#1E8A3C] to-[#4CB84A] shadow-[0_0_40px_rgba(30,138,60,0.5)]" : "bg-gradient-to-tr from-[#1E8A3C]/50 to-[#4CB84A]/50"
                )}>
                  <Mic className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-medium text-white/60 group-hover:text-white/90">
                  {isListening ? "Écoute en cours..." : "Appuyez pour parler"}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* === SMART CART MODAL === */}
        {mode === "smart" && (
          <div className="flex flex-col h-full bg-white">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F07C00] to-[#FF9421] flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[#3D3D3D] leading-tight">Panier Intelligent</h3>
                  <p className="text-xs text-[#8A8A8A]">Généré par IA-SOUKI</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-[#3D3D3D] mb-2">Quel est votre budget ?</label>
                <div className="relative">
                  <input 
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-[#3D3D3D] font-medium focus:border-[#F07C00] focus:ring-1 focus:ring-[#F07C00] outline-none transition-all"
                    placeholder="Ex: 150"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8A8A8A] font-medium">DH</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#3D3D3D] mb-2">Pour quelle durée ?</label>
                <div className="relative">
                  <select 
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full appearance-none pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-[#3D3D3D] font-medium focus:border-[#F07C00] focus:ring-1 focus:ring-[#F07C00] outline-none transition-all"
                  >
                    <option value="3 jours">3 Jours</option>
                    <option value="1 semaine">1 Semaine</option>
                    <option value="2 semaines">2 Semaines</option>
                    <option value="1 mois">1 Mois</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A8A8A] pointer-events-none" />
                </div>
              </div>
              
              <div className="bg-[#FFF5EB] p-4 rounded-xl text-sm text-[#D66B00]">
                <b>IA-SOUKI</b> sélectionnera les meilleurs légumes frais du jour et au meilleur prix pour composer un panier optimal.
              </div>
            </div>

            <div className="p-6 pt-0 mt-auto">
              <button 
                onClick={handleSmartGeneration}
                disabled={isListening}
                className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-[#F07C00] to-[#FF9421] text-white rounded-xl font-bold shadow-lg shadow-orange-500/25 hover:opacity-90 transition-opacity disabled:opacity-70"
              >
                {isListening ? (
                  <>
                    <Zap className="w-5 h-5 animate-pulse" />
                    Création du panier...
                  </>
                ) : (
                  <>
                    Générer mon panier
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
