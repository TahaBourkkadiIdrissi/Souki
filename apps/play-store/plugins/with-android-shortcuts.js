/**
 * Raccourcis de l'icône Android (appui long sur l'icône SOUKI) : Catalogue, Commande vocale,
 * Mes commandes, Wallet (PLAN-ANDROID.md, phase 9 ; design-system P7). Raccourcis statiques :
 * res/xml/shortcuts.xml + <meta-data android.app.shortcuts> sur l'activité principale.
 * Chaque raccourci ouvre un lien `souki://…` géré par Expo Router (mêmes routes que l'app).
 * Libellés en français et en arabe (values / values-ar).
 */
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require("expo/config-plugins")
const fs = require("fs")
const path = require("path")

const SHORTCUTS = [
  { id: "catalogue", path: "produits", icon: "shortcut_catalogue", fr: ["Catalogue", "Voir les produits du jour"], ar: ["المنتجات", "منتجات اليوم"] },
  { id: "voix", path: "commande-vocale", icon: "shortcut_voix", fr: ["Dicter ma liste", "Commande vocale"], ar: ["أملي لائحتي", "الطلب الصوتي"] },
  { id: "commandes", path: "commandes", icon: "shortcut_commandes", fr: ["Mes commandes", "Suivre une livraison"], ar: ["طلباتي", "تتبع التوصيل"] },
  { id: "wallet", path: "wallet", icon: "shortcut_wallet", fr: ["Wallet", "Solde et remboursements"], ar: ["المحفظة", "الرصيد والتعويضات"] },
]

/** Icônes vectorielles 24 dp (tracés Lucide) sur un disque souki-900, comme les icônes adaptatives. */
const ICON_PATHS = {
  shortcut_catalogue: "M3,3h7v7h-7zM14,3h7v7h-7zM14,14h7v7h-7zM3,14h7v7h-7z",
  shortcut_voix: "M12,2a3,3 0,0 0,-3 3v7a3,3 0,0 0,6 0V5a3,3 0,0 0,-3 -3zM19,10v2a7,7 0,0 1,-14 0v-2M12,19v3",
  shortcut_commandes: "M4,2v20l2,-1 2,1 2,-1 2,1 2,-1 2,1 2,-1 2,1V2l-2,1 -2,-1 -2,1 -2,-1 -2,1 -2,-1 -2,1zM16,8H8M16,12H8M13,16H8",
  shortcut_wallet: "M19,7V4a1,1 0,0 0,-1 -1H5a2,2 0,0 0,0 4h15a1,1 0,0 1,1 1v4h-3a2,2 0,0 0,0 4h3a1,1 0,0 0,1 -1v-2a1,1 0,0 0,-1 -1M3,5v14a2,2 0,0 0,2 2h15a1,1 0,0 0,1 -1v-4",
}

function vectorIcon(pathData) {
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Généré par plugins/with-android-shortcuts.js -->
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="48dp" android:height="48dp" android:viewportWidth="48" android:viewportHeight="48">
  <path android:fillColor="#005B43" android:pathData="M24,0a24,24 0,1 1,0 48a24,24 0,1 1,0 -48z"/>
  <group android:translateX="12" android:translateY="12">
    <path android:strokeColor="#FFFFFF" android:strokeWidth="2" android:strokeLineCap="round" android:strokeLineJoin="round" android:fillColor="#00000000" android:pathData="${pathData}"/>
  </group>
</vector>
`
}

function shortcutsXml(packageName, scheme) {
  const items = SHORTCUTS.map(
    (shortcut) => `  <shortcut android:shortcutId="${shortcut.id}" android:enabled="true" android:icon="@drawable/${shortcut.icon}" android:shortcutShortLabel="@string/shortcut_${shortcut.id}_short" android:shortcutLongLabel="@string/shortcut_${shortcut.id}_long">
    <intent android:action="android.intent.action.VIEW" android:targetPackage="${packageName}" android:targetClass="${packageName}.MainActivity" android:data="${scheme}://${shortcut.path}" />
  </shortcut>`,
  ).join("\n")
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Généré par plugins/with-android-shortcuts.js -->
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
${items}
</shortcuts>
`
}

function stringsXml(locale) {
  const rows = SHORTCUTS.flatMap((shortcut) => {
    const [short, long] = shortcut[locale]
    return [`  <string name="shortcut_${shortcut.id}_short">${short}</string>`, `  <string name="shortcut_${shortcut.id}_long">${long}</string>`]
  }).join("\n")
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Généré par plugins/with-android-shortcuts.js -->
<resources>
${rows}
</resources>
`
}

function withShortcutFiles(config) {
  return withDangerousMod(config, [
    "android",
    async (modConfig) => {
      const res = path.join(modConfig.modRequest.platformProjectRoot, "app", "src", "main", "res")
      const packageName = modConfig.android?.package
      const scheme = Array.isArray(modConfig.scheme) ? modConfig.scheme[0] : modConfig.scheme
      if (!packageName || !scheme) throw new Error("with-android-shortcuts : android.package et scheme sont requis.")
      for (const dir of ["xml", "drawable", "values", "values-ar"]) fs.mkdirSync(path.join(res, dir), { recursive: true })
      fs.writeFileSync(path.join(res, "xml", "shortcuts.xml"), shortcutsXml(packageName, scheme))
      for (const [name, data] of Object.entries(ICON_PATHS)) fs.writeFileSync(path.join(res, "drawable", `${name}.xml`), vectorIcon(data))
      fs.writeFileSync(path.join(res, "values", "shortcuts_strings.xml"), stringsXml("fr"))
      fs.writeFileSync(path.join(res, "values-ar", "shortcuts_strings.xml"), stringsXml("ar"))
      return modConfig
    },
  ])
}

function withShortcutMetadata(config) {
  return withAndroidManifest(config, (modConfig) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(modConfig.modResults)
    activity["meta-data"] = (activity["meta-data"] ?? []).filter((item) => item.$["android:name"] !== "android.app.shortcuts")
    activity["meta-data"].push({ $: { "android:name": "android.app.shortcuts", "android:resource": "@xml/shortcuts" } })
    return modConfig
  })
}

module.exports = function withAndroidShortcuts(config) {
  return withShortcutMetadata(withShortcutFiles(config))
}
