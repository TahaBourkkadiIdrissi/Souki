# Résumé des Changements API - Manuel Checkout Integration

## Nouveaux Endpoints

### 1. POST /api/manual-basket
**Endpoint pour créer un panier brouillon à partir d'items manuels**

**Authentification**: ✓ Requise (JWT)

**Request Body**:
```json
{
  "items": [
    {
      "product_id": 1,
      "quantity": 2.5
    },
    {
      "product_id": 3,
      "quantity": 1.0
    }
  ]
}
```

**Response (200 OK)**:
```json
{
  "status": "success",
  "panier_id": 42,
  "lignes_panier": [
    {
      "product_id": 1,
      "nom_produit": "Tomates",
      "quantite_kg": 2.5,
      "prix_unitaire": 7.0,
      "sous_total": 17.5,
      "unite": "kg",
      "image": "https://..."
    }
  ],
  "total_dh": 17.5,
  "nombre_articles": 1,
  "frais_livraison": 10.0
}
```

**Response Errors**:
- `400` : "Le panier ne peut pas être vide."
- `400` : "Un ou plusieurs produits du panier sont introuvables."
- `400` : "Stock insuffisant pour {nom}. Disponible: X kg."
- `400` : "Chaque ligne du panier doit avoir une quantité positive."

**Cas d'Usage**:
```javascript
// Frontend (React)
const response = await submitManualBasket(cart);
router.push(`/checkout?panier_id=${response.panier_id}`);
```

---

### 2. GET /api/paniers/{panier_id}
**Endpoint pour récupérer les détails d'un panier brouillon avant checkout**

**Authentification**: ✗ Optionnelle (pas d'utilisateur requis)

**Parameters**:
- `panier_id` (path): ID du panier

**Response (200 OK)**:
```json
{
  "panier_id": 42,
  "lignes": [
    {
      "product_id": 1,
      "nom_produit": "Tomates",
      "quantite_kg": 2.5,
      "prix_unitaire": 7.0,
      "sous_total": 17.5,
      "unite": "kg",
      "image": "https://..."
    }
  ],
  "total_legumes": 2.5,
  "sous_total": 17.5,
  "frais_livraison": 10.0,
  "montant_total": 27.5
}
```

**Response Errors**:
- `404` : "Panier {id} non trouvé."

**Cas d'Usage**:
```javascript
// Appelé automatiquement lors du chargement de /checkout?panier_id=42
const panierDetails = await fetch('/api/paniers/42').then(r => r.json());
```

---

## Endpoints Modifiés

### POST /api/checkout (Comportement inchangé)
**Déjà existant, fonctionne avec les deux flux**

Le comportement reste identique. Le champ `brouillon_vocal_id` est maintenant plus générique:
- Flux Vocal: `brouillon_vocal_id` = ID de la CommandeVocale
- Flux Manuel: `brouillon_vocal_id` = null

```json
{
  "items": [
    {"product_id": 1, "quantity": 2.5}
  ],
  "creneau_livraison": "8-10",
  "mode_paiement": "cod",
  "brouillon_vocal_id": null
}
```

---

## Architecture Layer Diagram

```
┌─ Frontend (Next.js) ──────────────────────────────────────┐
│                                                            │
│  /catalogue                      /checkout                │
│     ├─ GET /api/catalogue           ├─ GET /api/paniers/{id}
│     └─ POST /api/manual-basket      └─ GET /api/commandes/{id}
│                                        (flux vocal)
│
│  submitManualBasket()              PanierService
│     ↓                                ↓
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Backend (FastAPI)                                     │
│                                                         │
│  PanierController                                      │
│     ├─ POST /api/manual-basket                         │
│     └─ GET /api/paniers/{id}                           │
│            ↓                                           │
│     PanierService (Context Manager)                    │
│            ↓                                           │
│     PanierDaoBD                                        │
│            ├─ create_panier_draft()                    │
│            ├─ create_ligne_panier()                    │
│            ├─ get_panier_by_id()                       │
│            └─ get_lignes_panier()                      │
│            ↓                                           │
│     SQLAlchemy ORM                                     │
│            ↓                                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Database (SQLite)                                     │
│                                                         │
│  t_paniers                                             │
│  t_lignes_panier                                       │
│  T_Product                                             │
│  t_users                                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Data Models (DTOs)

### Input Models
```python
class ManualBasketItemDTO(BaseModel):
    product_id: int
    quantity: float

class ManualBasketRequestDTO(BaseModel):
    items: List[ManualBasketItemDTO]
```

### Output Models
```python
class LignePanierResponseDTO(BaseModel):
    product_id: int
    nom_produit: str
    quantite_kg: float
    prix_unitaire: float
    sous_total: float
    unite: str
    image: str = "default_url"

class ManualBasketResponseDTO(BaseModel):
    status: str
    panier_id: int
    lignes_panier: List[LignePanierResponseDTO] = []
    total_dh: float = 0.0
    nombre_articles: int = 0
    frais_livraison: float = 10.0

class PanierDetailsDTO(BaseModel):
    panier_id: int
    lignes: List[LignePanierResponseDTO]
    total_legumes: float
    sous_total: float
    frais_livraison: float = 10.0
    montant_total: float
```

---

## Database Schema Changes

### New Tables
Aucune nouvelle table - utilise `t_paniers` et `t_lignes_panier` existantes

### Modified Relationships
```python
# User → Panier (one-to-many) ✓ Déjà existant
# Panier → LignePanier (one-to-many) ✓ Déjà existant
# Commande → Panier (one-to-one via panier_id) ✓ Déjà existant
```

---

## Migration Guide

### Pour les développeurs utilisant l'ancienne API
L'ancienne approche est toujours supportée:
```
Old:  /checkout?cart={"items":[...]}
New:  /checkout?panier_id=42
```

### Pour les administrateurs
Aucune migration de données requise. Les changements sont:
1. Ajout de nouveaux endpoints
2. Réutilisation d'entités existantes
3. Nouveau service + DAO

### Rollback
Si problème détecté:
```python
# Dans main.py, commenter:
# app.include_router(router_panier)

# Restaurer l'ancien flux:
# router.push("/checkout")  # au lieu de creer panier
```

---

## Performance Considerations

### Requêtes POST /api/manual-basket
- Valide N items produits (N queries)
- Crée 1 Panier + N LignePanier (1+N writes)
- **Time complexity**: O(N)
- **Typical**: < 100ms pour 10 items

### Requêtes GET /api/paniers/{id}
- Récupère Panier (1 query)
- Récupère LignesPanier (1 query)
- Récupère Products (1 query join)
- **Time complexity**: O(N) où N = nombre de lignes
- **Typical**: < 50ms pour 10 items

### Optimisations Futures
```python
# Eager loading des relations
session.query(Panier).options(
    joinedload(Panier.lignes)
).filter(Panier.id == panier_id)
```

---

## Error Handling

### Erreurs Courantes

| Code | Message | Cause | Solution |
|------|---------|-------|----------|
| 400 | "Le panier ne peut pas être vide." | items[] vide | Ajouter au moins 1 item |
| 400 | "Stock insuffisant pour {nom}" | Quantité > stock | Réduire la quantité |
| 400 | "Un ou plusieurs produits du panier sont introuvables" | product_id invalide | Vérifier IDs |
| 404 | "Panier {id} non trouvé" | panier_id invalide | Recréer le panier |
| 401 | "Not authenticated" | Pas de token | Se connecter |

---

## Integration Checklist

- [ ] Backend enregistrement router dans main.py ✓
- [ ] Backend imports corrects dans dependencies.py ✓
- [ ] Frontend submitManualBasket() importée ✓
- [ ] Frontend handleCheckout() adaptée ✓
- [ ] Checkout page support panier_id ✓
- [ ] Tests POST /api/manual-basket
- [ ] Tests GET /api/paniers/{id}
- [ ] Tests intégration checkout final
- [ ] Tests cas d'erreur (stock, produit invalide, etc)
- [ ] Tests ancien flux vocal toujours marche
- [ ] UAT avec utilisateur réel

---

## Support & Questions

### Où trouver les sources?
- `back-end/controllers/panier_controller.py` - Routes
- `back-end/services/panier_service.py` - Logique
- `back-end/dao/panier_dao.py` - Accès DB
- `front-end/lib/catalogue.ts` - Fonction frontend
- `Documentation/CHECKOUT_INTEGRATION.md` - Guide d'architecture complet

### Debug mode
```python
# Dans panier_service.py, ajouter des logs:
print(f"🛠️ Créant panier pour user {user_id}")
print(f"🛠️ Total: {montant_total} DH")

# Ou utiliser logger:
import logging
logger = logging.getLogger(__name__)
logger.info(f"Panier créé: {panier.id}")
```
