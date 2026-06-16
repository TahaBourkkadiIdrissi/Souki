# SOUKI Mobile

Application Expo / React Native TypeScript integree au monorepo Souki.

## Prerequis

- Node.js et npm
- Expo CLI via `npx expo`
- EAS CLI installe globalement
- Back-end FastAPI Souki lance sur le reseau local
- Compte Expo connecte pour les builds EAS

## Variables d'environnement

Copier `.env.example` vers `.env` puis renseigner :

```bash
EXPO_PUBLIC_API_URL=http://192.168.100.197:8000
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=
MAPBOX_DOWNLOADS_TOKEN=
```

`EXPO_PUBLIC_API_URL` doit utiliser l'IP locale de la machine, pas `localhost`, pour fonctionner depuis un telephone Android.

## Commandes

```bash
npm install
npm run start:go
npm run start
npm run android
npm run typecheck
npm run lint
eas build -p android --profile preview
```

`npm run start` cible le dev client, necessaire pour la fidelite Mapbox native avec `@rnmapbox/maps`.
`npm run start:go` reste disponible, mais Mapbox native demande un development build.

## Architecture

- `app/` : Expo Router, miroir des routes web.
- `src/services/api/` : client FastAPI, memes endpoints que `front-end/lib/api.ts`.
- `src/contexts/AuthContext.tsx` : auth JWT FastAPI avec token stocke dans `expo-secure-store`.
- `src/lib/catalogue.ts` : mapping catalogue et panier inspire du web.
- `src/store/` : etat local Zustand.
- `src/theme/` : tokens visuels convertis depuis `front-end/app/globals.css`.

## Notes

- Le web et le back-end ne doivent pas etre modifies par le mobile.
- Les images utilisent les URLs publiques fournies par le back-end ou les fallbacks web.
- Le build EAS preview produit un APK interne installable.
