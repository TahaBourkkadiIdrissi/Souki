import React from "react"
import { Text, TextInput, TextInputProps, View } from "react-native"

export function TextField({
  label,
  error,
  ...props
}: TextInputProps & {
  label: string
  error?: string
}) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-text-body">{label}</Text>
      <TextInput
        placeholderTextColor="#8A8A8A"
        className="min-h-12 rounded-xl border border-border bg-white px-4 text-base text-text-body"
        {...props}
      />
      {error ? <Text className="text-xs font-medium text-destructive">{error}</Text> : null}
    </View>
  )
}
