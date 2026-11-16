La ligne du panier : photo, nom, prix unitaire, sous-total et sélecteur de quantité.

- Le sous-total (`price-card`, `secondary`) est aligné sur la fin de la ligne ; le prix unitaire en `body-small`.
- **Quantité** : sélecteur `lite` (`secondary-container`), au pas de l'unité du produit (kg, lot, 250 g). Zone de toucher 48 dp. À zéro, la ligne part comme une suppression.
- **Supprimer** : glisser vers le début de la ligne ; au-delà de 110 dp la ligne sort en 160 ms (`ease-emphasized-accelerate`), puis snackbar « Annuler » pendant 10 s. Le fond révélé est `error`, avec l'icône corbeille.
- **Épuisé** : photo grisée, raison en `error`, action « Retirer ». Jamais supprimé en silence.
- TalkBack : « Tomates, 2 kilos, 7 dirhams. Actions : augmenter, diminuer, supprimer. »
- React Native : `Swipeable` de react-native-gesture-handler, ressort `spring-finger` au relâcher.
