# Commandes de 08 h à 01 h — référence actuelle

Cette règle remplace les anciens horaires décrits dans les documents JIT et de passation. Fuseau : `Africa/Casablanca`, commun à l’API et au scheduler.

| Heure locale | Validation | Livraison |
| --- | --- | --- |
| 08:00 à 23:59:59 | Ouverte | Le lendemain, 08 h–15 h |
| 00:00 à 00:59:59 | Ouverte | Le jour même, 08 h–15 h |
| 01:00 à 07:59:59 | Bloquée | Aucun nouveau lot accepté |

Les parcours existants de préparation du panier sont conservés. Les commandes validées peuvent aussi être modifiées avant leur clôture, selon le [parcours de modification](modification-commande-avant-cloture.md). Le serveur contrôle l’heure, y compris après acquisition des verrous. La navigation ou une horloge de téléphone incorrecte ne permet pas de valider pendant la fermeture. Les commandes déjà clôturées ne redeviennent pas modifiables à 08 h.

Chaque commande validée porte `date_livraison`, calculée par le serveur. Le créneau horaire reste distinct. Une commande du 9 octobre à 23 h et une du 10 octobre à 00 h 30 appartiennent toutes deux au lot du 10 octobre.

L’admin affiche les livraisons du jour et du lendemain : une commande enregistrée après 08 h reste donc visible immédiatement. Les livreurs reçoivent les tournées du jour. Les confirmations COD restent possibles après affectation, tant que la commande n’est pas en route.

À 01 h, le scheduler agrège ce lot puis lance le dispatch du jour si l’agrégation a réussi. Reprises toutes les cinq minutes jusqu’à 04 h 55 ; un redémarrage entre 01 h et 08 h tente aussi une reprise. Les logs JIT persistants rendent les reprises idempotentes. Un verrou transactionnel PostgreSQL attend la fin des validations déjà acceptées avant de lire le lot. L’alerte COD est à 07 h ; l’admin lit les confirmations en base, indépendamment du processus scheduler.

Le client synchronise son compteur avec `/api/order-schedule`, actualise à la clôture/réouverture et au retour dans l’application. En cas d’indisponibilité réseau, son horloge locale reste un affichage indicatif ; l’API garde la décision finale.

## Déploiement sur le VPS

Après publication de cette branche et récupération du code, depuis `/opt/souki`. Prévoir une sauvegarde de la base. La production désactive les migrations automatiques : **appliquer la migration avant de démarrer le nouveau backend et le scheduler**.

```bash
sudo docker compose --env-file infra/.env.production build backend client admin livreur
sudo docker compose --env-file infra/.env.production stop scheduler backend
sudo docker compose --env-file infra/.env.production run --rm --no-deps backend python -c "from services.order_schedule_schema_sync_service import OrderScheduleSchemaSyncService; OrderScheduleSchemaSyncService.sync()"
sudo docker compose --env-file infra/.env.production up -d backend scheduler client admin livreur
sudo docker compose --env-file infra/.env.production exec nginx nginx -t
sudo docker compose --env-file infra/.env.production exec nginx nginx -s reload
sudo docker compose --env-file infra/.env.production ps
sudo docker compose --env-file infra/.env.production logs --tail=80 backend scheduler
```

Ne poursuivre le démarrage que si la migration réussit. Elle ajoute les dates de livraison et leurs index, conserve la date de tournée des commandes déjà affectées et déduit celle des autres commandes à partir de leur horodatage UTC. Elle ne supprime aucune commande. Les brouillons restent sans date de livraison.

Vérifier ensuite `https://souki.io/backend/api/order-schedule`, la date au checkout et les listes admin/livreur. Le service worker change de version pour renouveler les anciens écrans PWA.

## Validation locale

- Tests horaires : minuit, 00:59, 01:00, 07:59, 08:00, soir et changement d’année.
- Tests de compteurs : fuseaux des appareils et transitions de l’heure marocaine.
- Tests logistiques : visibilité par date de livraison et absence de dispatch si le JIT échoue.
- Suite backend historique : `SOUKI_ENABLE_SUPPLIERS=1 SOUKI_PREORDERS=0` ; les tests du mode Souki surchargent ces réglages pour tester les précommandes.

La migration et le fonctionnement du scheduler contre PostgreSQL doivent encore être vérifiés sur une base de recette avant mise en production ; les tests locaux ne contactent pas la base distante.
