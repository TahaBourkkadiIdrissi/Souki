Le statut d'une commande, toujours dit trois fois : couleur, icône, texte.

| Ton | Fond | Statuts |
|---|---|---|
| attente | `surface-container-high` | Brouillon, En attente, Confirmée, En préparation, En attente livreur, Réassignation en cours |
| en route | `secondary-container` | Prête à livrer, Planifiée, En route |
| livrée | `primary` | Livrée |
| incident | `error-container` | Retour au dépôt, Destinataire absent, Livraison refusée, Annulée |

Les quatre étapes (Commande confirmée, Préparation, En livraison, Livrée) utilisent `motion` pour le chemin parcouru. Sur l'écran de suivi, ce chemin suit le « S » du logo.
