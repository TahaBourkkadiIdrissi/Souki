import * as SecureStore from "expo-secure-store"

export const TOKEN_KEY = "souki-auth-token"

export async function getSecureItem(key: string) {
  return SecureStore.getItemAsync(key)
}

export async function setSecureItem(key: string, value: string) {
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
  })
}

export async function deleteSecureItem(key: string) {
  await SecureStore.deleteItemAsync(key)
}

export const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key)
}
