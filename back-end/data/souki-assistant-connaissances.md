# Souki — connaissances vérifiées

Souki propose des fruits, légumes et herbes du marché de gros de Fès, à commander dans le catalogue.
Sources : apps/client/app/faq/page.tsx, apps/client/app/layout.tsx.

## Comment ça marche ?
Choisissez vos fruits, légumes et herbes dans le catalogue, ajoutez-les au panier, puis validez votre commande. Souki vous livre à Fès.

## Horaires de livraison
Les commandes et leurs modifications sont ouvertes de 8h à 1h du matin, heure du Maroc. De 1h à 8h, toute validation ou modification de commande est bloquée. Une commande passée entre 8h et minuit est livrée le lendemain ; entre minuit et 1h, elle est livrée le jour même. Les livraisons ont lieu entre 8h et 15h à Fès. La réouverture à 8h concerne la prochaine journée de livraison et ne déverrouille pas les anciennes commandes. Consultez la date et le créneau lors de la validation.

## Frais de livraison
La livraison coûte 15 DH. Elle est offerte dès 300 DH de commande.

## Moyens de paiement
Vous pouvez payer à la livraison ou avec le Wallet Souki. Le paiement par carte CMI est actuellement désactivé dans le checkout.

## C'est quoi le panier malin ?
Le panier malin compose votre marché selon votre budget, le nombre de personnes et la durée. Il privilégie les essentiels et respecte les besoins du foyer. Vous pouvez vérifier et modifier le panier avant de commander.

## Fonctionnalités
Une commande déjà validée peut être modifiée depuis /historique ou /suivi-commande : bouton « Modifier ou annuler », puis aperçu du total et enregistrement. Ajout, retrait de produits et changement des quantités sont possibles avant 1h du matin le jour de sa livraison, uniquement si elle reste EN_ATTENTE ou CONFIRMEE et non affectée à une tournée. La réouverture à 8h ne débloque jamais une commande clôturée. Aucun montant minimum de produits n'est imposé. Le paiement à la livraison est recalculé ; pour le Wallet, seule la différence est débitée ou recréditée lors de l'enregistrement. Les prix des produits conservés restent ceux de la commande. Le mini-agent explique ce parcours mais ne peut pas modifier lui-même une commande.
Le même écran propose « Annuler ma commande » avec confirmation explicite, avant la même clôture et uniquement pour les statuts EN_ATTENTE ou CONFIRMEE sans tournée affectée. Pour le Wallet, l'annulation réussie recrédite le total payé, livraison comprise. Pour le paiement à la livraison non encaissé, rien n'est à payer. La commande reste dans l'historique avec le statut ANNULEE. Après 1h, aucune annulation client, même à la réouverture à 8h. Les autres paiements ou les paiements à la livraison déjà encaissés ne sont pas annulables par ce parcours. Le mini-agent peut expliquer cette règle mais ne peut ni annuler ni effectuer un remboursement lui-même, ni promettre un remboursement en dehors de ce parcours.
La commande vocale aide à composer un panier dans le catalogue (/catalogue). Les favoris (/favoris) retrouvent vos produits préférés. Les abonnements sont présentés dans /abonnements. Le code de parrainage se trouve dans le Wallet (/wallet) et les paramètres du compte. Pour un problème précis, consultez « Suivi de commande » (/suivi-commande) ou votre historique (/historique). Pour les questions générales, consultez /faq. Ne promettez pas de remise, de remboursement ni d'action sur un compte. Aucun canal de support supplémentaire n'est confirmé ici : n'inventez pas d'adresse email ou de numéro de téléphone.

## Sources internes
- Horaires et frais : apps/client/app/faq/page.tsx ; back-end/services/panier_service.py.
- Paiements et disponibilité CMI : apps/client/app/checkout/page.tsx, paymentMethods.
- Panier malin : back-end/services/basket_composer_service.py.
- Pages : apps/client/app/{abonnements,wallet,parametres,favoris,historique,suivi-commande,faq}.

Les prix et disponibilités doivent exclusivement provenir du catalogue joint à chaque requête. Si une information manque, dites-le sans l'inventer.
