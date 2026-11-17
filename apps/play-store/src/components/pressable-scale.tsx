import { useState, type ReactNode } from "react"
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native"
import Animated, { useReducedMotion } from "react-native-reanimated"

type PressableScaleProps = Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle>
  /** Style de la zone touchable elle-meme (ex. `flex: 1` pour remplir une rangee). */
  containerStyle?: StyleProp<ViewStyle>
  children: ReactNode
}

/**
 * Retour au toucher : l'element s'enfonce legerement (0,97) des que le doigt se pose,
 * en 120 ms (transition CSS de Reanimated, sur le fil UI). Avec « Reduire les animations »,
 * seule l'opacite change.
 */
export function PressableScale({ style, containerStyle, children, onPressIn, onPressOut, ...props }: PressableScaleProps) {
  const [pressed, setPressed] = useState(false)
  const reducedMotion = useReducedMotion()

  return (
    <Pressable
      {...props}
      style={containerStyle}
      onPressIn={(event) => {
        setPressed(true)
        onPressIn?.(event)
      }}
      onPressOut={(event) => {
        setPressed(false)
        onPressOut?.(event)
      }}
    >
      <Animated.View
        style={[
          {
            transform: [{ scale: pressed && !reducedMotion ? 0.97 : 1 }],
            transitionProperty: "transform",
            transitionDuration: 120,
            transitionTimingFunction: "ease-out",
          },
          // Le style de l'appelant garde la main sur l'opacite (ex. bouton desactive).
          style,
          pressed && reducedMotion ? { opacity: 0.7 } : null,
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  )
}
