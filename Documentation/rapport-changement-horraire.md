# Rapport : changement_horraire

> Complément ultérieur : la modification des commandes déjà validées a depuis été autorisée et implémentée. Voir [le rapport de cette fonctionnalité](modification-commande-avant-cloture.md). La restriction décrite ci-dessous correspond à la décision initiale.

Implementation locale : ouverture 08 h, cloture 01 h, heure du Maroc. La modification du panier avant validation est conservee ; aucune nouvelle fonction de modification des commandes deja validees, selon la precision de l'utilisateur.

La [reference fonctionnelle et procedure VPS](changement-horraire.md) decrit les dates de livraison et la migration. Aucun deploiement, push ou acces a la base distante n'a ete effectue.

## Verifications

- Backend : 328 tests et 43 sous-cas passent, avec fournisseurs actifs et stock classique pour la suite historique ; les tests du mode Souki couvrent aussi les precommandes.
- Client : 11 tests de fiabilite passent (minuit, cloture, reouverture, fuseaux et correction de l'horloge par le serveur).
- TypeScript : client, admin et livreur sans erreur.
- Compilation Python et git diff --check verifies.
- Base PostgreSQL / migration : execution sur recette encore necessaire. Le test de selection des lots utilise une base SQLite locale en memoire ; les tests ne prouvent pas la concurrence PostgreSQL en conditions reelles.

## Check flush/commit

| Fichier | Role | flush | commit / rollback | Sessions | Resultat |
| --- | --- | --- | --- | --- | --- |
| checkout_dao.py | DAO | Oui | Aucun | Injectees | Conforme |
| commande_dao.py | DAO | Oui | Aucun | Injectees | Conforme |
| jit_dao.py | DAO | Oui | Aucun | Injectees | Conforme |
| livreur_dao.py | DAO | Oui | Aucun | Injectees | Conforme |
| checkout_service.py | Service | Aucun nouveau | Transaction existante | LocalSession preexistant | Conserve |
| jit_service.py | Service | Preexistants | Commit du lot ou rollback | LocalSession preexistants | Pas de refonte hors perimetre |
| dispatch_service.py | Service | Aucun nouveau | Contextes transactionnels existants | LocalSession preexistant | Conserve |
| fournisseur_service.py | Service | Aucun nouveau | Transactions existantes | LocalSession preexistant | Conserve |
| livreur_service.py | Service | Preexistants | Transactions existantes | LocalSession preexistant | Conserve |
| cod_confirmation_service.py | Service | Aucun nouveau | Transactions existantes | LocalSession preexistant | Conserve |
| admin_exception_service.py | Service | Aucun nouveau | Commit / rollback existants | Injectee | Conserve |
| order_schedule.py / logistics_visibility.py | Fonctions metier | Sans objet | Sans objet | Aucune | Conforme |
| order_schedule_schema_sync_service.py | Migration technique | Sans objet | engine.begin atomique | Connexion technique | Pattern schema sync existant |
| scheduler_service.py | Orchestration | Aucun | Delegue aux services | Sessions existantes | Conserve |

Les anciennes creations de LocalSession et les flush dans certains services sont conserves, sans refonte de l'architecture historique. Les nouveaux acces aux verrous et logs passent par les DAOs et leurs interfaces. Les nouveaux calculs d'alerte sont dans le service, pas dans le controller.

## Fichiers crees

Les nouveaux fichiers sont necessaires pour centraliser les regles horaires, synchroniser le client avec le serveur, afficher la date de livraison, ajouter les colonnes/index et tester les limites horaires.

- `Documentation/changement-horraire.md` : 45 lignes.
- `apps/client/components/souki/delivery-promise.tsx` : 11 lignes.
- `apps/client/lib/order-schedule-client.ts` : 43 lignes.
- `back-end/services/order_schedule.py` : 49 lignes.
- `back-end/services/order_schedule_schema_sync_service.py` : 14 lignes.
- `back-end/sql/2026-10-09_order_delivery_date.sql` : 14 lignes.
- `back-end/tests/test_order_schedule.py` : 136 lignes.

## Fichiers modifies

Les lignes indiquent le debut des blocs modifies dans le diff. Les documents anciens renvoient vers la nouvelle reference, sans reecriture de leur historique.

| Fichier | Lignes | Changement |
| --- | --- | --- |
| `.gitignore` | 118 | Date de livraison et migration versionnee |
| `Documentation/AUDIT_CORRECTIFS_METIER.md` | 1 | Reference horaire actualisee |
| `Documentation/CHECKLIST_LOGISTIQUE_FOURNISSEUR.md` | 1 | Reference horaire actualisee |
| `Documentation/COMPREHENSIVE_ARCHITECTURE_DOCUMENT.md` | 1 | Reference horaire actualisee |
| `Documentation/IA-APP-REF.md` | 1 | Reference horaire actualisee |
| `Documentation/IMPLEMENTATION_JIT.md` | 1 | Reference horaire actualisee |
| `Documentation/INSTRUCTIONS_AGENT_LOGISTIQUE_FOURNISSEUR.md` | 1 | Reference horaire actualisee |
| `Documentation/JIT_AGGREGATION_SYSTEM.md` | 1 | Reference horaire actualisee |
| `Documentation/JIT_TESTING_GUIDE.md` | 1 | Reference horaire actualisee |
| `Documentation/PROJECT_HANDOFF.md` | 1 | Reference horaire actualisee |
| `Documentation/checklist_correctifs_souki.md` | 1 | Reference horaire actualisee |
| `Documentation/regles.md` | 265, 295 | Reference horaire actualisee |
| `Documentation/scheduler-heure-marocaine.md` | 1 | Reference horaire actualisee |
| `apps/admin/app/admin/orders/page.tsx` | 366, 872, 1652, 1812, 2079, 2397, 2557 | Horaires, dates affichees et contrats API |
| `apps/admin/lib/api.ts` | 54, 293, 343, 900 | Horaires, dates affichees et contrats API |
| `apps/client/app/a-propos/page.tsx` | 31 | Horaires, dates affichees et contrats API |
| `apps/client/app/catalogue/catalogue-client.tsx` | 3, 311, 319, 1238, 1243, 1424, 2387 | Horaires, dates affichees et contrats API |
| `apps/client/app/catalogue/page.tsx` | 12 | Horaires, dates affichees et contrats API |
| `apps/client/app/checkout/page.tsx` | 3, 155, 172, 607, 688, 1012, 1061 | Horaires, dates affichees et contrats API |
| `apps/client/app/faq/page.tsx` | 20 | Horaires, dates affichees et contrats API |
| `apps/client/app/historique/page.tsx` | 3, 294 | Horaires, dates affichees et contrats API |
| `apps/client/app/home-client.tsx` | 74, 81, 196, 203, 304, 748, 761 | Horaires, dates affichees et contrats API |
| `apps/client/app/layout.tsx` | 49, 54 | Horaires, dates affichees et contrats API |
| `apps/client/app/onboarding/page.tsx` | 30 | Horaires, dates affichees et contrats API |
| `apps/client/app/page.tsx` | 9 | Horaires, dates affichees et contrats API |
| `apps/client/app/pwa-welcome/page.tsx` | 3, 421, 494, 606 | Horaires, dates affichees et contrats API |
| `apps/client/app/suivi-commande/page.tsx` | 3, 133 | Horaires, dates affichees et contrats API |
| `apps/client/components/souki/market-clock.tsx` | 6, 22 | Horaires, dates affichees et contrats API |
| `apps/client/hooks/useOrderCountdown.ts` | 5, 15, 25 | Horaires, dates affichees et contrats API |
| `apps/client/hooks/useOrderLock.ts` | 6, 10, 17, 28, 33 | Horaires, dates affichees et contrats API |
| `apps/client/lib/api.ts` | 5, 65 | Horaires, dates affichees et contrats API |
| `apps/client/lib/catalogue.ts` | 313 | Horaires, dates affichees et contrats API |
| `apps/client/lib/order-hours.ts` | 3, 26, 28, 39 | Horaires, dates affichees et contrats API |
| `apps/client/public/sw.js` | 2 | Horaires, dates affichees et contrats API |
| `apps/livreur/app/livreur/page.tsx` | 521 | Horaires, dates affichees et contrats API |
| `apps/livreur/lib/api.ts` | 47 | Horaires, dates affichees et contrats API |
| `back-end/controllers/checkout_controller.py` | 7, 14 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/controllers/commande_controller.py` | 31, 267, 271, 273 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/dao/checkout_dao.py` | 2, 18, 142, 154 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/dao/commande_dao.py` | 4, 117, 167, 271, 433, 461, 558, 575, 600 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/dao/jit_dao.py` | 4, 17, 71, 159, 166 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/dao/livreur_dao.py` | 103 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/data/souki-assistant-connaissances.md` | 10 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/dto/checkout_dto.py` | 2, 50 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/dto/commande_dto.py` | 1, 101, 146, 157 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/dto/livreur_dto.py` | 1, 27 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/dto/supplier_dto.py` | 1, 139 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/entities/commande_entity.py` | 1, 19 | Date de livraison et migration versionnee |
| `back-end/entities/jit_log_entity.py` | 1, 10 | Date de livraison et migration versionnee |
| `back-end/interfaces/checkout_dao_interface.py` | 3, 16, 78 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/interfaces/cod_confirmation_service_interface.py` | 14 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/interfaces/commande_dao_interface.py` | 2, 73 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/interfaces/jit_dao_interface.py` | 10 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/main.py` | 57, 130 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/scripts/run_scheduler.py` | 11, 18 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/services/admin_exception_service.py` | 2, 22, 42, 199 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/services/assistant_service.py` | 7, 32 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/services/checkout_service.py` | 19, 28, 31, 45, 89, 242, 253, 269 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/services/cod_confirmation_service.py` | 77, 85, 198, 201 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/services/commande_state_machine.py` | 60, 105 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/services/dispatch_service.py` | 111, 296, 797 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/services/fournisseur_service.py` | 400, 429 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/services/jit_service.py` | 22, 45, 54, 68, 135, 381, 425, 444, 489, 492, 566, 568, 613, 616, 665, 705 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/services/livreur_service.py` | 684, 719 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/services/logistics_visibility.py` | 25 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/services/notification_catalog.py` | 89, 93 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/services/notification_jit_service.py` | 4, 23 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/services/scheduler_service.py` | 93, 111, 122, 128, 136, 151, 169, 185, 191, 217 | Regles serveur, contrats ou traitement du lot de livraison |
| `back-end/tests/test_admin_backlog_exceptions.py` | 23 | Tests et fixtures des horaires et lots |
| `back-end/tests/test_cloisonnement.py` | 39, 57 | Tests et fixtures des horaires et lots |
| `back-end/tests/test_e2e_logistique.py` | 86 | Tests et fixtures des horaires et lots |
| `back-end/tests/test_morocco_timezone.py` | 30, 32, 36, 38 | Tests et fixtures des horaires et lots |
| `back-end/tests/test_security_checkout_stock.py` | 30, 91, 188, 205 | Tests et fixtures des horaires et lots |
| `back-end/tests/test_supplier_stats_today.py` | 27, 35, 43, 51 | Tests et fixtures des horaires et lots |
| `tools/client-reliability.test.cjs` | 17, 54, 72, 162, 179 | Tests et fixtures des horaires et lots |

## Perimetre

Aucun fichier existant supprime. Les configurations nginx, domaines, Docker Compose, secrets et dependances ne sont pas modifies. Les scripts temporaires de travail ont ete retires. Les fichiers non listes ne sont pas touches.
