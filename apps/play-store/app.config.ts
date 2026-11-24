import type { ConfigContext, ExpoConfig } from "expo/config"

/**
 * Configuration de l'app Android SOUKI (publication Google Play).
 * Base : l'app iOS (apps/mobile), adaptée au design system Android (apps/play-store/design-system).
 * Plan et règles du Play Store : apps/play-store/PLAN-ANDROID.md.
 *
 * Valeurs fournies par l'environnement (EAS : variables et fichiers secrets), jamais dans le dépôt :
 * - EXPO_PUBLIC_API_BASE_URL : API (défaut : production) ;
 * - EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID : client OAuth « Web » du projet Google SOUKI (connexion Google) ;
 * - GOOGLE_MAPS_ANDROID_API_KEY : clé Google Maps restreinte au paquet io.souki.app ;
 * - GOOGLE_SERVICES_JSON : chemin du google-services.json (notifications push FCM) ;
 * - EAS_PROJECT_ID : projet EAS (défaut : « souki », voir plus bas).
 */
const DEFAULT_API_BASE_URL = "https://souki.io/backend"
const SITE_HOST = "souki.io"
// Projet EAS « souki » (@mekouaro1999) : il porte la clé d'importation Google Play de io.souki.app
// (SHA-256 70:00:62:EA:…:7F:22) et le compteur de versionCode. Un autre projet signerait avec une autre
// clé et Google Play refuserait l'AAB.
const projectId = process.env.EAS_PROJECT_ID || "98d62c63-2d07-4324-a312-10cfa77db35f"

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "SOUKI",
  slug: "souki",
  owner: "mekouaro1999",
  scheme: "souki",
  version: "1.1.1",
  orientation: "portrait",
  icon: "./assets/brand/app-icon-1024.png",
  // Thème sombre dès la v1 (décision 2 du design) : suit le téléphone, réglable dans Compte > Thème.
  userInterfaceStyle: "automatic",
  // Mises à jour JS des builds de test (canal `preview`) ; la version native fixe la compatibilité.
  runtimeVersion: { policy: "appVersion" },
  updates: projectId ? { url: `https://u.expo.dev/${projectId}`, checkAutomatically: "ON_LOAD", fallbackToCacheTimeout: 0 } : { enabled: false },
  android: {
    // Ne peut plus changer une fois l'app créée dans la Play Console (décision D2 : même identifiant que l'iOS).
    package: "io.souki.app",
    // Icône adaptative : sac blanc et feuille sur souki-900, dans la zone de sécurité de 66 dp ;
    // calque monochrome pour les icônes thématiques d'Android 13+.
    adaptiveIcon: {
      foregroundImage: "./assets/brand/android/adaptive-foreground.png",
      monochromeImage: "./assets/brand/android/adaptive-monochrome.png",
      backgroundColor: "#005B43",
    },
    // Retour prédictif (Android 14+, actif par défaut avec l'API 36).
    predictiveBackGestureEnabled: true,
    // Permissions ajoutées par des modules et inutiles ici : refusées à l'examen sans justification.
    // Photos : sélecteur système d'Android, jamais d'accès à toute la galerie. Position : premier plan seulement.
    blockedPermissions: [
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VIDEO",
      "android.permission.READ_MEDIA_AUDIO",
      "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
      "android.permission.ACCESS_BACKGROUND_LOCATION",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_MICROPHONE",
      "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
      "com.google.android.gms.permission.AD_ID",
    ],
    // Liens d'app vérifiés : une fiche produit ou un lien de parrainage s'ouvre dans l'app.
    // souki.io doit servir /.well-known/assetlinks.json avec l'empreinte de la clé de signature Play.
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          { scheme: "https", host: SITE_HOST, pathPrefix: "/produit/" },
          { scheme: "https", host: SITE_HOST, pathPrefix: "/r/" },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON,
    config: process.env.GOOGLE_MAPS_ANDROID_API_KEY ? { googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY } } : undefined,
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    ["expo-secure-store", { faceIDPermission: false }],
    "expo-font",
    // Écran de démarrage Android 12+ : symbole sans fond sur le vert du logo ; l'intro animée repart de cette image.
    ["expo-splash-screen", { image: "./assets/brand/splash-symbol.png", imageWidth: 160, backgroundColor: "#005B43" }],
    // Langue par application (Android 13+) : français et arabe ; interface en miroir en arabe.
    ["expo-localization", { supportedLocales: { android: ["fr", "ar"] } }],
    [
      "expo-location",
      {
        locationWhenInUsePermission: "SOUKI utilise votre position pour placer l'adresse de livraison sur la carte (livraison à Fès uniquement).",
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
      },
    ],
    // Commande vocale : micro au premier plan seulement, pas d'enregistrement en arrière-plan.
    ["expo-audio", { microphonePermission: "SOUKI utilise le micro pour enregistrer votre liste de courses dictée (commande vocale).", recordAudioAndroid: true, enableBackgroundRecording: false }],
    [
      "expo-image-picker",
      {
        photosPermission: "SOUKI accède à la photo que vous choisissez pour votre profil ou pour signaler un produit.",
        cameraPermission: "SOUKI utilise l'appareil photo pour prendre votre photo de profil ou la photo d'un produit que vous signalez.",
        // Même texte que expo-audio : `false` retirerait RECORD_AUDIO de toute l'app (commande vocale).
        microphonePermission: "SOUKI utilise le micro pour enregistrer votre liste de courses dictée (commande vocale).",
      },
    ],
    // Notifications : petite icône monochrome, teinte de la marque, canal « Suivi de commande » par défaut.
    ["expo-notifications", { icon: "./assets/brand/android/notification-icon.png", color: "#005B43", defaultChannel: "commandes" }],
    // Build de production : R8 (code et ressources réduits), API 36 par défaut du SDK 58.
    // R8 retirait le constructeur de WorkDatabase_Impl (WorkManager, instancié par réflexion par Room) :
    // l'app plantait au lancement (versionCode 6, androidx.startup.StartupException). On le garde.
    [
      "expo-build-properties",
      {
        android: {
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          extraProguardRules: [
            "-keep class * extends androidx.room.RoomDatabase { <init>(); }",
            "-keep class androidx.work.impl.WorkDatabase_Impl { <init>(); }",
          ].join("\n"),
        },
      },
    ],
    // Raccourcis de l'icône : Catalogue, Commande vocale, Mes commandes, Wallet.
    "./plugins/with-android-shortcuts",
  ],
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL,
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || null,
    eas: projectId ? { projectId } : undefined,
  },
})
