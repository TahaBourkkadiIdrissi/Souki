import { Image } from "expo-image"
import { Link, useRouter, type Href } from "expo-router"
import { ArrowLeft, LogOut, Menu } from "lucide-react-native"
import React from "react"
import { Pressable, Text, View } from "react-native"

import { useAuth } from "@/contexts/AuthContext"
import { colors } from "@/theme/tokens"

export function BrandHeader({
  title,
  subtitle,
  backHref
}: {
  title?: string
  subtitle?: string
  backHref?: string
}) {
  const router = useRouter()
  const { isAuthenticated, logout } = useAuth()

  return (
    <View className="border-b border-gray-100 bg-white/90 px-4 py-3 shadow-nav">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          {backHref ? (
            <Pressable className="rounded-xl bg-bg-card p-2" onPress={() => router.push(backHref as Href)}>
              <ArrowLeft color={colors.textBody} size={20} />
            </Pressable>
          ) : null}
          <Link href="/" asChild>
            <Pressable className="flex-row items-center gap-3">
              <View className="h-11 w-11 overflow-hidden rounded-xl bg-white p-0.5 shadow-sm">
                <Image source={require("../../../assets/logo3.png")} className="h-full w-full" contentFit="cover" />
              </View>
              <View>
                <Text className="text-xl font-bold leading-5 text-primary">SOUKI</Text>
                <Text className="text-[11px] font-medium uppercase text-text-muted">Fresh Market</Text>
              </View>
            </Pressable>
          </Link>
        </View>
        {isAuthenticated ? (
          <Pressable className="rounded-xl bg-bg-card p-2" onPress={async () => {
             await logout();
             router.replace('/login');
          }}>
            <LogOut color={colors.greenMarket} size={20} />
          </Pressable>
        ) : (
          <Link href="/login" asChild>
            <Pressable className="rounded-xl bg-bg-card p-2">
              <Menu color={colors.greenMarket} size={22} />
            </Pressable>
          </Link>
        )}
      </View>
      {title ? (
        <View className="mt-4">
          <Text className="text-lg font-bold text-text-body">{title}</Text>
          {subtitle ? <Text className="text-xs text-text-muted">{subtitle}</Text> : null}
        </View>
      ) : null}
    </View>
  )
}
