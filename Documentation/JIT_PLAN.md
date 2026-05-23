# Plan complet — Système JIT (Just-In-Time)

## 1. Objectif
- Agréger les commandes du jour, calculer les volumes d'achat (buffer 10% + arrondi), verrouiller les commandes pour préparation d'achat/tournée, persister un log JIT et permettre déverrouillage si besoin.

## 2. Tables / entités utilisées
- **t_commandes** (Commande)
  - Champs pertinents : `id`, `panier_id`, `statut`, `date_commande`, `montant_total`, `livreur_id`, `tournee_id`.
- **t_paniers** (Panier)
  - Relation : `lignes` -> `t_lignes_panier`.
- **t_lignes_panier** (LignePanier)
  - Champs : `produit_id`, `quantite_kg`, `sous_total`.
- **T_Product** (Product)
  - Champs : `id`, `nom_fr`, `nom_darija`, `prix_kg`, `prix_gros_saisi`, `prix_affiche`, `unite`.
- **t_jit_logs** (JITLog)
  - Champs : `id`, `date_execution`, `volume_total`, `nombre_commandes`, `nombre_abonnements`, `statut`, `details_volumes` (JSON), `message_alerte`.
- **t_abonnements** (Abonnement)
  - Champs : `id`, `actif`, `poids_garanti`, `frequence` (contribution abonnements à définir).

## 3. Fichiers impliqués (code)
- Service principal : `back-end/services/jit_service.py` — logique d'agrégation, verrouillage/déverrouillage, exécution. ([back-end/services/jit_service.py](back-end/services/jit_service.py#L1-L400))
- Controller / API : `back-end/controllers/jit_controller.py` — endpoints `/api/jit/*`. ([back-end/controllers/jit_controller.py](back-end/controllers/jit_controller.py#L1-L300))
- DAO logs : `back-end/dao/jit_dao.py` — création et lecture de `t_jit_logs`. ([back-end/dao/jit_dao.py](back-end/dao/jit_dao.py#L1-L400))
- Interface DAO : `back-end/interfaces/jit_dao_interface.py`.
- DTOs : `back-end/dto/jit_dto.py` — `DetailProduitJIT`, `ResultatAgregationJIT`, `JITLogDTO`.
- Entités : `back-end/entities/commande_entity.py`, `panier_entity.py`, `ligne_panier_entity.py`, `product_entity.py`, `abonnement_entity.py`, `jit_log_entity.py`.
- Machine d'état commandes : `back-end/services/commande_state_machine.py` — `changer_statut()` utilisé pour verrouiller/déverrouiller.
- Tests & docs utiles : `back-end/test_api.http`, `JIT_IMPROVEMENTS_TODO.txt`, `Documentation/JIT_AGGREGATION_SYSTEM.md`.

## 4. Flux opérationnel (détail étape par étape)
1. Vérifier préconditions : s'assurer qu'aucune commande n'est déjà `VERROUILLEE` aujourd'hui (anti-double exécution).
2. Agrégation (`agreger_commandes`)
   - Sélection : commandes du jour où `statut` in (`EN_ATTENTE`, `CONFIRMEE`).
   - Pour chaque commande : charger `Panier` → parcourir `lignes` → cumuler `quantite_kg` par produit.
   - Appliquer buffer perte (10%) : `buffer = quantite_brute * 0.10`.
   - Arrondir à la caisse entière supérieure : `volume_final = ceil(quantite_brute + buffer)`.
   - Calculs : sous‑total CA, coût achat estimé, marge estimée.
   - Résultat : `ResultatAgregationJIT` (détails produits + métriques).
3. Verrouillage (`verrouiller_commandes`)
   - Pour chaque commande agrégée : si `EN_ATTENTE` → `CONFIRMEE` (raison `JIT_CONFIRMATION`), puis `VERROUILLEE` (raison `JIT_LOCK`) via `changer_statut()`.
4. Persistance log
   - Préparer `details_volumes` (JSON) et appeler `jit_dao.create_log(...)` pour insérer dans `t_jit_logs`.
   - Commit transaction.
5. Post‑actions possibles (non obligatoires)
   - Envoi email / notification clients / fournisseurs.
   - Publication d'un flag `jit_running` (Redis) pour éviter exécutions concurrentes.

## 5. Statuts & règles de transition
- Statuts JIT : `EN_ATTENTE`, `CONFIRMEE`, `VERROUILLEE`.
- Transition spéciale : `VERROUILLEE` → `CONFIRMEE` autorisée uniquement si `reason == 'JIT_UNLOCK'`.
- Toute transition non autorisée lève `CommandeTransitionError` (machine d'état).

## 6. Erreurs & transactions
- `executer_job_jit()` : vérifie double exécution, effectue agrégation, verrouillage, crée log et commit.
- En cas d'erreur : rollback de la session principale, tentative d'écrire un log d'erreur sur une `LocalSession()` séparée.
- `JITDaoBD.create_log()` ne commit pas la transaction — le service gère `commit()`/`rollback()`.

## 7. Points d'amélioration recommandés
- Ajouter `check_jit_running()` + verrou distribué (Redis lock) pour éviter les conditions de course.
- Implémenter la contribution réelle des `Abonnement` (poids garanti) dans l'agrégation.
- Ajouter tests unitaires et d'intégration pour : agrégation, verrouillage, double-execution, déverrouillage.
- Ajouter endpoint/UI Admin : bouton "Lancer JIT maintenant" + preview liste d'achats avant commit.
- Limiter taille des `details_volumes` ou externaliser (S3) si logs deviennent volumineux.

## 8. Endpoints API (résumé)
- `POST /api/jit/agreguer` → test d'agrégation (admin only).
- `POST /api/jit/executer` → exécution complète (agrég, verrouillage, log) (admin only).
- `POST /api/jit/deverrouiller` → déverrouille commandes verrouillées aujourd'hui (admin only).
- `GET /api/jit/logs/dernier` → dernier log JIT.
- `GET /api/jit/logs/{date_debut}/{date_fin}` → logs sur plage de dates.

## 9. Annexes & références
- Voir implémentations :
  - `back-end/services/jit_service.py` — code principal.
  - `back-end/dao/jit_dao.py` — persistance logs.
  - `back-end/controllers/jit_controller.py` — endpoints.
  - `back-end/services/commande_state_machine.py` — `changer_statut()`.
- TODOs et améliorations : `JIT_IMPROVEMENTS_TODO.txt`.

---

_Fichier généré automatiquement — contacter l'équipe produit pour valider règles métier (prix d'achat, contribution abonnements, fréquence scheduler)._ 
