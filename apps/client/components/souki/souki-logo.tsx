import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"

type LogoProps = {
  variant?: "horizontal" | "secondary" | "symbol" | "submark"
  height?: number
  support?: boolean
  priority?: boolean
  decorative?: boolean
  className?: string
}

const dimensions = {
  horizontal: [1825, 611],
  secondary: [1189, 1156],
  symbol: [625, 611],
  submark: [1254, 1254],
} as const

// symbol.png a une marge transparente a gauche (dessin entre x=134 et x=607 sur 625) :
// on recentre optiquement le dessin dans sa boite.
const opticalOffset: Partial<Record<NonNullable<LogoProps["variant"]>, string>> = {
  symbol: "translateX(-9%)",
}

/** Supplied artwork only; explicit dimensions reserve space before loading. */
export function SoukiLogo({ variant = "horizontal", height = 36, support = false, priority = false, decorative = false, className }: LogoProps) {
  const [width, originalHeight] = dimensions[variant]
  const renderedWidth = Math.round(height * width / originalHeight)
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center align-middle", support && "rounded-xl bg-white p-2", className)}>
      <Image
        src={`/brand/souki-2026/${variant}.png`}
        alt={decorative ? "" : "SOUKI"}
        width={renderedWidth}
        height={height}
        sizes={`${renderedWidth}px`}
        priority={priority}
        className="block max-w-none object-contain"
        style={{ width: renderedWidth, height, transform: opticalOffset[variant] }}
      />
    </span>
  )
}

export function SoukiLogoLink({ href = "/", className, ...props }: LogoProps & { href?: string }) {
  return (
    <Link href={href} aria-label="SOUKI — Accueil" className={cn("inline-flex shrink-0 items-center rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#005B43]", className)}>
      <SoukiLogo {...props} decorative />
    </Link>
  )
}
