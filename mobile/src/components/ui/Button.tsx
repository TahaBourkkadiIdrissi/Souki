import React, { ReactNode } from "react"
import { ActivityIndicator, Pressable, Text } from "react-native"

export function Button({
  children,
  onPress,
  variant = "primary",
  disabled,
  loading
}: {
  children: ReactNode
  onPress?: () => void
  variant?: "primary" | "accent" | "outline" | "ghost" | "danger"
  disabled?: boolean
  loading?: boolean
}) {
  const variants = {
    primary: "bg-primary",
    accent: "bg-accent",
    outline: "bg-white border-2 border-primary",
    ghost: "bg-transparent",
    danger: "bg-destructive"
  }
  const textVariants = {
    primary: "text-white",
    accent: "text-white",
    outline: "text-primary",
    ghost: "text-text-body",
    danger: "text-white"
  }

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      className={`min-h-12 items-center justify-center rounded-xl px-5 py-3 ${variants[variant]} ${
        disabled || loading ? "opacity-60" : "active:opacity-80"
      }`}
    >
      {loading ? (
        <ActivityIndicator color={variant === "outline" || variant === "ghost" ? "#1E8A3C" : "#FFFFFF"} />
      ) : (
        <Text className={`text-center text-base font-bold ${textVariants[variant]}`}>{children}</Text>
      )}
    </Pressable>
  )
}
