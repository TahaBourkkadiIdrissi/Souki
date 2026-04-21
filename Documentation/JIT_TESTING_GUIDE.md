# 🧪 Guide de Test - Système JIT SOUKI

## Test Complet du Système JIT

Ce guide vous permet de tester le système JIT d'agrégation à 20h00.

---

## ✅ Prérequis

1. **Serveur backend lancé**
   ```bash
   cd back-end
   python main.py
   ```

2. **Vérifier le démarrage du log**
   - Console doit afficher:
   ```
   ✅ Scheduler de tâches planifiées démarré
      📅 Job JIT configuré à 20h00 chaque jour
   ```

3. **Au moins 1 commande en BDD**
   - Statut: `en_attente` (créée par checkout) ou `Confirmée`
   - Avec un panier contenant des lignes de produits

---

## 🧪 Test 1: Agrégation Manuelle (DEBUG)

### Objectif
Tester l'agrégation sans attendre 20h00.

### Commande
```bash
curl -X POST http://localhost:8000/api/jit/agreguer
```

### Réponse Attendue
```json
{
  "nombre_commandes": 5,
  "nombre_abonnements": 0,
  "volume_total_kg": 87.5,
  "details_produits": [
    {
      "product_id": 1,
      "nom_fr": "Tomates",
      "nom_darija": "tomato",
      "quantite_brute_kg": 15.0,
      "buffer_perte_10_pct": 1.5,
      "volume_total_kg": 17.0,
      "prix_kg": 2.5,
      "sous_total": 42.5,
      "unite": "kg"
    }
  ],
  "montant_total": 218.75,
  "statut": "succès",
  "message": null
}
```

### Vérifications
- [ ] `nombre_commandes` > 0
- [ ] `volume_total_kg` > 0
- [ ] Tous les produits ont `buffer_perte_10_pct` = `quantite_brute_kg * 0.10`
- [ ] `volume_total_kg` = ceil(`quantite_brute_kg` + `buffer_perte_10_pct`)

---

## 🧪 Test 2: Exécution Complète (JOB FULL)

### Objectif
Tester l'exécution complète du job (agrégation + verrouillage + email + log).

### Commande
```bash
curl -X POST http://localhost:8000/api/jit/executer
```

### Réponse Attendue
```json
{
  "id": 1,
  "date_execution": "2024-04-20T20:00:00.123456",
  "volume_total": 87.5,
  "nombre_commandes": 5,
  "nombre_abonnements": 0,
  "statut": "succès",
  "details_volumes": {
    "produits": [
      {
        "product_id": 1,
        "nom_fr": "Tomates",
        "quantite_brute_kg": 15.0,
        "buffer_10_pct": 1.5,
        "volume_final_kg": 17.0,
        "prix_kg": 2.5,
        "sous_total": 42.5
      }
    ]
  },
  "message_alerte": null
}
```

### Vérifications Complètes

#### A. Réponse API
- [ ] Statut HTTP: 200
- [ ] `statut` = "succès"
- [ ] `id` (log) > 0
- [ ] `date_execution` au format ISO

#### B. Logs Console
```
================================================================================
🚀 Déclenchement du job JIT d'agrégation à ...
================================================================================

✓ Agrégation complète: 5 commandes, 87.5 kg total
✓ Email sent to admin@souki.ma
✓ 5 commandes verrouillées
✓ Log JIT créé (ID: 1)
✅ Job JIT terminé avec succès

================================================================================
```

- [ ] Message "✓ Agrégation complète" affiché
- [ ] Message "✓ Email sent" ou "⚠ Email not sent" affiché
- [ ] Message "✓ X commandes verrouillées" affiché
- [ ] Message "✓ Log JIT créé" affiché

#### C. Changement de Statut des Commandes

Vérifier que les commandes sont verrouillées:

```sql
SELECT id, statut FROM t_commandes WHERE statut = 'Verrouillée';
```

- [ ] Toutes les commandes précédemment `en_attente` ont le nouveau statut `Verrouillée`

#### D. Création du Log

Vérifier le log en BDD:

```sql
SELECT * FROM t_jit_logs ORDER BY date_execution DESC LIMIT 1;
```

- [ ] `volume_total` correspond au total attendu
- [ ] `nombre_commandes` = nombre d'agrégations
- [ ] `statut` = "succès"
- [ ] `details_volumes` est un JSON valide

#### E. Email Reçu (si SMTP configuré)

- [ ] Email reçu dans la boîte du fondateur
- [ ] Sujet: `📋 Liste d'achats SOUKI - Marché de gros`
- [ ] Contenu affiche l'agrégation et les volumes
- [ ] Tous les produits sont listés avec volumes finaux

---

## 🧪 Test 3: Cas Limite - Zéro Commande

### Objectif
Tester le comportement quand aucune commande n'existe.

### Préparation
```sql
UPDATE t_commandes SET statut = 'Livrée' WHERE statut IN ('en_attente', 'Confirmée');
```

### Commande
```bash
curl -X POST http://localhost:8000/api/jit/executer
```

### Réponse Attendue
```json
{
  "id": 2,
  "date_execution": "2024-04-20T20:05:00",
  "volume_total": 0.0,
  "nombre_commandes": 0,
  "nombre_abonnements": 0,
  "statut": "aucune_commande",
  "details_volumes": { ... },
  "message_alerte": "Aucune commande confirmée — annulation de tournée ?"
}
```

### Vérifications
- [ ] `statut` = "aucune_commande"
- [ ] `nombre_commandes` = 0
- [ ] `message_alerte` contient "Aucune commande"
- [ ] Email reçu avec sujet: `🚨 ALERTE: Aucune commande - Annulation de tournée`
- [ ] Email contient le message d'alerte

### Restauration
```sql
UPDATE t_commandes SET statut = 'en_attente' WHERE statut = 'Livrée' LIMIT <nombre>;
```

---

## 🧪 Test 4: Consultation des Logs

### Dernier Log
```bash
curl http://localhost:8000/api/jit/logs/dernier
```

### Logs par Plage de Dates
```bash
curl "http://localhost:8000/api/jit/logs/2024-04-20/2024-04-21"
```

### Réponse
```json
{
  "logs": [
    { "id": 1, "statut": "succès", ... },
    { "id": 2, "statut": "aucune_commande", ... }
  ],
  "nombre": 2
}
```

### Vérifications
- [ ] Tous les logs sont affichés
- [ ] Les dates correspondent à la plage

---

## 🧪 Test 5: Vérification du Scheduler

### Affichage des Jobs Planifiés

Ajouter un endpoint pour afficher les jobs:

```python
@router_jit.get("/scheduler/info")
async def get_scheduler_info():
    from tasks.scheduler import get_scheduler_info
    return get_scheduler_info()
```

### Commande
```bash
curl http://localhost:8000/api/jit/scheduler/info
```

### Réponse Attendue
```json
{
  "scheduler_running": true,
  "jobs": [
    {
      "id": "jit_agregation_20h00",
      "name": "Agrégation JIT des commandes à 20h00",
      "trigger": "cron[hour='20', minute='0', second='0']",
      "next_run_time": "2024-04-20T20:00:00+01:00"
    }
  ]
}
```

### Vérifications
- [ ] `scheduler_running` = true
- [ ] `jobs` list contient le job JIT
- [ ] Trigger est "cron[hour='20', minute='0', second='0']"
- [ ] `next_run_time` est > maintenant

---

## 📊 Test 6: Calcul de Volumes (Mathématiques)

### Scénario de Test

Créer des commandes avec des quantités précises:

```sql
-- Supposons 3 commandes pour Tomates:
-- Commande 1: 5 kg
-- Commande 2: 8 kg
-- Commande 3: 3 kg
-- Total: 16 kg
-- Buffer 10%: 16 × 0.10 = 1.6 kg
-- Avec buffer: 16 + 1.6 = 17.6 kg
-- Volume final (ceil): 18 kg
```

### Vérification
```bash
curl -X POST http://localhost:8000/api/jit/agreguer | jq '.details_produits[0]'
```

### Résultat Attendu
```json
{
  "product_id": 1,
  "quantite_brute_kg": 16.0,
  "buffer_perte_10_pct": 1.6,
  "volume_total_kg": 18.0
}
```

- [ ] `quantite_brute_kg` = 16.0
- [ ] `buffer_perte_10_pct` = 1.6
- [ ] `volume_total_kg` = 18.0 (ceil(17.6))

---

## ⏰ Test 7: Déclenchement Automatique à 20h00

### Objectif
Vérifier que le job s'exécute automatiquement à 20h00.

### Procédure

1. **Démarrer le serveur avant 20h00**
   ```bash
   python main.py
   ```

2. **Attendre 20h00** 

3. **Vérifier les logs console**
   - Le job doit s'exécuter automatiquement
   - Logs d'exécution doivent s'afficher

4. **Consulter la BDD**
   ```sql
   SELECT * FROM t_jit_logs ORDER BY date_execution DESC LIMIT 1;
   ```

5. **Vérifier les statuts**
   ```sql
   SELECT COUNT(*) FROM t_commandes WHERE statut = 'Verrouillée';
   ```

### Résultats Attendus
- [ ] Job s'exécute exactement à 20h00
- [ ] Les logs affichent l'exécution
- [ ] Un nouveau log est créé en BDD
- [ ] Les commandes sont verrouillées
- [ ] Email reçu (si SMTP activé)

---

## 🐛 Débogage

### Activer les Logs Détaillés

Dans `jit_service.py`, vous pouvez ajouter des print() pour déboguer:

```python
print(f"DEBUG: Traitement commande {commande.id}")
print(f"DEBUG: Produits trouvés: {len(volumes_par_produit)}")
```

### Vérifier SMTP

```python
from services.email_delivery_service import EmailDeliveryService

service = EmailDeliveryService()
print(f"SMTP Configured: {service.is_configured()}")
print(f"SMTP Host: {service.smtp_host}")
```

### Query SQL de Diagnostic

```sql
-- Commandes avec statut
SELECT statut, COUNT(*) FROM t_commandes GROUP BY statut;

-- Paniers sans lignes (incohérence)
SELECT p.id FROM t_paniers p LEFT JOIN t_lignes_panier l ON p.id = l.panier_id WHERE l.id IS NULL;

-- Derniers logs
SELECT date_execution, statut, nombre_commandes, volume_total FROM t_jit_logs ORDER BY date_execution DESC LIMIT 10;
```

---

## ✅ Checklist de Validation Finale

- [ ] Test 1: Agrégation manuelle OK
- [ ] Test 2: Exécution complète OK
- [ ] Test 3: Cas zéro commande OK
- [ ] Test 4: Consultation logs OK
- [ ] Test 5: Scheduler info OK
- [ ] Test 6: Calculs mathématiques OK
- [ ] Test 7: Déclenchement automatique OK (après 20h00)
- [ ] Email reçu (si SMTP)
- [ ] Commandes verrouillées
- [ ] Logs persistés en BDD

---

## 🎉 Système Prêt pour Production!

Si tous les tests passent, le système JIT est **opérationnel et prêt** pour être utilisé en production.

### Recommandations
1. Sauvegarder les logs régulièrement
2. Monitorer les emails reçus
3. Vérifier la table `t_jit_logs` chaque jour
4. Ajuster le buffer 10% si nécessaire après quelques jours
