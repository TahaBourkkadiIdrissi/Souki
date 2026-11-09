import type { ConfigContext, ExpoConfig } from "expo/config"

/**
 * Configuration de l'app iOS SOUKI.
 * L'URL de l'API se change sans toucher au code : EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:8000 pnpm dev:mobile
 * (en local, le back-end FastAPI ecoute sans le prefixe /backend que nginx ajoute en production).
 */
const DEFAULT_API_BASE_URL = "https://souki.io/backend"

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "SOUKI",
  slug: "souki",
  scheme: "souki",
  version: "0.1.0",
  orientation: "portrait",
  // Icone 1024 x 1024 px exigee par l'App Store, sans transparence : le sac de l'ecran de lancement
  // (brand/splash-symbol.png) sur souki-900 #005B43, marge = hauteur de la feuille (design system).
  // L'ancienne icone 512 px (assets/icon.png) est gardee.
  icon: "./assets/brand/app-icon-1024.png",
  // Identite SOUKI en clair, comme la PWA (fond creme, verts de la marque).
  userInterfaceStyle: "light",
  ios: {
    // A confirmer avant la premiere build EAS : il ne pourra plus changer une fois l'app creee sur App Store Connect.
    bundleIdentifier: "io.souki.app",
    // iPhone uniquement : evite les captures iPad obligatoires a la soumission.
    supportsTablet: false,
    infoPlist: {
      // Uniquement HTTPS standard : pas de declaration d'export de chiffrement.
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-font",
    // Ecran de lancement (design system 2027, F5 ter) : sac blanc et feuille verte sur fond transparent,
    // sur le vert du logo. submark.png faisait un carre blanc autour de son disque. L'intro animee
    // (components/launch-intro.tsx) repart de cette image exacte.
    ["expo-splash-screen", { image: "./assets/brand/splash-symbol.png", imageWidth: 160, backgroundColor: "#005B43" }],
    // « Me localiser » de l'inscription et de l'adresse (Expo Go a deja son propre texte).
    [
      "expo-location",
      { locationWhenInUsePermission: "SOUKI utilise votre position pour placer l'adresse de livraison sur la carte (livraison à Fès uniquement)." },
    ],
    // Commande vocale (IA-SOUKI Vocal) : enregistrement de la liste dite en darija ou en francais.
    ["expo-audio", { microphonePermission: "SOUKI utilise le micro pour enregistrer votre liste de courses dictée (commande vocale)." }],
    // Photo de profil (Profil) : photo de la galerie ou prise avec l'appareil.
    [
      "expo-image-picker",
      {
        photosPermission: "SOUKI accède à vos photos pour choisir votre photo de profil.",
        cameraPermission: "SOUKI utilise l'appareil photo pour prendre votre photo de profil.",
      },
    ],
  ],
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL,
    // Rempli par `eas init` (projet EAS de l'equipe SOUKI).
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
  },
})
