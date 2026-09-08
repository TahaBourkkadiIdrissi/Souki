import { defineConfig, globalIgnores } from "eslint/config"
import coreWebVitals from "eslint-config-next/core-web-vitals"

// Lint obligatoire dans la CI (BUG-006). Base : regles Next.js core-web-vitals.
//
// Baseline temporaire : les regles ci-dessous remontent ~150 occurrences
// historiques (apostrophes JSX, patterns d'effets React anterieurs au plugin
// react-hooks v7). Elles sont retrogradees en "warn" pour que le gate lint soit
// activable immediatement sans reecrire l'existant ; toute nouvelle erreur sur
// les autres regles bloque la CI. A resorber progressivement puis repasser en
// "error".
export default defineConfig([
  globalIgnores([".next/**", "node_modules/**", "public/**", "next-env.d.ts"]),
  coreWebVitals,
  {
    rules: {
      "react/no-unescaped-entities": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
    },
  },
])
