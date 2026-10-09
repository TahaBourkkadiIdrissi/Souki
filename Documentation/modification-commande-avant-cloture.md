# Modifier une commande avant sa clôture

Branche : `changement_horraire`. Cette fonctionnalité complète le changement d’horaires et remplace la décision initiale limitée au panier avant validation.

## Parcours client

Depuis **Mes commandes / Historique** ou **Suivi de commande**, le bouton **Modifier ma commande** ouvre `/commandes/{id}/modifier`. Il permet d’ajouter, retirer et ajuster les quantités. L’écran ne modifie pas le panier courant de l’utilisateur.

Le client demande un aperçu au serveur, vérifie les produits, frais de livraison, nouveau total et différence Wallet, puis clique sur **Enregistrer les modifications**. Revenir à l’historique sans enregistrer abandonne les changements. Le numéro, le panier associé, la date de livraison, le créneau et le mode de paiement sont conservés. L’historique et une notification confirment la modification.

## Règles serveur

- Propriétaire authentifié avec permission existante `checkout.create` ; une commande tierce renvoie 404.
- Statuts autorisés : `EN_ATTENTE` et `CONFIRMEE`, sans tournée affectée.
- Date limite : 01 h le jour de **la livraison de cette commande**, fuseau `Africa/Casablanca`. La réouverture à 08 h ne débloque jamais une ancienne commande. La fermeture générale 01 h–08 h s’applique aussi.
- Recontrôle après acquisition des verrous, y compris après attente sur un produit ou le Wallet.
- Aucun montant minimum de produits, comme lors de la création de commande. Au moins un produit avec une quantité positive reste obligatoire. Frais de livraison recalculés avec les constantes existantes (15 DH, offerts dès 300 DH).
- Prix convenu conservé pour les produits déjà présents ; prix catalogue serveur pour les nouveaux produits. Un total différent de l’aperçu doit être confirmé à nouveau.
- Mode précommande : pas de décrément de stock. Mode stock : réservation/libération de la différence sous verrou produit, dans l’ordre des identifiants.
- COD : montant à encaisser mis à jour. Une commande déjà encaissée ou un client blacklisté ne peut pas modifier une commande COD.
- Wallet : débit ou crédit de la différence uniquement ; mouvement `DEBIT_MODIFICATION` ou `CREDIT_MODIFICATION` dans le registre existant. Solde insuffisant : aucune modification, aucun débit.
- CMI et modes non pris en charge : refus explicite ; pas de remboursement bancaire simulé. CMI reste désactivé dans le checkout existant.

## Transactions et concurrence

L’édition prend le même verrou partagé de lot que le checkout. Le JIT prend son pendant exclusif : il attend les éditions acceptées avant de lire les quantités. L’édition verrouille ensuite la commande, les produits dans l’ordre, puis le Wallet si nécessaire.

`status_version` existant sert également à détecter un formulaire périmé : deux onglets ou une répétition du même enregistrement ne peuvent pas écraser silencieusement les quantités ni doubler le débit. Un conflit impose de recharger. Un échec après débit provoque le rollback de la commande, du stock, du Wallet et de sa transaction. Un aperçu ne fait aucune écriture.

## Architecture et fichiers

| Fichier | Rôle / changement |
| --- | --- |
| `back-end/controllers/order_edit_controller.py` | 3 routes ; authentification, création/injection/fermeture de session, délégation au service |
| `back-end/services/order_edit_service.py` | Éligibilité, calcul serveur, concurrence, paiement, notification, transaction |
| `back-end/dao/order_edit_dao.py` | Lecture du propriétaire, verrous commande/Wallet, remplacement des lignes en conservant les IDs présents, écriture Wallet |
| `back-end/interfaces/order_edit_service_interface.py` | Contrat ABC lecture / aperçu / enregistrement |
| `back-end/interfaces/order_edit_dao_interface.py` | Contrat ABC des accès aux données |
| `back-end/dto/order_edit_dto.py` | DTO bornés, quantités finies positives, unicité des produits, version et total attendus |
| `back-end/main.py` | Enregistrement du router |
| `back-end/services/notification_catalog.py` | Événement `ORDER_UPDATED` |
| `apps/client/lib/api.ts` | Types et 3 fonctions API via `apiCall` |
| `apps/client/app/commandes/[id]/modifier/page.tsx` | Page App Router, params asynchrones |
| `apps/client/components/souki/order-editor.tsx` | Formulaire, aperçu serveur, ajustement Wallet, expiration, confirmation |
| `apps/client/components/souki/order-edit-link.tsx` | Accès aux commandes éligibles, heure synchronisée avec le serveur |
| `apps/client/app/historique/page.tsx` | Bouton, message de réussite, rechargement après modification |
| `apps/client/app/suivi-commande/page.tsx` | Bouton depuis le suivi |
| `apps/client/components/souki/pwa-install-prompt.tsx` | Pas de bannière superposée au formulaire d’édition |
| `apps/client/components/souki/pwa-nav-shell.tsx` | L’éditeur conserve sa navigation de retour dédiée |
| `apps/client/app/faq/page.tsx` | Explication du parcours client |
| `back-end/data/souki-assistant-connaissances.md` | Mini-agent informé de la règle et de ses limites |
| `apps/client/public/sw.js` | Version de cache PWA renouvelée |
| `back-end/tests/test_order_edit.py` | Tests service + DAO sur SQLite en mémoire, auth HTTP et validation DTO |
| `tools/order-edit-runtime-check.mjs` | Parcours mobile isolé avec API fictive, aucune base distante |

Les nouveaux fichiers isolent cette fonctionnalité sans refondre le checkout existant ni ses parcours manuel, vocal ou IA. Aucune table, entité ni dépendance ajoutée ou modifiée. Aucun fichier existant supprimé.

## Check flush/commit

| Fichier | flush | commit / rollback | LocalSession | SQL |
| --- | --- | --- | --- | --- |
| `order_edit_dao.py` | Oui | Aucun | Aucun | Dans le DAO |
| `order_edit_service.py` | Aucun | Commit final / rollback en cas d’erreur ; rollback d’aperçu pour libérer les verrous | Aucun | Aucune requête |
| `order_edit_controller.py` | Aucun | Aucun | Session créée ici, injectée au service | Aucune requête |

Les anciens services ne sont pas refactorisés. `CheckoutDaoBD` est réutilisé pour les verrous de lot et la lecture des produits. Les deux nouvelles classes métier implémentent leurs interfaces ABC.

## Vérification et déploiement

- 355 tests backend et 43 sous-cas passent, dont 27 tests nouveaux : limites horaires, ancien lot à 08 h, statuts, propriétaire, doublons, aperçu sans écriture, prix, stock, Wallet débit/crédit, rollback, versions concurrentes et authentification.
- Vérification TypeScript du client sans erreur.
- Contrôle visuel mobile : `outputs/order-edit/mobile.png` (artefact local non versionné).
- Test navigateur réussi : ajout/retrait, aperçu serveur, affichage débit/crédit Wallet, enregistrement, lien depuis l’historique et blocage automatique à 01 h.
- Les tests SQLite vérifient les écritures et les rollback mais ne simulent pas les verrous PostgreSQL concurrents : un test de recette sur PostgreSQL reste recommandé.

**Aucune migration SQL supplémentaire pour cet ajout.** La migration des dates de livraison du changement d’horaires doit déjà être appliquée. Le champ `status_version` et les tables Wallet font partie du schéma existant.

Après publication et récupération du code sur le VPS : reconstruire `backend` et `client`, recréer aussi `scheduler` puisqu’il partage l’image backend, puis recharger Nginx. Aucun déploiement automatique n’a été effectué.
