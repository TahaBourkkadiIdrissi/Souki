import type { StyleProp, ViewStyle } from "react-native"
import Svg, { Path } from "react-native-svg"

/** Le « S » du sac SOUKI redessine comme un chemin : du marche a la porte (design system 2027). */
export const S_PATH = "M200 10 C 120 10 40 40 40 92 C 40 150 160 140 160 196 C 160 248 80 270 10 270"

type SMotifProps = {
  size: number
  color?: string
  opacity?: number
  style?: StyleProp<ViewStyle>
}

/**
 * Filigrane en « S » des en-tetes et de la carte « Marche du jour ». Signature reservee :
 * jamais en decoration ailleurs. Purement decoratif (masque a VoiceOver).
 */
export function SMotif({ size, color = "#FFFFFF", opacity = 0.09, style }: SMotifProps) {
  return (
    <Svg
      width={size}
      height={size * (280 / 210)}
      viewBox="0 0 210 280"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ position: "absolute", opacity }, style]}
    >
      <Path d={S_PATH} fill="none" stroke={color} strokeWidth={34} strokeLinecap="round" />
    </Svg>
  )
}
