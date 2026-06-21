"use client"

import { useId } from "react"
import type { KeyboardEvent } from "react"

import { cn } from "@/lib/utils"

type FarmerAvatarSize = "sm" | "md" | "lg" | "xl"
type FarmerAvatarExpression = "welcome" | "explain" | "celebrate"

const sizeClassNames: Record<FarmerAvatarSize, string> = {
  sm: "h-16 w-16",
  md: "h-24 w-24",
  lg: "h-40 w-40",
  xl: "h-52 w-52",
}

const expressionClassNames: Record<FarmerAvatarExpression, string> = {
  welcome: "farmer-avatar--welcome",
  explain: "farmer-avatar--explain",
  celebrate: "farmer-avatar--celebrate",
}

type FarmerAvatarProps = {
  className?: string
  size?: FarmerAvatarSize
  expression?: FarmerAvatarExpression
  interactive?: boolean
  label?: string
  onClick?: () => void
}

export function FarmerAvatar({
  className,
  size = "md",
  expression = "welcome",
  interactive = false,
  label = "Farmer avatar, Souki agricultural guide",
  onClick,
}: FarmerAvatarProps) {
  const gradientId = useId()
  const skinGradientId = `${gradientId}-skin`
  const shirtGradientId = `${gradientId}-shirt`
  const hatGradientId = `${gradientId}-hat`
  const beardGradientId = `${gradientId}-beard`
  const vestGradientId = `${gradientId}-vest`

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
        "farmer-avatar",
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
      <svg viewBox="0 0 220 260" className="h-full w-full drop-shadow-[0_18px_24px_rgba(30,60,30,0.18)]">
        <defs>
          <radialGradient id={skinGradientId} cx="45%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FDDCB5" />
            <stop offset="60%" stopColor="#F5C69A" />
            <stop offset="100%" stopColor="#E8A96E" />
          </radialGradient>
          <linearGradient id={shirtGradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#4CB84A" />
            <stop offset="100%" stopColor="#1E8A3C" />
          </linearGradient>
          <linearGradient id={hatGradientId} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#F5D98A" />
            <stop offset="50%" stopColor="#D4A843" />
            <stop offset="100%" stopColor="#B8892F" />
          </linearGradient>
          <linearGradient id={beardGradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#6B4226" />
            <stop offset="100%" stopColor="#4A2E18" />
          </linearGradient>
          <linearGradient id={vestGradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#1E8A3C" />
            <stop offset="100%" stopColor="#145C28" />
          </linearGradient>
        </defs>

        {/* Ground shadow */}
        <ellipse className="farmer-avatar-shadow" cx="110" cy="248" rx="52" ry="10" fill="#1E3A1E" opacity="0.12" />

        <g className="farmer-avatar-body">
          {/* Body / Torso - green shirt */}
          <path
            d="M72 148c0 0-8 12-10 32s-2 42 0 52c4 16 12 20 48 20s44-4 48-20c2-10 2-32 0-52s-10-32-10-32c-8-6-20-10-38-10s-30 4-38 10Z"
            fill={`url(#${shirtGradientId})`}
          />
          {/* Vest overlay */}
          <path
            d="M82 152c-4 8-8 24-8 42v30c8 6 20 8 36 8s28-2 36-8v-30c0-18-4-34-8-42l-14-4v18c0 6-8 10-14 10s-14-4-14-10v-18Z"
            fill={`url(#${vestGradientId})`}
            opacity="0.7"
          />
          {/* Shirt collar */}
          <path d="M96 138l14 14 14-14" fill="none" stroke="#F5F5F0" strokeWidth="3" strokeLinecap="round" />

          {/* Left arm (default position) */}
          <g className="farmer-avatar-left-arm">
            <path d="M72 152c-14 10-22 24-26 40" fill="none" stroke="#3DA63F" strokeLinecap="round" strokeWidth="14" />
            <g className="farmer-avatar-left-hand">
              <circle cx="43" cy="196" r="11" fill={`url(#${skinGradientId})`} />
              <path d="M37 190c-4-5-5-10-3-15" fill="none" stroke="#F5C69A" strokeLinecap="round" strokeWidth="4.5" />
              <path d="M44 185c-1-6 0-11 3-15" fill="none" stroke="#F5C69A" strokeLinecap="round" strokeWidth="4.5" />
            </g>
          </g>

          {/* Right arm (default position) */}
          <g className="farmer-avatar-right-arm">
            <path d="M148 152c14 10 22 24 26 40" fill="none" stroke="#3DA63F" strokeLinecap="round" strokeWidth="14" />
            <g className="farmer-avatar-right-hand">
              <circle cx="177" cy="196" r="11" fill={`url(#${skinGradientId})`} />
              <path d="M183 190c4-5 5-10 3-15" fill="none" stroke="#F5C69A" strokeLinecap="round" strokeWidth="4.5" />
              <path d="M176 185c1-6 0-11-3-15" fill="none" stroke="#F5C69A" strokeLinecap="round" strokeWidth="4.5" />
            </g>
          </g>

          {/* Wave arm (welcome pose) */}
          <g className="farmer-avatar-wave-arm" aria-hidden="true">
            <path d="M148 148c16-18 26-38 30-60" fill="none" stroke="#3DA63F" strokeLinecap="round" strokeWidth="14" />
            <g className="farmer-avatar-wave-hand">
              <circle cx="180" cy="82" r="11" fill={`url(#${skinGradientId})`} />
              <path className="farmer-avatar-wave-finger farmer-avatar-wave-finger-1" d="M174 74c-4-6-5-12-3-18" fill="none" stroke="#F5C69A" strokeLinecap="round" strokeWidth="4.5" />
              <path className="farmer-avatar-wave-finger farmer-avatar-wave-finger-2" d="M181 70c0-7 2-13 6-18" fill="none" stroke="#F5C69A" strokeLinecap="round" strokeWidth="4.5" />
              <path className="farmer-avatar-wave-finger farmer-avatar-wave-finger-3" d="M188 76c5-4 11-5 17-3" fill="none" stroke="#F5C69A" strokeLinecap="round" strokeWidth="4.5" />
            </g>
          </g>

          {/* Point arm (explain pose) */}
          <g className="farmer-avatar-point-arm" aria-hidden="true">
            <path d="M148 150c18-6 34-8 52-4" fill="none" stroke="#3DA63F" strokeLinecap="round" strokeWidth="14" />
            <g className="farmer-avatar-point-hand">
              <circle cx="204" cy="143" r="10" fill={`url(#${skinGradientId})`} />
              <path d="M210 135c6-2 12-1 17 2" fill="none" stroke="#F5C69A" strokeLinecap="round" strokeWidth="4.5" />
            </g>
          </g>

          {/* Celebrate arms */}
          <g className="farmer-avatar-celebrate-left" aria-hidden="true">
            <path d="M72 150c-18-14-28-32-32-54" fill="none" stroke="#3DA63F" strokeLinecap="round" strokeWidth="14" />
            <circle cx="38" cy="90" r="11" fill={`url(#${skinGradientId})`} />
            <path d="M30 82c-3-7-2-13 2-18" fill="none" stroke="#F5C69A" strokeLinecap="round" strokeWidth="4.5" />
            <path d="M38 78c1-7 4-12 9-16" fill="none" stroke="#F5C69A" strokeLinecap="round" strokeWidth="4.5" />
          </g>
          <g className="farmer-avatar-celebrate-right" aria-hidden="true">
            <path d="M148 150c18-14 28-32 32-54" fill="none" stroke="#3DA63F" strokeLinecap="round" strokeWidth="14" />
            <circle cx="182" cy="90" r="11" fill={`url(#${skinGradientId})`} />
            <path d="M190 82c3-7 2-13-2-18" fill="none" stroke="#F5C69A" strokeLinecap="round" strokeWidth="4.5" />
            <path d="M182 78c-1-7-4-12-9-16" fill="none" stroke="#F5C69A" strokeLinecap="round" strokeWidth="4.5" />
          </g>

          {/* Head */}
          <g className="farmer-avatar-head">
            {/* Neck */}
            <rect x="100" y="126" width="20" height="16" rx="8" fill={`url(#${skinGradientId})`} />

            {/* Face shape */}
            <ellipse cx="110" cy="100" rx="34" ry="38" fill={`url(#${skinGradientId})`} />

            {/* Ears */}
            <ellipse cx="76" cy="102" rx="6" ry="8" fill="#F5C69A" />
            <ellipse cx="144" cy="102" rx="6" ry="8" fill="#F5C69A" />

            {/* Beard */}
            <path
              d="M82 108c0 0 2 24 10 30c6 5 12 6 18 6s12-1 18-6c8-6 10-30 10-30c-4 6-16 10-28 10s-24-4-28-10Z"
              fill={`url(#${beardGradientId})`}
            />
            {/* Beard texture */}
            <path d="M90 118c4 8 12 14 20 14s16-6 20-14" fill="none" stroke="#5A3820" strokeWidth="1.5" opacity="0.4" />
            <path d="M94 126c3 5 10 8 16 8s13-3 16-8" fill="none" stroke="#5A3820" strokeWidth="1.2" opacity="0.3" />

            {/* Eyes */}
            <g className="farmer-avatar-eyes">
              <ellipse cx="96" cy="92" rx="5" ry="6" fill="#2D1B0E" />
              <ellipse cx="124" cy="92" rx="5" ry="6" fill="#2D1B0E" />
              <g className="farmer-avatar-eye-shine">
                <circle cx="94" cy="90" r="2" fill="#FFFFFF" />
                <circle cx="122" cy="90" r="2" fill="#FFFFFF" />
              </g>
            </g>

            {/* Eyebrows */}
            <path d="M88 82c3-3 7-4 12-3" fill="none" stroke="#5A3820" strokeLinecap="round" strokeWidth="2.5" />
            <path d="M120 79c5-1 9 0 12 3" fill="none" stroke="#5A3820" strokeLinecap="round" strokeWidth="2.5" />

            {/* Nose */}
            <path d="M108 96c1 4 2 6 4 6" fill="none" stroke="#D4956A" strokeLinecap="round" strokeWidth="2" />

            {/* Mouth - friendly smile */}
            <path
              className="farmer-avatar-mouth"
              d="M98 112c5 6 14 8 22 4"
              fill="none"
              stroke="#7D3B1A"
              strokeLinecap="round"
              strokeWidth="3"
            />

            {/* Cheeks */}
            <circle cx="84" cy="104" r="6" fill="#F5A07A" opacity="0.3" />
            <circle cx="136" cy="104" r="6" fill="#F5A07A" opacity="0.3" />

            {/* Hat */}
            <g className="farmer-avatar-hat">
              {/* Hat brim */}
              <ellipse cx="110" cy="70" rx="44" ry="10" fill={`url(#${hatGradientId})`} />
              {/* Hat crown */}
              <path
                d="M82 70c0-22 12-34 28-34s28 12 28 34Z"
                fill={`url(#${hatGradientId})`}
              />
              {/* Hat band */}
              <rect x="84" y="62" width="52" height="8" rx="3" fill="#1E8A3C" />
              {/* Leaf decoration on hat */}
              <g className="farmer-avatar-hat-leaf">
                <path d="M130 56c6-8 14-10 20-6c-2 8-10 12-20 10Z" fill="#4CB84A" />
                <path d="M130 56c6-8 14-10 20-6" fill="none" stroke="#1E8A3C" strokeWidth="1" opacity="0.6" />
                <path d="M133 54c2-3 4-3 6-2" fill="none" stroke="#1E8A3C" strokeWidth="0.8" opacity="0.5" />
              </g>
              {/* Hat straw texture */}
              <path d="M86 50c8-4 16-6 24-6s16 2 24 6" fill="none" stroke="#C49330" strokeWidth="1" opacity="0.4" />
              <path d="M88 56c7-3 14-4 22-4s15 1 22 4" fill="none" stroke="#C49330" strokeWidth="1" opacity="0.3" />
            </g>
          </g>
        </g>

        {/* Sparkles (celebrate) */}
        <g className="farmer-avatar-sparkles" aria-hidden="true">
          <path d="M30 60h12M36 54v12" stroke="#F5C400" strokeLinecap="round" strokeWidth="4" />
          <path d="M180 40h10M185 35v10" stroke="#F5C400" strokeLinecap="round" strokeWidth="3.5" />
          <path d="M48 130h8M52 126v8" stroke="#4CB84A" strokeLinecap="round" strokeWidth="3" />
          <path d="M168 125h8M172 121v8" stroke="#4CB84A" strokeLinecap="round" strokeWidth="3" />
        </g>
      </svg>
    </div>
  )
}
