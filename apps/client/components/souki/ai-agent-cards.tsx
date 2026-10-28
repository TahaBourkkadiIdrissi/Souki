import { Mic, ShoppingBasket } from "lucide-react"
import { cn } from "@/lib/utils"

// Les deux agents IA (panier malin + commande vocale), partages entre l'accueil
// PWA et le catalogue mobile. Les handlers restent ceux de chaque page.
export function AiAgentCards({
  onSmart,
  onVoice,
  compact = false,
  className,
}: {
  onSmart: () => void
  onVoice: () => void
  compact?: boolean
  className?: string
}) {
  const card = cn(
    "group relative isolate flex flex-col justify-between overflow-hidden text-left text-white ring-1 ring-white/10 transition-transform duration-200 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C400] focus-visible:ring-offset-2",
    compact ? "min-h-[128px] rounded-[22px] p-3.5" : "min-h-[156px] rounded-[26px] p-4"
  )
  const medallion = cn(
    "flex items-center justify-center rounded-2xl ring-1 ring-white/25",
    compact ? "h-10 w-10" : "h-11 w-11"
  )

  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      <button
        type="button"
        onClick={onSmart}
        aria-label="Panier malin : l'IA compose votre marché selon votre budget"
        className={cn(card, "bg-gradient-to-br from-[#1E8A3C] via-[#176B2E] to-[#113B1E] shadow-[0_18px_36px_-18px_rgba(17,59,30,0.8)]")}
      >
        <ShoppingBasket
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-5 -right-4 -z-10 h-24 w-24 -rotate-12 text-white/[0.08] transition-transform duration-300 group-active:rotate-0"
        />
        <span className="flex items-start justify-between">
          <span className={cn(medallion, "bg-white/15")}>
            <ShoppingBasket className="h-6 w-6" />
          </span>
          <span className="rounded-full bg-[#F5C400] px-2 py-0.5 text-[10px] font-black text-[#113B1E]">IA</span>
        </span>
        <span className="mt-3 block">
          <span className={cn("block font-black leading-tight", compact ? "text-[14px]" : "text-[16px]")}>Panier malin</span>
          <span className="mt-1 block text-[12px] font-medium leading-snug text-white/80">
            Votre budget, l&apos;IA compose le marché
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={onVoice}
        aria-label="Commande vocale : dites ce qu'il vous faut, Souki remplit le panier"
        className={cn(card, "bg-gradient-to-br from-[#113B1E] to-[#0B2A15] shadow-[0_18px_36px_-18px_rgba(240,124,0,0.6)]")}
      >
        {/* Halo orange : la touche « micro » de la carte */}
        <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 -z-10 h-28 w-28 rounded-full bg-[#F07C00]/35 blur-2xl" />
        <span className="flex items-start justify-between">
          <span className={cn(medallion, "bg-[#F07C00] shadow-[0_8px_18px_-8px_rgba(240,124,0,0.9)]")}>
            <Mic className="h-6 w-6" />
          </span>
          <span aria-hidden="true" className="souki-agent-eq flex h-5 items-end gap-[3px] pt-1">
            <span className="h-full w-[3px] rounded-full bg-[#F5C400]" />
            <span className="h-full w-[3px] rounded-full bg-[#F07C00]" />
            <span className="h-full w-[3px] rounded-full bg-[#F5C400]" />
            <span className="h-full w-[3px] rounded-full bg-[#F07C00]" />
          </span>
        </span>
        <span className="mt-3 block">
          <span className={cn("block font-black leading-tight", compact ? "text-[14px]" : "text-[16px]")}>Commande vocale</span>
          <span className="mt-1 block text-[12px] font-medium leading-snug text-white/80">
            Dites votre liste, Souki remplit le panier
          </span>
        </span>
      </button>
    </div>
  )
}
