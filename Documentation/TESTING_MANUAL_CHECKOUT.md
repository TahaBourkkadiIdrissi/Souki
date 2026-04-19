# Plan de Test - Intégration Checkout Manuel

## Préparation

### Back-end
```bash
cd c:\ESISA\ESISA3a\Souki
python -m pip install -q pydantic sqlalchemy fastapi
# Vérifier que les imports compilent
python -c "from back_end.controllers.panier_controller import router_panier; print('✓ Router compilé')"
```

### Front-end
```bash
cd c:\ESISA\ESISA3a\Souki\front-end
npm install  # ou pnpm install
```

## Tests Manuels

### 1. Test Flux Manuel Complet

#### 1.1 - Catalogue
- [ ] Accéder à `/catalogue`
- [ ] Se connecter (ou redirection login)
- [ ] Ajouter plusieurs items au panier local
- [ ] Vérifier que le panier s'affiche correctement
- [ ] Vérifier les quantités et prix

#### 1.2 - Création du Panier Brouillon
- [ ] Cliquer "Valider la commande"
- [ ] Observer le chargement "Validation en cours..."
- [ ] Vérifier qu'il n'y a pas d'erreur réseau
- [ ] Vérifier que le panier est vidé après succès

#### 1.3 - Page Checkout
- [ ] La redirection vers `/checkout?panier_id=X` se fait correctement
- [ ] La page charge les détails du panier
- [ ] Le résumé s'affiche: `{nombre_articles} article(s) pour {sous_total} DH`
- [ ] Tous les items du panier sont affichés
- [ ] Les prix et quantités correspondent

#### 1.4 - Finalisation du Checkout
- [ ] Sélectionner un créneau de livraison
- [ ] Sélectionner un mode de paiement
- [ ] Accepter les conditions
- [ ] Cliquer "Finaliser ma commande"
- [ ] Vérifier que POST /checkout est appelé
- [ ] Vérifier que la commande définitive est créée (N° reçu)

### 2. Test Flux Vocal (Validation qu'il marche toujours)

- [ ] Aller à `/catalogue`
- [ ] Cliquer "Assistant vocale IA"
- [ ] Parler une commande simple
- [ ] Vérifier que `/api/voice-basket` est appelé
- [ ] Vérifier que le résumé s'affiche
- [ ] Aller au checkout et finaliser
- [ ] Vérifier que `brouillon_vocal_id` n'est pas null dans Commande

### 3. Tests des Cas d'Erreur

#### 3.1 - Panier Manuel - Stock Insuffisant
```bash
# API Request
POST /api/manual-basket
Authorization: Bearer {token}
{
  "items": [
    {"product_id": 999, "quantity": 999}
  ]
}
```
- [ ] Doit retourner 400 "Stock insuffisant"

#### 3.2 - Panier Manuel - Produit Inexistant
```bash
POST /api/manual-basket
{
  "items": [
    {"product_id": 99999, "quantity": 1}
  ]
}
```
- [ ] Doit retourner 400 "produits du panier sont introuvables"

#### 3.3 - Panier Manuel - Quantité Négative
```bash
POST /api/manual-basket
{
  "items": [
    {"product_id": 1, "quantity": -5}
  ]
}
```
- [ ] Doit retourner 400 "quantité positive"

#### 3.4 - Récupération Panier Non Existant
```bash
GET /api/paniers/99999
```
- [ ] Doit retourner 404

### 4. Tests des Endpoints API

#### Endpoint 1: POST /api/manual-basket
```
Request:
  - User-ID: token JWT d'un utilisateur connecté
  - Body: { "items": [{"product_id": 1, "quantity": 2}] }

Response (200):
  {
    "status": "success",
    "panier_id": 5,
    "lignes_panier": [
      {
        "product_id": 1,
        "nom_produit": "Tomates",
        "quantite_kg": 2.0,
        "prix_unitaire": 7.0,
        "sous_total": 14.0,
        "unite": "kg"
      }
    ],
    "total_dh": 14.0,
    "nombre_articles": 1,
    "frais_livraison": 10.0
  }
```

#### Endpoint 2: GET /api/paniers/{panier_id}
```
Request:
  - panier_id: 5

Response (200):
  {
    "panier_id": 5,
    "lignes": [
      {
        "product_id": 1,
        "nom_produit": "Tomates",
        "quantite_kg": 2.0,
        "prix_unitaire": 7.0,
        "sous_total": 14.0,
        "unite": "kg"
      }
    ],
    "total_legumes": 2.0,
    "sous_total": 14.0,
    "frais_livraison": 10.0,
    "montant_total": 24.0
  }
```

#### Endpoint 3: POST /api/checkout (identique pour les deux flux)
```
Request (Flux Manuel):
  {
    "items": [{"product_id": 1, "quantity": 2}],
    "creneau_livraison": "8-10",
    "mode_paiement": "cod",
    "brouillon_vocal_id": null    ← Important: null pour flux manuel
  }

Request (Flux Vocal):
  {
    "items": [...],
    "creneau_livraison": "8-10",
    "mode_paiement": "cod",
    "brouillon_vocal_id": 3       ← ID de la CommandeVocale
  }

Response (200):
  {
    "status": "success",
    "commande_id": 42,
    "panier_id": 5,
    "total_articles": 1,
    "sous_total": 14.0,
    "frais_livraison": 10.0,
    "montant_total": 24.0,
    "message": "Commande enregistree avec succes."
  }
```

### 5. Tests de Base de Données

#### Vérifier la structure
```sql
-- Tables créées correctement
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 't_panier%';

-- Devrait afficher: t_paniers, t_lignes_panier
```

#### Vérifier les données
```sql
-- Après test flux manuel
SELECT * FROM t_paniers WHERE user_id = 1;
SELECT * FROM t_lignes_panier WHERE panier_id = (SELECT MAX(id) FROM t_paniers);
SELECT * FROM t_commandes WHERE brouillon_vocal_id IS NULL LIMIT 1;
```

## Résultats Attendus

### Au Succès
- ✅ Deux flux (vocal et manuel) travaillent en parallèle
- ✅ Les paniers brouillons sont créés correctement
- ✅ Les détails de panier sont retournés correctement
- ✅ Le checkout final crée une Commande avec brouillon_vocal_id approprié
- ✅ Pas de doublon de Panier (réutilisation de celui créé au brouillon)
- ✅ Stocks validés avant création du brouillon
- ✅ Les prix et totaux sont corrects

### Points Critiques à Vérifier
1. **Pas de déclaration de stock** au moment du brouillon ✓
2. **Validation des stocks** avant création du panier ✓
3. **Context manager** fonctionne correctement ✓
4. **Réutilisation du Panier** lors du checkout final ✓
5. **brouillon_vocal_id optionnel** dans Commande ✓
6. **Messages d'erreur clairs** en cas de problème ✓

## Fichiers Modifiés

### Back-end
- `dto/panier_dto.py` - DTOs pour panier manuel ✓
- `interfaces/panier_service_interface.py` - Interface service ✓
- `interfaces/panier_dao_interface.py` - Interface DAO ✓
- `dao/panier_dao.py` - Implémentation DAO ✓
- `services/panier_service.py` - Logique service ✓
- `controllers/panier_controller.py` - Routes API ✓
- `dependencies.py` - Injection de dépendances ✓
- `main.py` - Enregistrement du router ✓

### Front-end
- `lib/catalogue.ts` - Fonction submitManualBasket() ✓
- `app/catalogue/page.tsx` - handleCheckout adapté ✓
- `app/checkout/page.tsx` - Support panier_id ✓

## Points à Surveiller

1. **CORS** : S'assurer que http://localhost:3000 est autorisé
2. **JWT** : Le token doit être envoyé dans Authorization header
3. **Versioning** : Les anciens paramètres `cart` et `commande_id` restent supportés
4. **Migration** : Les données existantes ne sont pas affectées
5. **Performance** : Les requêtes GET /api/paniers/{id} doivent être rapides

## Rollback Plan

Si une erreur critique est trouvée:

1. **Backend**: Commenter l'import de `router_panier` dans main.py
2. **Frontend**: Revenir à la version d'avant `submitManualBasket`
3. **Database**: Aucune migration requise (tables créées dynamiquement)
