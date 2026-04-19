# Documentation Index - Manual Checkout Integration

## 📖 Guide de Navigation

Cette documentation couvre l'intégration complète du checkout manuel (panier → validation) parallèle au checkout vocal existant.

---

## 🚀 Pour Démarrer Rapidement

### Je suis développeur et je veux tester
→ Lire: **[QUICKSTART_MANUAL_CHECKOUT.md](QUICKSTART_MANUAL_CHECKOUT.md)**
- Setup en 5 minutes
- Tests rapides
- Troubleshooting

---

## 🏗️ Pour Comprendre l'Architecture

### Je veux voir comment ça marche
→ Lire: **[CHECKOUT_INTEGRATION.md](CHECKOUT_INTEGRATION.md)**
- Architecture en couches
- Flux détaillés (vocal vs manuel)
- Entités et services
- Gestion d'erreurs

### Je veux les détails API
→ Lire: **[API_MANUAL_CHECKOUT.md](API_MANUAL_CHECKOUT.md)**
- Endpoints détaillés
- Requêtes/réponses
- Codes d'erreur
- Migration guide

---

## 🧪 Pour Tester Complètement

### Je veux tester tous les cas
→ Lire: **[TESTING_MANUAL_CHECKOUT.md](TESTING_MANUAL_CHECKOUT.md)**
- Préparation
- Tests manuels complets
- Tests d'erreur
- Vérification DB
- Plan de déploiement

---

## 📝 Vue d'Ensemble Rapide

### Flux Vocal (Existant)
```
Catalogue → Commande Vocale → Résumé → Checkout → Commande Finale
```

### Flux Manuel (Nouveau)
```
Catalogue → Panier Brouillon → Résumé → Checkout → Commande Finale
```

### Endpoints Nouveaux
- `POST /api/manual-basket` - Créer panier brouillon
- `GET /api/paniers/{id}` - Récupérer détails panier

### Composants Créés
```
Back-end:
├── dto/panier_dto.py
├── interfaces/panier_service_interface.py
├── interfaces/panier_dao_interface.py
├── dao/panier_dao.py
├── services/panier_service.py
└── controllers/panier_controller.py

Front-end:
├── lib/catalogue.ts (submitManualBasket)
├── app/catalogue/page.tsx (handleCheckout adapté)
└── app/checkout/page.tsx (support panier_id)
```

---

## 🔍 Références Croisées

| Document | Couvre | Niveau |
|----------|--------|--------|
| QUICKSTART | Setup + tests rapides | Débutant |
| CHECKOUT_INTEGRATION | Architecture complète | Intermédiaire |
| API_MANUAL_CHECKOUT | Détails techniques API | Avancé |
| TESTING_MANUAL_CHECKOUT | QA complet | Détaillé |

---

## ✅ Checklist de Vérification

### Front-end
- [ ] `submitManualBasket()` existe dans `lib/catalogue.ts`
- [ ] `handleCheckout()` adapté dans `app/catalogue/page.tsx`
- [ ] `checkout/page.tsx` supporte `panier_id`
- [ ] No console errors au lancement

### Back-end
- [ ] `panier_controller.py` enregistré dans `main.py`
- [ ] `POST /api/manual-basket` répond
- [ ] `GET /api/paniers/{id}` répond
- [ ] Pas d'erreurs d'import

### Database
- [ ] Table `t_paniers` existe
- [ ] Table `t_lignes_panier` existe
- [ ] Données créées au premier test

### Intégration
- [ ] Flux vocal toujours fonctionne
- [ ] Flux manuel crée panier correctement
- [ ] Checkout final fonctionne pour les deux

---

## 🐛 Troubleshooting Rapide

| Problème | Solution | Doc |
|----------|----------|-----|
| API 404 not found | Vérifier router enregistré dans main.py | QUICKSTART |
| Panier vide error | Vérifier items passés correctement | API_MANUAL_CHECKOUT |
| Stock insuffisant | Vérifier stocks en DB | CHECKOUT_INTEGRATION |
| Page ne charge pas | Vérifier réseau en DevTools | QUICKSTART |
| DB erreur | Vérifier t_paniers existe | TESTING_MANUAL_CHECKOUT |

---

## 🚢 Déploiement

1. ✅ Merge tout code en staging
2. ✅ Exécuter tests (voir TESTING_MANUAL_CHECKOUT.md)
3. ✅ Vérifier logs backend
4. ✅ Faire UAT avec équipe
5. ✅ Merger en production

### Rollback Simple
Commenter 1 ligne dans `main.py`:
```python
# app.include_router(router_panier)  # Déactiver nouveau flux si erreur critique
```

---

## 📊 Statistiques

| Métrique | Valeur |
|----------|--------|
| Fichiers créés | 6 |
| Fichiers modifiés | 5 |
| Endpoints nouveaux | 2 |
| Services créés | 1 |
| DTOs créés | 3 |
| Lignes de code | ~800 |
| Temps implementation | ~2h |

---

## 🤝 Points de Contact

### Architecture/Design
- Voir: `CHECKOUT_INTEGRATION.md`
- Fichier: `back-end/services/panier_service.py`

### API Specs
- Voir: `API_MANUAL_CHECKOUT.md`
- Fichier: `back-end/controllers/panier_controller.py`

### Frontend Integration
- Voir: `QUICKSTART_MANUAL_CHECKOUT.md`
- Fichier: `front-end/lib/catalogue.ts`

### Testing
- Voir: `TESTING_MANUAL_CHECKOUT.md`
- Checklist: Points de test à couvrir

---

## 📚 Documents Connexes (Contexte Existant)

Pour comprendre le contexte plus large du projet:

- `ARCHITECTURE_RESTRUCTURED.md` - Architecture générale du projet
- `AUTHENTICATION_GUIDE.md` - Système d'auth (JWT)
- `POST_RESTRUCTURING.md` - Changements antérieurs
- `INTEGRATION_POINTS.md` - Points d'intégration système

---

## ⏱️ Temps de Lecture Estimé

| Document | Temps |
|----------|-------|
| QUICKSTART | 5 min |
| CHECKOUT_INTEGRATION | 15 min |
| API_MANUAL_CHECKOUT | 15 min |
| TESTING_MANUAL_CHECKOUT | 20 min |
| **Total** | **55 min** |

---

## 🎯 Prochaines Étapes

### Phase 1: Setup (FAIT ✓)
- Code écrit et documenté
- Fichiers créés
- Import enregistrés

### Phase 2: Test (À FAIRE)
- Tests manuels locaux
- Vérification API
- Vérification DB

### Phase 3: Déploiement (À FAIRE)
- Staging testing
- UAT
- Production release

### Phase 4: Maintenance (À FAIRE)
- Monitoring
- Performance tuning
- Bug fixes si besoin

---

**Version**: 1.0  
**Date**: 2024-04  
**Auteur**: Architecture Team  
**Status**: ✅ Documentation Complete
