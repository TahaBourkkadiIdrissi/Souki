La carte de commande résume une commande dans l'historique : numéro, statut, date, photos des produits, nombre de produits, total et une action.

- Le statut est une pastille `tone` : attente (horloge), en route (camion), livrée (coche), incident (alerte). Toujours couleur, icône et texte ensemble, jamais la couleur seule.
- Les libellés et le ton viennent de `packages/shared/src/orders.ts` (`ORDER_STATUS`) : l'interface n'invente pas de statut.
- Une seule action, en lien `secondary` en bas à droite : « Suivre » (en route), « Gérer » (modifiable jusqu'à 01h00), « Recommander » (livrée ou annulée), « Contacter » (incident).
- Photos : au plus quatre, qui se chevauchent de 10 dp, sur `photo-bg`.
- Toute la carte se touche et ouvre le détail ; l'action garde sa propre zone de 48 dp.
- TalkBack : « Commande 1042, en route, livraison aujourd'hui entre 8 h et 15 h, 4 produits, 65 dirhams 50. Suivre. »
