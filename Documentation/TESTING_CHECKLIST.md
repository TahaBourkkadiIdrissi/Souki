# ✅ Checklist de Déploiement & Tests - Système d'Authentification

## 🚀 Avant de Démarrer

- [ ] Backend requirements.txt à jour (FastAPI, SQLAlchemy, PyJWT, bcrypt)
- [ ] Frontend package.json à jour (Next.js, React, lucide-react)
- [ ] Base de données créée et connectée
- [ ] `.env` backend avec SECRET_KEY configuré
- [ ] Port 8000 backend disponible
- [ ] Port 3000 frontend disponible

---

## 🔧 Installation & Démarrage

### Backend Setup
- [ ] `cd back-end`
- [ ] `python -m venv venv` (si non fait)
- [ ] `venv\Scripts\activate.ps1` (Windows PowerShell)
- [ ] `pip install -r requirements.txt`
- [ ] Tester imports: `python -c "import controllers; print('OK')"`
- [ ] Lancer: `python -m uvicorn main:app --reload`
- [ ] Vérifier: http://localhost:8000/docs affiche Swagger UI

### Frontend Setup
- [ ] `cd front-end`
- [ ] `npm install` (si non fait)
- [ ] Vérifier fichiers créés:
  - [ ] `contexts/auth-context.tsx` ✅
  - [ ] `hooks/useAuth.ts` ✅
  - [ ] `lib/api.ts` ✅
  - [ ] `components/souki/navbar.tsx` ✅
  - [ ] `components/souki/profile-dropdown.tsx` ✅
- [ ] Build: `npm run build`
- [ ] Pas d'erreurs TypeScript affichées
- [ ] Lancer: `npm run dev`
- [ ] Vérifier: http://localhost:3000 affiche home page

---

## 🧪 Test 1: État Sans Authentification

**Objectif**: Vérifier que la page est publique mais actions sont protégées

### Test Case 1a: Page visible sans auth
```
1. [ ] Ouvrir http://localhost:3000
2. [ ] ✅ Home page affichée
3. [ ] ✅ Navbar visible avec logo
4. [ ] ✅ Navbar affiche bouton "Connexion" (pas profile icon)
5. [ ] ✅ Bouton "Panier" visible
6. [ ] Ouvrir DevTools → Application → Cookies
7. [ ] ✅ localStorage n'a pas de token
```

### Test Case 1b: Actions redirigent vers login
```
1. [ ] Toujours sur home page sans auth
2. [ ] Cliquer sur "Ajouter au panier" (ProductCard)
3. [ ] ✅ Redirigé vers http://localhost:3000/login
4. [ ] ✅ Page login affichée avec options (client/parent/livreur)
5. [ ] Cliquer sur "Commander maintenant" (hero button)
6. [ ] ✅ Redirigé vers /login
```

### Test Case 1c: Navbar "Connexion" button fonctionne
```
1. [ ] Back to home (http://localhost:3000)
2. [ ] Cliquer navbar "Connexion" button
3. [ ] ✅ Redirigé vers /login
4. [ ] ✅ Peut sélectionner rôle (client/parent/livreur)
```

---

## 🧪 Test 2: Inscription & Login

**Objectif**: Créer compte et se connecter

### Test Case 2a: S'inscrire (Signup)
```
1. [ ] Sur /login page
2. [ ] Cliquer "S'inscrire" (toggle mode)
3. [ ] Remplir formulaire:
   - [ ] Email: test@souki.local
   - [ ] Téléphone: 0612345678 (reformatage auto en +212612345678)
   - [ ] Password: TestPass123
   - [ ] Confirm Password: TestPass123
   - [ ] ✅ Cocher "J'accepte les conditions"
4. [ ] Cliquer "S'inscrire"
5. [ ] ✅ Message: "Compte créé avec succès"
6. [ ] ✅ Mode bascule automatiquement vers "Login"
```

### Test Case 2b: Se connecter (Login)
```
1. [ ] Sur /login en mode "Login"
2. [ ] Remplir identifiants:
   - [ ] Email: test@souki.local
   - [ ] Password: TestPass123
3. [ ] Cliquer "Se connecter"
4. [ ] ✅ Chargement affichée (spinner/loading state)
5. [ ] ✅ Redirigé automatiquement vers / (home page)
```

### Test Case 2c: Vérifier localStorage après login
```
1. [ ] Toujours connecté sur home page
2. [ ] Ouvrir DevTools → Application → localStorage
3. [ ] ✅ Key "token" existe
4. [ ] ✅ Valeur commence par "eyJ" (JWT format)
5. [ ] ✅ Token pas vide
```

---

## 🧪 Test 3: Navbar Connectée & Profile Icon

**Objectif**: Navbar affiche profil utilisateur

### Test Case 3a: Profile icon visible
```
1. [ ] Connecté sur home page
2. [ ] Regarder navbar
3. [ ] ✅ Plus de bouton "Connexion"
4. [ ] ✅ À la place: avatar circle avec initiales (ex: "TE" pour test@)
5. [ ] ✅ Chevron dropdown visible qui "flip" au clic
```

### Test Case 3b: Dropdown menu fonctionne
```
1. [ ] Cliquer sur profile icon / avatar
2. [ ] ✅ Dropdown apparaît
3. [ ] ✅ Affiche header avec:
   - [ ] Role: "CLIENT" (ou rôle sélectionné)
   - [ ] Email: "test@souki.local"
4. [ ] ✅ Menu items visibles:
   - [ ] "Mon profil" avec icône
   - [ ] "Déconnexion" avec icône
5. [ ] Cliquer ailleurs sur page
6. [ ] ✅ Dropdown ferme automatiquement
```

### Test Case 3c: Données utilisateur chargées
```
1. [ ] Backend: Sur http://localhost:8000/docs
2. [ ] Tester endpoint GET /auth/me:
   - [ ] Cliquer "Try it out"
   - [ ] Copier token depuis localhost:3000 DevTools localStorage
   - [ ] Passer token dans Authorization header
   - [ ] Execute
3. [ ] ✅ Response 200 avec:
   - [ ] id: number
   - [ ] email: "test@souki.local"
   - [ ] phone: "+212612345678"
   - [ ] role: "CLIENT"
   - [ ] is_verified: boolean
```

---

## 🧪 Test 4: Persistance Token (Refresh Page)

**Objectif**: Token persiste après F5 refresh

### Test Case 4a: Après login, session persiste
```
1. [ ] Connecté sur home page
2. [ ] Profile icon visible
3. [ ] Appuyer F5 (refresh page)
4. [ ] ✅ Page recharge (loading brief moment)
5. [ ] ✅ Profile icon toujours visible
6. [ ] ✅ localStorage["token"] toujours présent
7. [ ] Navbar pas de "flash" de "Connexion" button
```

### Test Case 4b: Token validé au startup
```
1. [ ] Console navigateur ouverte (F12)
2. [ ] Refresh page
3. [ ] ✅ Pas d'erreurs JS console
4. [ ] ✅ Pas de 401 errors en Network tab
5. [ ] ✅ GET /auth/me appelé → 200 response
6. [ ] ✅ User state peuplé (vérifier via devtools React)
```

### Test Case 4c: Fermer et rouvrir navigateur
```
1. [ ] Connecté, fermer navigateur completement
2. [ ] Rouvrir http://localhost:3000
3. [ ] ✅ localStorage["token"] toujours là
4. [ ] ✅ Profile icon visible spontanément
5. [ ] ✅ Session restaurée
```

---

## 🧪 Test 5: Logout

**Objectif**: Déconnexion fonctionne et nettoie état

### Test Case 5a: Cliquer Déconnexion
```
1. [ ] Connecté sur home page
2. [ ] Cliquer profile icon → dropdown
3. [ ] Cliquer "Déconnexion"
4. [ ] ✅ Dropdown ferme
5. [ ] ✅ Redirigé vers / (home page)
6. [ ] ✅ Navbar affiche "Connexion" button (pas profile)
7. [ ] ✅ localStorage["token"] supprimé (vérifier DevTools)
```

### Test Case 5b: Après logout, actions redirigent login
```
1. [ ] Juste après logout
2. [ ] Cliquer "Ajouter au panier"
3. [ ] ✅ Redirigé vers /login
4. [ ] ✅ Formulaire login vide
```

### Test Case 5c: Token supprimé complètement
```
1. [ ] Après logout
2. [ ] DevTools → localStorage
3. [ ] ✅ Key "token" n'existe plus
4. [ ] ✅ Pas d'autre données privées
```

---

## 🧪 Test 6: Actions Protégées

**Objectif**: Toutes actions requièrent auth

### Test Case 6a: Produits protected
```
1. [ ] Logout (ou utiliser autre navigateur sans token)
2. [ ] Home page visible
3. [ ] Cliquer ProductCard → "Voir details" / "Add to cart"
4. [ ] ✅ Redirigé /login si pas connecté
```

### Test Case 6b: Buttons protected
```
1. [ ] Pas connecté
2. [ ] Cliquer "Commander maintenant" (hero button)
3. [ ] ✅ Redirigé /login
4. [ ] Cliquer "Assistant Vocal" button
5. [ ] ✅ Redirigé /login (ou error handling)
6. [ ] Cliquer "Panier Intelligent" button
7. [ ] ✅ Redirigé /login (ou error handling)
```

### Test Case 6c: Actions OK si connecté
```
1. [ ] Connecté
2. [ ] Cliquer "Ajouter au panier" ProductCard
3. [ ] ✅ Produit ajouté (cart count augmente)
4. [ ] ✅ Pas de redirect
5. [ ] ✅ Resto de page accessible normalement
```

---

## 🧪 Test 7: Gestion d'Erreurs

**Objectif**: Erreurs gérées gracieusement

### Test Case 7a: Token expiré
```
1. [ ] Connecté
2. [ ] Attendre 7+ jours OU modifier token dans localStorage (invalider)
3. [ ] Cliquer action
4. [ ] ✅ Erreur 401 captée
5. [ ] ✅ Redirigé /login
6. [ ] ✅ localStorage["token"] supprimé
```

### Test Case 7b: Identifiants incorrects
```
1. [ ] /login/client → Login mode
2. [ ] Entrer email invalide
3. [ ] Entrer password n'importe quoi
4. [ ] Submit
5. [ ] ✅ Message d'erreur affiché: "Email ou mot de passe incorrect"
```

### Test Case 7c: Signup email déjà existe
```
1. [ ] /login/client → Signup mode
2. [ ] Utiliser email déjà créé (test@souki.local)
3. [ ] Different password
4. [ ] Submit
5. [ ] ✅ Message d'erreur: "Ce compte existe déjà"
```

---

## 🧪 Test 8: Multi-onglet/Tab Synchronisation (Optionnel)

**Objectif**: État synchronisé entre tabs

### Test Case 8a: Login dans un tab
```
1. [ ] Deux tabs ouverts sur http://localhost:3000
2. [ ] Tab A: Connecté
3. [ ] Regarder Tab B
4. [ ] ❓ Idealement: Tab B affiche aussi profile (stocker dans localStorage listener)
5. [ ] Note: Implémentation actuelle ne supporte pas, mais c'est bonus
```

---

## 📊 Résultats Attendus

| Test | Status | Notes |
|------|--------|-------|
| Page publique sans auth | ✅ PASS | Actions redirigent login |
| Signup fonctionne | ✅ PASS | Compte créé, pwd hashé |
| Login fonctionne | ✅ PASS | Token reçu et sauvegardé |
| Token validé | ✅ PASS | GET /auth/me → 200 |
| Profile icon visible | ✅ PASS | Navbar mise à jour |
| Dropdown menu | ✅ PASS | Affiche profil + logout |
| Refresh persiste | ✅ PASS | Session survit F5 |
| Logout fonctionne | ✅ PASS | Token supprimé |
| Actions protégées | ✅ PASS | Auth required |
| Erreurs gérées | ✅ PASS | Messages d'erreur |

---

## 📝 Notes Finales

- **Performance**: Token validé 1x au startup (acceptable)
- **Sécurité**: Bearer token OK pour MVP, migrer cookies HttpOnly pour prod
- **UX**: Pas de "flash" de changement de navbar (bon!)
- **Code Quality**: Tout compile sans erreurs
- **Documentation**: Guides fournis (AUTHENTICATION_GUIDE.md)

---

**Checklist de test complète! ✅**

Une fois tous les tests passés, le système d'authentification est prêt pour production (avec notes de sécurité).

