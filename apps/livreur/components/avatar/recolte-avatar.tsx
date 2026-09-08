"use client"

import { useId } from "react"
import type { KeyboardEvent } from "react"

import { cn } from "@/lib/utils"

type RecolteAvatarSize = "sm" | "md" | "lg" | "xl"
type RecolteAvatarExpression = "idle" | "welcome" | "success" | "curious"

const sizeClassNames: Record<RecolteAvatarSize, string> = {
  sm: "h-16 w-16",
  md: "h-24 w-24",
  lg: "h-40 w-40",
  xl: "h-52 w-52",
}

const expressionClassNames: Record<RecolteAvatarExpression, string> = {
  idle: "recolte-avatar--idle",
  welcome: "recolte-avatar--welcome",
  success: "recolte-avatar--success",
  curious: "recolte-avatar--curious",
}

type RecolteAvatarProps = {
  className?: string
  size?: RecolteAvatarSize
  expression?: RecolteAvatarExpression
  interactive?: boolean
  label?: string
  onClick?: () => void
}

export function RecolteAvatar({
  className,
  size = "md",
  expression = "idle",
  interactive = false,
  label = "Recolte, mascotte tomate Souki",
  onClick,
}: RecolteAvatarProps) {
  const gradientId = useId()
  const tomatoGradientId = `${gradientId}-tomato`
  const leafGradientId = `${gradientId}-leaf`
  const basketGradientId = `${gradientId}-basket`

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive || !onClick) {
      return
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onClick()
    }
  }

  return (
    <div
      className={cn(
        "recolte-avatar",
        expressionClassNames[expression],
        sizeClassNames[size],
        interactive && "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#4CB84A] focus-visible:ring-offset-2",
        className
      )}
      role={interactive ? "button" : "img"}
      aria-label={label}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={handleKeyDown}
    >
      <svg viewBox="0 0 220 240" className="h-full w-full drop-shadow-[0_18px_24px_rgba(70,36,26,0.18)]">
        <defs>
          <radialGradient id={tomatoGradientId} cx="38%" cy="30%" r="72%">
            <stop offset="0%" stopColor="#FF7A64" />
            <stop offset="58%" stopColor="#E84B3C" />
            <stop offset="100%" stopColor="#C9362F" />
          </radialGradient>
          <linearGradient id={leafGradientId} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#69C85A" />
            <stop offset="100%" stopColor="#1E8A3C" />
          </linearGradient>
          <linearGradient id={basketGradientId} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#F3BA6D" />
            <stop offset="100%" stopColor="#B87128" />
          </linearGradient>
        </defs>

        <ellipse className="recolte-avatar-shadow" cx="110" cy="220" rx="58" ry="12" fill="#264129" opacity="0.14" />

        <g className="recolte-avatar-body">
          <g className="recolte-avatar-left-arm">
            <path d="M51 132c-16 10-25 22-28 38" fill="none" stroke="#D93F34" strokeLinecap="round" strokeWidth="16" />
            <g className="recolte-avatar-left-hand">
              <circle cx="20" cy="174" r="13" fill="#F46A55" />
              <path d="M12 169c-6-7-8-14-5-21" fill="none" stroke="#F46A55" strokeLinecap="round" strokeWidth="6" />
              <path d="M20 161c-2-8-1-15 4-21" fill="none" stroke="#F46A55" strokeLinecap="round" strokeWidth="6" />
            </g>
          </g>

          <g className="recolte-avatar-right-arm">
            <path d="M168 132c17 8 28 20 34 36" fill="none" stroke="#D93F34" strokeLinecap="round" strokeWidth="16" />
            <g className="recolte-avatar-right-hand">
              <circle cx="203" cy="172" r="13" fill="#F46A55" />
              <path d="M198 160c4-8 10-13 17-16" fill="none" stroke="#F46A55" strokeLinecap="round" strokeWidth="6" />
              <path d="M207 161c7-5 13-7 20-6" fill="none" stroke="#F46A55" strokeLinecap="round" strokeWidth="6" />
            </g>
          </g>

          <g className="recolte-avatar-wave-arm" aria-hidden="true">
            <path d="M164 128c13-21 21-42 25-64" fill="none" stroke="#D93F34" strokeLinecap="round" strokeWidth="16" />
            <g className="recolte-avatar-wave-hand">
              <circle cx="191" cy="57" r="13" fill="#F46A55" />
              <path className="recolte-avatar-wave-finger recolte-avatar-wave-finger-1" d="M184 50c-7-7-10-15-8-23" fill="none" stroke="#F46A55" strokeLinecap="round" strokeWidth="6" />
              <path className="recolte-avatar-wave-finger recolte-avatar-wave-finger-2" d="M193 45c-2-9 0-17 6-24" fill="none" stroke="#F46A55" strokeLinecap="round" strokeWidth="6" />
              <path className="recolte-avatar-wave-finger recolte-avatar-wave-finger-3" d="M201 52c7-5 15-7 23-5" fill="none" stroke="#F46A55" strokeLinecap="round" strokeWidth="6" />
            </g>
          </g>

          <path
            d="M48 114c0-45 26-78 62-78s62 33 62 78c0 47-27 86-62 86s-62-39-62-86Z"
            fill={`url(#${tomatoGradientId})`}
          />
          <path d="M66 92c6-26 22-42 44-42" fill="none" stroke="#FF9A86" strokeLinecap="round" strokeWidth="11" opacity="0.55" />
          <path d="M76 181c20 20 48 20 68 0" fill="none" stroke="#B92D2A" strokeLinecap="round" strokeWidth="7" opacity="0.28" />

          <g className="recolte-avatar-leaves">
            <path d="M109 43c-6-18-3-31 9-39 9 13 8 27-3 42Z" fill={`url(#${leafGradientId})`} />
            <path d="M105 47C87 31 75 18 71 4c20 1 34 13 42 36Z" fill={`url(#${leafGradientId})`} />
            <path d="M115 47c18-16 34-22 50-18-7 16-22 25-45 27Z" fill={`url(#${leafGradientId})`} />
            <path d="M101 52c-19-4-34 0-46 12 17 10 34 8 51-6Z" fill={`url(#${leafGradientId})`} />
            <path d="M121 52c19-4 35 0 48 12-18 10-36 8-53-6Z" fill={`url(#${leafGradientId})`} />
            <path d="M103 48c5 10 10 15 18 0" fill="#2F6F2B" opacity="0.45" />
          </g>

          <g className="recolte-avatar-face">
            <g className="recolte-avatar-eyes">
              <ellipse cx="88" cy="105" rx="9" ry="12" fill="#1F2521" />
              <ellipse cx="132" cy="105" rx="9" ry="12" fill="#1F2521" />
              <g className="recolte-avatar-eye-shine">
                <circle cx="85" cy="101" r="3" fill="#FFFFFF" />
                <circle cx="129" cy="101" r="3" fill="#FFFFFF" />
              </g>
            </g>
            <g className="recolte-avatar-closed-eyes" aria-hidden="true">
              <path d="M77 105c7 7 15 7 22 0" fill="none" stroke="#1F2521" strokeLinecap="round" strokeWidth="6" />
              <path d="M121 105c7 7 15 7 22 0" fill="none" stroke="#1F2521" strokeLinecap="round" strokeWidth="6" />
            </g>
            <path
              className="recolte-avatar-mouth"
              d="M87 134c12 18 34 18 46 0"
              fill="none"
              stroke="#671F20"
              strokeLinecap="round"
              strokeWidth="8"
            />
            <circle cx="72" cy="127" r="9" fill="#FF9886" opacity="0.46" />
            <circle cx="149" cy="127" r="9" fill="#FF9886" opacity="0.46" />
          </g>

          <g className="recolte-avatar-basket">
            <path d="M77 184h66l-8 29H85Z" fill={`url(#${basketGradientId})`} />
            <path d="M86 184c4-18 45-18 49 0" fill="none" stroke="#9D5E1F" strokeWidth="6" />
            <path d="M82 195h57M88 206h45M96 184l-8 29M111 184v29M126 184l8 29" fill="none" stroke="#8C551F" strokeWidth="3" opacity="0.45" />
          </g>
        </g>

        <g className="recolte-avatar-sparkles" aria-hidden="true">
          <path d="M32 72h15M39.5 64.5v15" stroke="#F5C400" strokeLinecap="round" strokeWidth="5" />
          <path d="M178 69h12M184 63v12" stroke="#F5C400" strokeLinecap="round" strokeWidth="4" />
        </g>
      </svg>
    </div>
  )
}
