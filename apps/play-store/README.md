# @souki/play-store : app Android SOUKI (Expo)

App Android destinée au Google Play Store. Elle part de l'app iOS (`apps/mobile`) et passe
écran par écran au design system Android (`design-system/`, voir `design-system/00-avancement.md`
et `design-system/passation.md`). Même SDK Expo (58), même code partagé (`@souki/shared`).

## Tester sur le téléphone Android (Expo Go)

1. Installer **Expo Go** depuis le Play Store sur le téléphone.
2. À la racine du dépôt (le PC et le téléphone sur le **même Wi-Fi**) :

   ```bash
   pnpm install
   pnpm dev:play-store
   ```

3. Dans Expo Go, toucher **Scan QR code** et scanner le QR code affiché dans le terminal.

Si le Wi-Fi isole les appareils (Wi-Fi d'école, partage de connexion, pare-feu Windows), utiliser le tunnel :

```bash
pnpm --filter @souki/play-store dev:tunnel
```

Chaque modification du code se recharge seule sur le téléphone. Secouer le téléphone ouvre le menu
de développement (recharger, inspecter).

Par défaut l'app appelle l'API de production `https://souki.io/backend`. Pour un back-end local :

```bash
EXPO_PUBLIC_API_BASE_URL=http://<IP-du-PC>:8000 pnpm dev:play-store
```

## Build installable (EAS, dans le cloud)

Pour les modules qui ne sont pas dans Expo Go (connexion Google, notifications push) ou pour
donner un APK à quelqu'un :

```bash
npm install -g eas-cli
eas login
cd apps/play-store
eas init                               # lie le projet Expo (une fois)
eas build -p android --profile preview # APK à installer directement sur le téléphone
eas build -p android --profile production # AAB pour la Play Console
```

## Ce qui diffère de l'app iOS

- **Design Android** (`design-system/`) : Material 3, Instrument Sans + IBM Plex Sans Arabic, thème clair et
  **sombre** (Compte > Thème), barre de navigation M3, bouton vocal flottant. Avancement et décisions : `PLAN-ANDROID.md`.
- **Android** : retours haptiques système, feuille du bas à la place d'`ActionSheetIOS`, partage Android, icône
  adaptative et monochrome, raccourcis de l'icône, liens d'app (`souki.io/produit/…`, `souki.io/r/…`), langue par app.
- **Google Play** : notifications (canaux, demande après la 1re commande), connexion Google (Credential Manager),
  signalement des réponses de l'IA, permissions minimales vérifiées dans le manifeste.

Dans Expo Go, la connexion Google et les notifications push ne sont pas disponibles (modules natifs) : utiliser une
build de développement (`eas build -p android --profile development`).

## Variables de build (EAS, jamais dans le dépôt)

| Variable | Rôle |
|---|---|
| `EAS_PROJECT_ID` | projet EAS (mises à jour JS des builds de test) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | client OAuth « Web » du projet Google SOUKI (bouton Google caché sinon) |
| `GOOGLE_MAPS_ANDROID_API_KEY` | clé Google Maps restreinte à `io.souki.app` |
| `GOOGLE_SERVICES_JSON` | fichier secret Firebase (notifications push) |

## Vérifications

```bash
pnpm --filter @souki/play-store check          # types + thème sombre (aucune couleur figée en clair)
pnpm --filter @souki/play-store doctor         # Expo Doctor
pnpm --filter @souki/play-store export:android # bundle Android de production
pnpm check:boundaries                          # aucun import hors de l'app
```
