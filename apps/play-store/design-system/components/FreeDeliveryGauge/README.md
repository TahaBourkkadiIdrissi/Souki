Indique ce qui manque pour commander et pour la livraison offerte. Les montants viennent de `cartTotals()` (`@souki/shared`), jamais d'un calcul local.

- **Sous le minimum** : bandeau `warning-container`, et le bouton « Valider la commande » est inactif. La raison est toujours écrite.
- **Jauge** : piste `motion-track`, remplissage `motion` ; elle grandit en 300 ms (`ease-souki-out`) à chaque ajout.
- **Offerte** : coche, texte « Livraison offerte » ; la ligne « Livraison » du récapitulatif devient « Offerte ».
- Pas de confettis, pas de son : un seul changement d'état, calme.
- TalkBack : la jauge est annoncée par son texte, pas par un pourcentage.
