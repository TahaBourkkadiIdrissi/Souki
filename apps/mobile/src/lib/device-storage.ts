import { Platform } from "react-native"
import * as SecureStore from "expo-secure-store"

/**
 * Stockage chiffre de l'appareil (Keychain iOS via expo-secure-store).
 * Sur le web (apercu de developpement uniquement), expo-secure-store n'existe pas :
 * on garde les valeurs en memoire pour ne jamais ecrire un jeton dans localStorage.
 */
const memory = new Map<string, string>()
const isWeb = Platform.OS === "web"

export async function readItem(key: string): Promise<string | null> {
  if (isWeb) return memory.get(key) ?? null
  try {
    return await SecureStore.getItemAsync(key)
  } catch {
    return null
  }
}

export async function writeItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    memory.set(key, value)
    return
  }
  await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK })
}

export async function removeItem(key: string): Promise<void> {
  if (isWeb) {
    memory.delete(key)
    return
  }
  await SecureStore.deleteItemAsync(key)
}
