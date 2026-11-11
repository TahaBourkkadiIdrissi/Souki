# @souki/shared

Shared pure TypeScript code (no React, DOM or React Native), consumed as source:

- `types.ts`: shapes of the public DTOs (copied from `back-end/dto/`).
- `rules.ts`: order rules shown to customers (50 DH minimum, 15 DH delivery / free from 300 DH, 08:00–01:00). The back end stays authoritative.
- `i18n.ts`: FR → AR dictionary keyed by the French sentence, `translate()`, units.
- `catalogue.ts`: product display name (darija in Arabic), price `prix_affiche ?? prix_kg`.

## Boundaries

An app imports this package by its name (`@souki/shared`), never by a relative path
`../../packages/...`: `tools/check-frontend-boundaries.mjs` only allows relative imports inside the app.

## Current consumers

- `apps/mobile` (Metro transpiles TypeScript directly).

`apps/client`, `apps/admin` and `apps/livreur` are not wired to it yet. To do so:
1. add `"@souki/shared": "workspace:*"` to the app's `package.json`;
2. add `transpilePackages: ["@souki/shared"]` to `next.config.mjs`;
3. in the app's `Dockerfile`, copy `packages/shared/package.json` before `pnpm install`
   and `packages/shared/` before `build` (today the image only copies `apps/<app>/`);
4. replace the local copies (`lib/api.ts` types, `FREE_DELIVERY_THRESHOLD`, `ARABIC`…) with imports.
