# Quick Start - Manual Checkout Testing

## 5-Minute Setup

### 1. Vérifier que les fichiers sont en place
```bash
# Back-end
ls -la back-end/controllers/panier_controller.py
ls -la back-end/services/panier_service.py
ls -la back-end/dao/panier_dao.py
ls -la back-end/dto/panier_dto.py

# Front-end
grep "submitManualBasket" front-end/lib/catalogue.ts
grep "panier_id" front-end/app/checkout/page.tsx
```

### 2. Redémarrer le backend
```bash
# Terminal 1 - Back-end
cd back-end
python main.py
# Devrait voir: "INFO:     Uvicorn running on http://0.0.0.0:8000"
```

### 3. Redémarrer le frontend
```bash
# Terminal 2 - Front-end
cd front-end
npm run dev
# ou
pnpm dev
# Devrait voir: "▲ Next.js 15.1.0 ▲
#                http://localhost:3000"
```

---

## Test Rapide

### 1. Accédez à http://localhost:3000/catalogue

### 2. Se connecter
- Email: (créer un compte)
- Ou utiliser un compte existant

### 3. Ajouter des items au panier
- Cliquer plusieurs fois "+5kg" pour ajouter des produits
- Vérifier que le panier s'affiche à droite

### 4. Cliquer "Valider la commande"
- Observer "Validation en cours..."
- Attendre la redirection automatique

### 5. Sur la page checkout
- Vérifier que l'URL contient `?panier_id=X`
- Vérifier le résumé du panier
- Sélectionner un créneau
- Sélectionner un mode de paiement
- Cocher les conditions
- Cliquer "Finaliser ma commande"

### 6. Succès!
- Devrait voir un message "Succès ! Votre commande définitive N°X..."
- La redirection vers l'accueil devrait se faire

---

## Inspection des Données

### Vérifier les requêtes API
1. Ouvrir DevTools (F12)
2. Aller à l'onglet Network
3. Ajouter des items et cliquer "Valider"
4. Observer les requêtes:
   - `POST /api/manual-basket` → `201` avec panier_id
   - `GET /api/paniers/{id}` → `200` avec détails

### Vérifier la base de données
```sql
-- Depuis SQLite CLI ou DB Browser
SELECT * FROM t_paniers ORDER BY id DESC LIMIT 1;
SELECT * FROM t_lignes_panier WHERE panier_id = (SELECT MAX(id) FROM t_paniers);
SELECT * FROM t_commandes WHERE panier_id = (SELECT MAX(id) FROM t_paniers) ORDER BY id DESC LIMIT 1;
```

---

## Cas de Test Rapides

### ✓ Cas OK - Happy Path
1. Ajouter 2 produits
2. Valider
3. Aller au checkout
4. Finaliser
**Résultat**: Commande créée avec N° de confirmation

### ✓ Cas OK - Modification Quantités
1. Ajouter 1 produit
2. Avant validation: modifier les quantités
3. Valider
4. Finaliser
**Résultat**: Quantités corrigées reflétées au checkout

### ✗ Cas Erreur - Stock Insuffisant
1. Ajouter un produit avec quantité > stock
2. Cliquer Valider
**Résultat**: Erreur "Stock insuffisant"

### ✗ Cas Erreur - Panier Vide
1. Ne pas ajouter d'items
2. Cliquer Valider
**Résultat**: Message d'alerte "votre panier est vide"

---

## Logs à Observer

### Backend (voir terminal où vous avez lancé `python main.py`)
```
INFO:     GET /api/catalogue 200
INFO:     POST /api/manual-basket 200
INFO:     GET /api/paniers/42 200
INFO:     POST /api/checkout 200
```

### Frontend (voir console du navigateur - F12)
```
submitManualBasket() called with 2 items
Response: {status: "success", panier_id: 42, ...}
Redirecting to /checkout?panier_id=42
```

---

## Troubleshooting Rapide

### "Cannot read property 'panier_id' of undefined"
- ✓ Vérifier que submitManualBasket existe
- ✓ Vérifier que /api/manual-basket retourne le bon JSON
- ✓ Ouvrir DevTools Network tab

### "Panier X non trouvé (404)"
- ✓ Vérifier l'URL: /checkout?panier_id=X
- ✓ Vérifier que le panier a bien été créé (voir DB)
- ✓ Vérifier que GET /api/paniers/{X} fonctionne

### "Stock insuffisant"
- ✓ Vérifier les stocks de la DB
- ✓ Réduire la quantité demandée
- ✓ Ajouter plus de stock dans la DB si besoin

### "Product_id not found"
- ✓ Vérifier que les produits existent
- ✓ Vérifier le catalogue en GET /api/catalogue
- ✓ Utiliser des IDs valides

### "Validation en cours... n'arrête pas"
- ✓ Ouvrir DevTools Network
- ✓ Vérifier que POST /api/manual-basket complète
- ✓ Vérifier les logs backend pour erreurs

---

## Fichiers Clés à Connaître

Pour déboguer rapidement:

| Fichier | Raison |
|---------|--------|
| `back-end/services/panier_service.py` | Logique de validation |
| `back-end/dao/panier_dao.py` | Requêtes DB |
| `front-end/lib/catalogue.ts` | Fonction submitManualBasket |
| `front-end/app/catalogue/page.tsx` | Bouton Valider |
| `front-end/app/checkout/page.tsx` | Support panier_id |
| `back-end/main.py` | Vérifier router_panier enregistré |

---

## Avant d'Aller en Prod

### Checklist
- [ ] Tester les 2 cas de test rapides OK
- [ ] Tester 2 cas de test erreur
- [ ] Vérifier que ancien flux VOCAL marche toujours
- [ ] Vérifier les données en DB
- [ ] Vérifier les logs pour erreurs
- [ ] Vérifier les stocks se décrémentent au checkout final
- [ ] Tester avec 10+ items (performance)

### Performance Check
- POST /api/manual-basket < 500ms ✓
- GET /api/paniers/{id} < 200ms ✓
- Page checkout charge < 2s ✓

---

## Questions?

Voir:
- `Documentation/CHECKOUT_INTEGRATION.md` - Vue d'ensemble architecture
- `Documentation/API_MANUAL_CHECKOUT.md` - Détails API
- `Documentation/TESTING_MANUAL_CHECKOUT.md` - Plan de test complet
