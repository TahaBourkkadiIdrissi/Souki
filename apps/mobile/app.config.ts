import type { ConfigContext, ExpoConfig } from "expo/config"

/**
 * Configuration de l'app iOS SOUKI (publication App Store).
 * L'API est celle de production (EXPO_PUBLIC_API_BASE_URL dans eas.json, sinon la valeur ci-dessous).
 */
const DEFAULT_API_BASE_URL = "https://souki.io/backend"

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "SOUKI",
  slug: "souki",
  scheme: "souki",
  // Version vue par les clients sur l'App Store. Le numero de build est gere par EAS (autoIncrement).
  version: "1.0.0",
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
    // Manifeste de confidentialite exige par Apple : raisons d'usage des API sensibles utilisees par
    // React Native et Expo (stockage local, dates de fichiers, temps depuis le demarrage, espace disque).
    // Pas de pistage publicitaire.
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults", NSPrivacyAccessedAPITypeReasons: ["CA92.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp", NSPrivacyAccessedAPITypeReasons: ["C617.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime", NSPrivacyAccessedAPITypeReasons: ["35F9.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace", NSPrivacyAccessedAPITypeReasons: ["E174.1"] },
      ],
    },
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    // Jeton dans le Trousseau, sans Face ID : pas de texte Face ID a declarer.
    ["expo-secure-store", { faceIDPermission: false }],
    "expo-font",
    // Ecran de lancement (design system 2027, F5 ter) : sac blanc et feuille verte sur fond transparent,
    // sur le vert du logo. submark.png faisait un carre blanc autour de son disque. L'intro animee
    // (components/launch-intro.tsx) repart de cette image exacte.
    ["expo-splash-screen", { image: "./assets/brand/splash-symbol.png", imageWidth: 160, backgroundColor: "#005B43" }],
    // « Me localiser » de l'onboarding et de l'adresse de livraison.
    [
      "expo-location",
      {
        locationWhenInUsePermission: "SOUKI utilise votre position pour placer l'adresse de livraison sur la carte (livraison à Fès uniquement).",
        // Seulement pendant l'utilisation : ni position en arriere-plan, ni mouvement, ni precision temporaire.
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        motionUsagePermission: false,
        locationFullAccuracyPermission: false,
      },
    ],
    // Commande vocale (IA-SOUKI Vocal) : enregistrement de la liste dite en darija ou en francais.
    ["expo-audio", { microphonePermission: "SOUKI utilise le micro pour enregistrer votre liste de courses dictée (commande vocale)." }],
    // Photo de profil et photo d'un produit signale (reclamation) : galerie ou appareil photo.
    // Le texte du micro est repris ici pour que ce module ne le remplace pas par un texte generique.
    [
      "expo-image-picker",
      {
        photosPermission: "SOUKI accède à vos photos pour choisir votre photo de profil ou la photo d'un produit que vous signalez.",
        cameraPermission: "SOUKI utilise l'appareil photo pour prendre votre photo de profil ou la photo d'un produit que vous signalez.",
        microphonePermission: "SOUKI utilise le micro pour enregistrer votre liste de courses dictée (commande vocale).",
      },
    ],
  ],
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL,
    // Rempli par `eas init` (projet EAS de l'equipe SOUKI).
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
  },
})
