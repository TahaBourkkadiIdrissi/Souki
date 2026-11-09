import { Redirect } from "expo-router"

/**
 * Point d'entree « / » (lien souki://) : l'app s'ouvre sur l'onglet Marche.
 * Le catalogue qui etait ici est devenu src/app/(tabs)/(marche)/catalogue.tsx.
 */
export default function Index() {
  return <Redirect href="/marche" />
}
