import { Pressable, View } from "react-native"
import Svg, { Path } from "react-native-svg"

import { Text } from "@/components/text"
import { haptics } from "@/lib/haptics"
import { palette, radius } from "@/theme"

/**
 * Boutons « Continuer avec Apple » et « Continuer avec Google » (SocialButton, design 2027) :
 * 54 pt, rayon pilule, Apple noir en premier, Google blanc avec son « G » en couleurs.
 * A remplacer par le bouton systeme d'Apple (`AppleAuthenticationButton`, expo-apple-authentication)
 * et le bouton de la marque Google quand ces connexions seront branchees (B1, B2).
 */
const APPLE_PATH =
  "M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"

function AppleMark({ size = 19 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={{ marginTop: -3 }}>
      <Path d={APPLE_PATH} fill={palette.white} />
    </Svg>
  )
}

function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <Path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <Path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <Path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </Svg>
  )
}

export function SocialButton({ provider, label, onPress, compact = false }: { provider: "apple" | "google"; label: string; onPress: () => void; compact?: boolean }) {
  const apple = provider === "apple"
  return (
    <Pressable
      onPress={() => {
        haptics.selection()
        onPress()
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        minHeight: compact ? 50 : 54,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        paddingHorizontal: 18,
        borderRadius: radius.pill,
        backgroundColor: apple ? "#000000" : palette.white,
        boxShadow: apple ? undefined : `inset 0 0 0 1.5px ${palette.line}`,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <View style={{ width: 20, alignItems: "center" }}>{apple ? <AppleMark /> : <GoogleMark />}</View>
      <Text weight="bold" color={apple ? palette.white : palette.ink900} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flexShrink: 1, fontSize: 16 }}>
        {label}
      </Text>
    </Pressable>
  )
}
