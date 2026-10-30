import { ChevronRight, Mic, ShoppingBasket } from "lucide-react"
import { cn } from "@/lib/utils"

// Les deux agents IA (commande vocale + panier intelligent), partages entre
// l'accueil PWA, le catalogue (mobile et desktop) et l'accueil desktop.
// Les handlers restent ceux de chaque page.
//
// Identite fixe sur tous les ecrans :
// - Commande vocale : carte foret + orbe cyan/turquoise (apercu de la VoiceOrb
//   de la modale). L'orbe n'emet ses ondes qu'au survol / appui / focus.
// - Panier intelligent : carte blanche + medaillon vert, avec les vrais
//   criteres du formulaire (budget, personnes, plat marocain).
//
// Variantes :
// - featured : accueil PWA — voix en vedette, panier en bandeau dessous
// - compact  : catalogue mobile — meme hierarchie, plus dense
// - row      : catalogue desktop — empile, puis cote a cote a partir de xl
// - inline   : accueil desktop — deux boutons pilule de meme poids
export type AiAgentCardsVariant = "featured" | "compact" | "row" | "inline"

const SMART_CRITERIA = ["Budget", "Personnes", "Plat marocain"]

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C400] focus-visible:ring-offset-2 focus-visible:ring-offset-white"

function VoiceOrbGlyph({ className, iconClassName }: { className?: string; iconClassName?: string }) {
  return (
    <span aria-hidden="true" className={cn("souki-voice-orb flex shrink-0 items-center justify-center", className)}>
      <Mic className={cn("relative text-[#0B2A15]", iconClassName)} strokeWidth={2.4} />
    </span>
  )
}

export function AiAgentCards({
  onSmart,
  onVoice,
  variant = "featured",
  className,
}: {
  onSmart: () => void
  onVoice: () => void
  variant?: AiAgentCardsVariant
  className?: string
}) {
  if (variant === "inline") {
    return (
      <div className={cn("flex flex-wrap items-center gap-3", className)}>
        <button
          type="button"
          onClick={onVoice}
          className={cn(
            "group inline-flex min-h-12 items-center gap-3 rounded-full bg-gradient-to-br from-[#123F22] to-[#0A2614] py-1.5 pl-1.5 pr-5 text-[15px] font-bold text-white shadow-[0_14px_30px_-16px_rgba(10,38,20,0.8)] transition-transform hover:-translate-y-0.5 active:scale-[0.98]",
            focusRing
          )}
        >
          <VoiceOrbGlyph className="h-9 w-9" iconClassName="h-4 w-4" />
          Commande vocale
        </button>
        <button
          type="button"
          onClick={onSmart}
          className={cn(
            "group inline-flex min-h-12 items-center gap-3 rounded-full border border-[#D7E7D9] bg-white py-1.5 pl-1.5 pr-5 text-[15px] font-bold text-[#14301B] shadow-sm transition-colors hover:border-[#1E8A3C]/40 hover:bg-[#F3FAF4] active:scale-[0.98]",
            focusRing
          )}
        >
          <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1E8A3C] text-white">
            <ShoppingBasket className="h-4 w-4" />
          </span>
          Panier intelligent
        </button>
      </div>
    )
  }

  const featured = variant === "featured"
  const compact = variant === "compact"

  return (
    <div className={cn("grid gap-3", variant === "row" && "xl:grid-cols-2", className)}>
      {/* ── Commande vocale : l'element vedette ── */}
      <button
        type="button"
        onClick={onVoice}
        className={cn(
          "group relative isolate flex w-full items-center overflow-hidden bg-gradient-to-br from-[#123F22] via-[#0F3A20] to-[#0A2614] text-left text-white shadow-[0_20px_40px_-22px_rgba(10,38,20,0.9)] ring-1 ring-white/10 transition-transform duration-200 ease-out active:scale-[0.98]",
          featured ? "gap-5 rounded-[28px] p-5" : compact ? "gap-4 rounded-3xl p-4" : "gap-4 rounded-2xl p-4",
          focusRing
        )}
      >
        {/* Lueur cyan qui prolonge l'orbe dans la carte */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -left-10 top-1/2 -z-10 h-40 w-40 -translate-y-1/2 rounded-full bg-[rgba(80,220,230,0.22)] blur-3xl"
        />
        <VoiceOrbGlyph
          className={featured ? "h-[76px] w-[76px]" : "h-[60px] w-[60px]"}
          iconClassName={featured ? "h-8 w-8" : "h-6 w-6"}
        />
        <span className="min-w-0 flex-1">
          <span className={cn("block font-black leading-tight", featured ? "text-[19px]" : "text-[17px]")}>
            Commande vocale
          </span>
          <span className={cn("mt-1 block font-medium leading-snug text-white/80", featured ? "text-[14px]" : "text-[13px]")}>
            Dites votre liste, Souki remplit le panier.
          </span>
          {!compact && (
            <span className="mt-3 inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[#F5C400] px-3.5 text-[13px] font-black text-[#14301B] transition-colors group-hover:bg-[#FFD21F]">
              <Mic aria-hidden="true" className="h-3.5 w-3.5" />
              Dicter ma liste
            </span>
          )}
        </span>
        {compact && <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-white/60" />}
      </button>

      {/* ── Panier intelligent : bandeau secondaire ── */}
      <button
        type="button"
        onClick={onSmart}
        className={cn(
          "group flex w-full items-center gap-3.5 border border-[#D7EBD9] bg-white text-left text-[#14301B] shadow-[0_12px_28px_-22px_rgba(17,59,30,0.55)] transition-colors hover:border-[#1E8A3C]/40 hover:bg-[#F7FCF7] active:scale-[0.99]",
          featured ? "min-h-[76px] rounded-[22px] px-4 py-3.5" : "min-h-[68px] rounded-2xl px-3.5 py-3",
          variant === "row" && "xl:h-full",
          focusRing
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex shrink-0 items-center justify-center rounded-2xl bg-[#1E8A3C] text-white shadow-[0_8px_18px_-10px_rgba(30,138,60,0.9)]",
            featured ? "h-12 w-12" : "h-11 w-11"
          )}
        >
          <ShoppingBasket className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block font-black leading-tight", featured ? "text-[16px]" : "text-[15px]")}>
            Panier intelligent
          </span>
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {SMART_CRITERIA.map((criterion) => (
              <span
                key={criterion}
                className="rounded-full bg-[#F0FAF1] px-2 py-0.5 text-[12px] font-semibold leading-5 text-[#1E6B33]"
              >
                {criterion}
              </span>
            ))}
          </span>
        </span>
        <ChevronRight
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-[#1E8A3C] transition-transform group-hover:translate-x-0.5"
        />
      </button>
    </div>
  )
}
