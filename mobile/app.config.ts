import type { ExpoConfig } from "expo/config"

const config: ExpoConfig = {
  name: "SOUKI Fresh Market",
  slug: "souki-mobile",
  scheme: "souki",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  owner: process.env.EXPO_PUBLIC_EAS_OWNER,
  runtimeVersion: {
    policy: "appVersion"
  },
  updates: {
    url: process.env.EXPO_PUBLIC_EAS_UPDATE_URL
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    mapboxAccessToken: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN,
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID
    }
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "ma.souki.mobile"
  },
  android: {
    package: "ma.souki.mobile",
    permissions: ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION", "INTERNET"],
    adaptiveIcon: {
      backgroundColor: "#F0FAF1",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png"
    },
    predictiveBackGestureEnabled: false
  },
  plugins: [
    "expo-router",
    "expo-status-bar",
    "expo-secure-store",
    "expo-image",
    "expo-font",
    "expo-splash-screen",
    "expo-web-browser",
    [
      "@rnmapbox/maps",
      {
        RNMapboxMapsVersion: "11.8.0",
        RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOADS_TOKEN
      }
    ]
  ],
  web: {
    favicon: "./assets/favicon.png"
  },
  experiments: {
    typedRoutes: true
  }
}

export default config
