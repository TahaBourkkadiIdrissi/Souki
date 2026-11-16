Les quatre étapes d'une commande (`ORDER_STEPS` de `@souki/shared`) reliées par le « S » de la marque.

- Étape faite : point `motion` plein. Étape en cours : anneau `motion`. À venir : `surface-container-highest`. Incident : point `error` et icône d'alerte, avec le texte de `orders.ts`.
- Le chemin se remplit en 600 ms (`ease-souki-out`) quand le statut change ; le point du nouvel état fait un rebond unique.
- Statut toujours dit en texte, jamais par la couleur seule.
- En arabe, le chemin est en miroir ; c'est le seul tracé de marque qui se retourne.
- React Native : `react-native-svg`, `strokeDashoffset` animé par Reanimated.
