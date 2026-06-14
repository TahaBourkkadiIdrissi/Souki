import "react-native-url-polyfill/auto"

import { createClient } from "@supabase/supabase-js"

import { secureStoreAdapter } from "@/services/secureStorage"

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ""

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          storage: secureStoreAdapter
        }
      })
    : null
