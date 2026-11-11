# @souki/mobile: SOUKI iOS app (Expo)

Expo SDK 58 + expo-router + TypeScript, the SDK supported by the App Store Expo Go.
The iOS build is done in the cloud by EAS: no Mac needed.

## Try it on iPhone (Expo Go)

1. Install **Expo Go** from the App Store on the iPhone.
2. From the repository root, on the same Wi-Fi network as the iPhone:

   ```bash
   pnpm install
   pnpm dev:mobile
   ```

3. Scan the QR code shown in the terminal with the iPhone's **Camera** app,
   then open it in Expo Go. If the Wi-Fi is isolated, use `pnpm --filter @souki/mobile dev -- --tunnel`.

By default the app calls `https://souki.io/backend`. To use a local back end:

```bash
EXPO_PUBLIC_API_BASE_URL=http://<PC-IP>:8000 pnpm dev:mobile
```

(locally, FastAPI listens without the `/backend` prefix that nginx adds in production).

## Development build (EAS, in the cloud)

Expo Go is enough for the catalogue. As soon as a native module outside Expo Go is
needed (Sign in with Apple, push notifications…), you have to install a development build:

```bash
npm install -g eas-cli
eas login
cd apps/mobile
eas init                                   # links the Expo project (once)
eas build -p ios --profile development     # internal build to install on the registered iPhone
pnpm --filter @souki/mobile dev:client     # then start Metro in dev-client mode
```

Profiles (`eas.json`): `development` (dev client, internal), `development-simulator`,
`preview` (internal test build), `production` (App Store, auto-incremented build number).
An iOS build on a real iPhone requires a paid Apple Developer account (99 USD/year).

## Structure

- `src/app/`: routes (expo-router). `index.tsx` redirects to `/marche`.
  - `(tabs)/_layout.tsx`: native iOS tab bar (`NativeTabs`): Marché · Panier · Commandes · Compte.
  - `(tabs)/(marche)/`: home (`marche.tsx`), full catalogue (`catalogue.tsx`), product page.
  - `(tabs)/(panier)/`: cart. `(tabs)/(commandes)/`: placeholder until phase 4.
  - `(tabs)/(compte)/`: iOS Settings-style account screen (`@expo/ui`), favourites.
  - `produit/[slug].tsx` (same URL as the website) exists in the Marché, Panier and Compte stacks and
    re-exports `src/screens/product-detail-screen.tsx`.
- `src/components/`: product card (zoom transition, long-press menu), quantity stepper, cart row
  (swipe to delete), countdown card, native empty states and buttons (`*.ios.tsx` = SwiftUI via `@expo/ui`).
- `src/contexts/`: language (FR default, standard Arabic, RTL), cart and favourites saved on the phone.
- `src/hooks/`: catalogue (React Query, last result kept on the phone), order window countdown.
- `src/lib/api.ts`: API client, JWT sent as `Authorization: Bearer` (no cookie on mobile).
- `src/lib/auth-token.ts`: token stored in the iOS Keychain (`expo-secure-store`);
  `src/lib/local-store.ts`: non-sensitive data in `expo-sqlite/kv-store`.
- `@souki/shared` (`packages/shared`): DTO types, product presentation and quantity steps, order rules
  and cart totals, order window, FR→AR dictionary.

Boundaries: no relative import outside `apps/mobile`; shared code goes through `@souki/shared`.

## Checks

```bash
pnpm --filter @souki/mobile typecheck
pnpm --filter @souki/mobile doctor
```
