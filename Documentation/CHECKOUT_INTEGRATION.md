# Flux de Checkout Intégré - Manuel et Vocal

## Vue d'ensemble

Le système supporte maintenant deux flux de checkout parallèles avec la même architecture:

1. **Flux Vocal** : Commande vocale → CommandeVocale → Checkout
2. **Flux Manuel** : Catalogue → Panier brouillon → Checkout

## Architecture en Couches

```
┌─────────────────────────────────────────────────────────────┐
│                   API REST (FastAPI)                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ POST /api/voice-basket      → Service Vocal           │ │
│  │ POST /api/text-basket       → Service Vocal           │ │
│  │ POST /api/manual-basket     → Service Panier (NOUVEAU)│ │
│  │ GET /api/commandes/{id}     → Détails Commande Vocal  │ │
│  │ GET /api/paniers/{id}       → Détails Panier (NOUVEAU)│ │
│  │ POST /api/checkout          → Validation finale       │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
        │              │                    │
        ├──────────────┴────────────────────┤
        │                                   │
        v                                   v
┌──────────────────────────┐    ┌──────────────────────────┐
│  CommandeVocaleService   │    │   PanierService (NOUVEAU)│
│  CommandeVocaleDaoBD     │    │   PanierDaoBD (NOUVEAU)  │
└──────────────────────────┘    └──────────────────────────┘
        │                               │
        └───────────────┬───────────────┘
                        v
                    ┌──────────────────┐
                    │  CheckoutService │
                    │ CheckoutDaoBD    │
                    └──────────────────┘
                        │
                        v
                    ┌──────────────────┐
                    │   Commande       │
                    │   Panier         │
                    │   LignePanier    │
                    └──────────────────┘
```

## Flux Détaillé

### 1. Flux Vocal (Existant)

```
Frontend (catalogue)
  ↓
[Utilisateur parle/tape]
  ↓
POST /api/voice-basket ou /api/text-basket
  ↓
CommandeVocaleService.traiter_audio() ou traiter_texte()
  ↓
- Crée CommandeVocale en DB
- Parse l'IA Gemini
- Valide et ajuste les items
- Crée LigneCommandeVocale
  ↓
Retour VoiceBasketResponseDTO avec commande_id
  ↓
Frontend redirige vers /checkout?commande_id=X
  ↓
GET /api/commandes/{X} → CommandeCheckoutDTO
  ↓
Utilisateur confirme → POST /api/checkout
  ↓
CheckoutService.create_checkout()
  ↓
- Crée Panier + LignePanier
- Crée Commande définitive
- brouillon_vocal_id = X
```

### 2. Flux Manuel (Nouveau)

```
Frontend (catalogue)
  ↓
[Utilisateur ajoute items au panier]
  ↓
[Clic "Valider la commande"]
  ↓
POST /api/manual-basket
{
  "items": [
    {"product_id": 1, "quantity": 2},
    {"product_id": 3, "quantity": 1}
  ]
}
  ↓
PanierService.create_manual_basket()
  ↓
- Valide stocks
- Crée Panier brouillon en DB
- Crée LignePanier pour chaque item
- Calcule totaux
  ↓
Retour ManualBasketResponseDTO avec panier_id
  ↓
Frontend redirige vers /checkout?panier_id=X
  ↓
GET /api/paniers/{X} → PanierDetailsDTO
  ↓
Utilisateur confirme → POST /api/checkout
  ↓
CheckoutService.create_checkout()
  ↓
- Réutilise le Panier créé
- Crée Commande définitive
- brouillon_vocal_id = null
```

## Entités Utilisées

### CommandeVocale (Flux Vocal)
```python
class CommandeVocale(Base):
    id
    user_id
    texte_transcrit
    json_brut_gemini
    langue
    lignes: [LigneCommandeVocale]
```

### Panier (Flux Manuel)
```python
class Panier(Base):
    id
    user_id
    total_legumes
    total_facture
    marge_brute
    lignes: [LignePanier]
    commande: Commande (one-to-one)
```

### LignePanier
```python
class LignePanier(Base):
    id
    panier_id
    produit_id
    quantite_kg
    sous_total
```

### Commande (Final Order)
```python
class Commande(Base):
    id
    client_id
    panier_id (ref à Panier)
    brouillon_vocal_id (ref optionnel à CommandeVocale)
    statut = "en_attente"
    ...
```

## DTOs du Circuit

### Entrée - Création Panier Manuel
```python
class ManualBasketRequestDTO:
    items: List[{product_id, quantity}]
```

### Sortie - Résumé du Panier
```python
class ManualBasketResponseDTO:
    status: "success"
    panier_id: int
    lignes_panier: [LignePanierResponseDTO]
    total_dh: float
    nombre_articles: int
    frais_livraison: 10.0
```

### Détails du Panier pour Checkout
```python
class PanierDetailsDTO:
    panier_id: int
    lignes: [LignePanierResponseDTO]
    total_legumes: float
    sous_total: float
    frais_livraison: 10.0
    montant_total: float
```

## Services

### CommandeVocaleService (Existant)
- `traiter_audio()` : Parse audio + Gemini
- `traiter_texte()` : Parse texte + Gemini
- `get_commande_checkout()` : Détails pour checkout

### PanierService (Nouveau)
- `create_manual_basket()` : Valide items + crée panier
- `get_panier_details()` : Détails pour checkout

### CheckoutService (Réutilisé)
- `create_checkout()` : Crée la commande définitive
  - Supporte `brouillon_vocal_id` optionnel
  - Valide le panier et les stocks
  - Crée Panier + LignePanier + Commande

## Points d'Intégration Frontend

### Catalogue
- Import `submitManualBasket()` de `lib/catalogue.ts`
- Bouton "Valider" → appelle `POST /api/manual-basket`
- Redirige vers `/checkout?panier_id=X`

### Checkout
- Support `?commande_id=X` (flux voix)
- Support `?panier_id=X` (flux manuel)
- Affichage conditionnel du résumé
- Payload checkout identique pour les deux flux

## Gestion des Erreurs

### Validations du PanierService
```python
- Panier vide → ValueError
- Produit inexistant → ValueError  
- Stock insuffisant → ValueError
- Quantités négatives → ValueError
```

### Réponses HTTP
```python
POST /api/manual-basket
- 200: Success → ManualBasketResponseDTO
- 400: Validation error → {detail: error_message}
- 401: Unauthorized

GET /api/paniers/{id}
- 200: Success → PanierDetailsDTO
- 404: Panier not found → {detail: error_message}
- 401: Unauthorized

POST /api/checkout
- 200: Success → CheckoutResponseDTO
- 400: Validation error
- 401: Unauthorized
```

## Points Importants

1. **Session Management** : PanierService utilise context manager comme CommandeVocaleService
2. **Stock Decrement** : Pas décrémenté au moment du brouillon (attendre checkout)
3. **Validation Totale** : Tous les items validés avant création du panier
4. **Prix Fixe** : Frais livraison = 10 DH constant
5. **Réutilisation** : CheckoutService traite les deux flux sans distinction
6. **Statut Brouillon** : Panier n'a pas de champ statut, créé directement en DB
7. **Authentication** : GET_current_user exigé pour les deux endpoints

## Migration depuis Ancienne Architecture

L'ancienne approche qui passait le panier en URL est toujours supportée:
```
/checkout?cart={"items":[...]}
```

Mais la nouvelle approche est préférée:
```
/checkout?panier_id=X
```

## Exemple d'Utilisation Frontend

```typescript
// lib/catalogue.ts
export async function submitManualBasket(cart: CartItem[]): Promise<ManualBasketResponse> {
  const items = cart.map((item) => ({
    product_id: item.id,
    quantity: item.quantity,
  }))

  return apiCall("/api/manual-basket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  })
}

// app/catalogue/page.tsx
const handleCheckout = async () => {
  const result = await submitManualBasket(cart)
  router.push(`/checkout?panier_id=${result.panier_id}`)
}
```

## Déploiement

1. ✅ Créer les fichiers DAO, Service, Interface, DTO, Controller
2. ✅ Enregistrer router dans main.py
3. ✅ Ajouter dépendances dans dependencies.py
4. ✅ Adapter frontend
5. ⏳ Tester les deux flux
6. ⏳ Valider les stocks
7. ⏳ Tester les erreurs
