import { View, type StyleProp, type TextStyle } from "react-native"
import Animated, { FadeInDown, FadeOutUp, useReducedMotion } from "react-native-reanimated"

import { Text, type TextProps } from "@/components/text"
import { EASE_OUT } from "@/lib/motion"

const DIGIT_IN = FadeInDown.duration(220).easing(EASE_OUT)
const DIGIT_OUT = FadeOutUp.duration(180).easing(EASE_OUT)

type AnimatedDigitsProps = Pick<TextProps, "variant" | "weight" | "color"> & {
  value: string
  style?: StyleProp<TextStyle>
}

/**
 * Texte dont chaque caractere qui change « roule » vers le haut (compte a rebours,
 * total du panier). Seuls les caracteres modifies s'animent ; rien avec « Reduire les animations ».
 */
export function AnimatedDigits({ value, style, ...textProps }: AnimatedDigitsProps) {
  const reducedMotion = useReducedMotion()
  return (
    <View style={{ flexDirection: "row", direction: "ltr", overflow: "hidden" }} accessible accessibilityLabel={value}>
      {value.split("").map((char, index) => (
        <Animated.View
          // La cle porte le caractere : un chiffre qui change est remplace, donc anime.
          key={`${index}-${char}`}
          entering={reducedMotion ? undefined : DIGIT_IN}
          exiting={reducedMotion ? undefined : DIGIT_OUT}
        >
          <Text {...textProps} style={[{ fontVariant: ["tabular-nums"] }, style]}>
            {char}
          </Text>
        </Animated.View>
      ))}
    </View>
  )
}
