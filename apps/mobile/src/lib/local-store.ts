import { Platform } from "react-native"
import Storage from "expo-sqlite/kv-store"

/**
 * Donnees non sensibles gardees sur le telephone (panier, favoris, dernier catalogue),
 * dans la base SQLite cle/valeur d'Expo : lecture synchrone, donc l'ecran s'affiche
 * directement avec le contenu enregistre. Le jeton reste dans le Trousseau (device-storage.ts).
 * Sur le web (apercu de developpement), tout reste en memoire.
 */
const memory = new Map<string, string>()
const isWeb = Platform.OS === "web"

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = isWeb ? memory.get(key) ?? null : Storage.getItemSync(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): void {
  const raw = JSON.stringify(value)
  if (isWeb) {
    memory.set(key, raw)
    return
  }
  Storage.setItemAsync(key, raw).catch(() => undefined)
}
