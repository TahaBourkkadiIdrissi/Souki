# Souki — connaissances vérifiées

Souki propose des fruits, légumes et herbes du marché de gros de Fès, à commander dans le catalogue.
Sources : apps/client/app/faq/page.tsx, apps/client/app/layout.tsx.

## Comment ça marche ?
Choisissez vos fruits, légumes et herbes dans le catalogue, ajoutez-les au panier, puis validez votre commande. Souki vous livre à Fès.

## Horaires de livraison
Commandez avant 20h pour une livraison le lendemain entre 8h et 15h à Fès. Consultez les créneaux disponibles lors de la validation.

## Frais de livraison
La livraison coûte 15 DH. Elle est offerte dès 300 DH de commande.

## Moyens de paiement
Vous pouvez payer à la livraison ou avec le Wallet Souki. Le paiement par carte CMI est actuellement désactivé dans le checkout.

## C'est quoi le panier malin ?
Le panier malin compose votre marché selon votre budget, le nombre de personnes et la durée. Il privilégie les essentiels et respecte les besoins du foyer. Vous pouvez vérifier et modifier le panier avant de commander.

## Fonctionnalités
La commande vocale aide à composer un panier dans le catalogue (/catalogue). Les favoris (/favoris) retrouvent vos produits préférés. Les abonnements sont présentés dans /abonnements. Le code de parrainage se trouve dans le Wallet (/wallet) et les paramètres du compte. Pour un problème précis, consultez « Suivi de commande » (/suivi-commande) ou votre historique (/historique). Pour les questions générales, consultez /faq. Ne promettez pas de remise, de remboursement ni d'action sur un compte. Aucun canal de support supplémentaire n'est confirmé ici : n'inventez pas d'adresse email ou de numéro de téléphone.

## Sources internes
- Horaires et frais : apps/client/app/faq/page.tsx ; back-end/services/panier_service.py.
- Paiements et disponibilité CMI : apps/client/app/checkout/page.tsx, paymentMethods.
- Panier malin : back-end/services/basket_composer_service.py.
- Pages : apps/client/app/{abonnements,wallet,parametres,favoris,historique,suivi-commande,faq}.

Les prix et disponibilités doivent exclusivement provenir du catalogue joint à chaque requête. Si une information manque, dites-le sans l'inventer.
