# 🚀 QUICK START - Système d'Authentification SOUKI

**Pas de temps? Utilisez ce guide simple!** 

---

## ⚡ 5 Minutes - Démarrage

### 1. Démarrer Backend
```bash
cd back-end
python -m uvicorn main:app --reload
```
✅ Vérifier: `http://localhost:8000/docs` affiche Swagger UI

### 2. Démarrer Frontend  
```bash
cd front-end
npm run dev
```
✅ Vérifier: `http://localhost:3000` affiche home page

### 3. Tester Authentification
```bash
# Option A: Navigateur
1. Aller http://localhost:3000
2. Cliquer "Connexion" 
3. S'inscrire avec email + password
4. 
5. ✅ Should be redirected to home with profile icon
```

---

## 📚 Comprendre le Système (15 min)

### Le concept
1. **User s'inscrit/login** → Backend retourne JWT token
2. **Frontend sauvegarde token** dans localStorage
3. **Frontend valide token** avec `GET /auth/me` 
4. **Navbar affiche profil icon** si connecté
5. **Actions redirigent login** si pas connecté

### Les 3 fichiers clés

**Backend** - 1 nouveau endpoint:
```python
@auth_router.get("/me")
def get_current_user_profile(user=Depends(get_current_user)):
    # Retourne les données de l'utilisateur
```

**Frontend Context** - Gère l'état global:
```typescript
const { user, isAuthenticated, login, logout } = useAuth()
```

**Frontend Component** - Protège les actions:
```typescript
if (!isAuthenticated) router.push("/login") // Redirect if not authed
```

---

## 🔧 Utiliser dans mon Code

### Cas 1: Afficher profil utilisateur
```typescript
import { useAuth } from "@/hooks/useAuth"

export function Hello() {
  const { user } = useAuth()
  return <p>Hello {user?.email}!</p>
}
```

### Cas 2: Protéger une action
```typescript
import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"

export function BuyButton() {
  const { isAuthenticated } = useAuth()
  const router = useRouter()

  const handleBuy = () => {
    if (!isAuthenticated) {
      router.push("/login")
      return
    }
    // Buy now...
  }

  return <button onClick={handleBuy}>Acheter</button>
}
```

### Cas 3: Appel API protégé
```typescript
import { useAuth } from "@/hooks/useAuth"

export function UserDashboard() {
  const { token } = useAuth()

  const fetchData = async () => {
    const res = await fetch("http://localhost:8000/profile/orders", {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    })
    return res.json()
  }
}
```

---

## 📁 Fichiers Créés

```
✅ Nouveau - contexts/auth-context.tsx         (Auth provider)
✅ Nouveau - hooks/useAuth.ts                  (Hook pour utiliser auth)
✅ Nouveau - lib/api.ts                        (Client API)
✅ Nouveau - components/souki/navbar.tsx       (Navbar globale)
✅ Nouveau - components/souki/profile-dropdown.tsx (Menu profil)

✅ Modifié - app/layout.tsx                    (Ajoute AuthProvider)
✅ Modifié - app/page.tsx                      (Actions protégées)
✅ Modifié - app/login/client/page.tsx         (Redirect vers /)

✅ Backend - controllers.py                    (Endpoint GET /auth/me)
✅ Backend - dal.py                            (Méthode UserDao.read)
```

---

## ✅ Vérifier que tout fonctionne

1. **Backend compile?**
   ```bash
   cd back-end && python -c "import controllers; print('OK')"
   ```

2. **Frontend compile?**
   ```bash
   cd front-end && npm run build
   # Si OK → "✅ Compiled successfully"
   ```

3. **Tests passent?**
   ```bash
   cd back-end && python test_auth.py
   ```

---

## ❓ Problèmes Courants

| Problème | Solution |
|----------|----------|
| 401 Unauthorized | Token expiré (7 jours) ou invalid |
| "useAuth must be used within AuthProvider" | Vérifier `<AuthProvider>` dans layout.tsx |
| Je veux ajouter une page /profile | Créer `app/profile/page.tsx` avec `useAuth()` check |
| Un endpoint retourne 401 | Ajouter `Depends(get_current_user)` |
| Comment ajouter Google OAuth? | Backend OK, ajouter front: GoogleLogin component |

---

## 🎯 Prochaines Étapes

1. **Qui utlise quoi?**
   - Checkout page → protéger avec `useAuth()`
   - Profile page → créer nouvelle page
   - API calls → utiliser Bearer token
   
2. **À implémenter:**
   - [ ] Page `/profile`
   - [ ] Protéger toutes les actions
   - [ ] Google OAuth frontend
   - [ ] Appels API avec token

3. **Before Production:**
   - [ ] Tester tous les cas d'usage (voir TESTING_CHECKLIST.md)
   - [ ] Configurer CORS
   - [ ] Migrer vers cookies HttpOnly
   - [ ] Ajouter refresh tokens

---

## 📞 Documentation Complète

Besoin de plus d'infos? Consulter:

- **IMPLEMENTATION_SUMMARY.md** - Qu'est-ce qui a été fait?
- **AUTHENTICATION_GUIDE.md** - Comment utiliser?
- **TESTING_CHECKLIST.md** - Comment tester?
- **INTEGRATION_POINTS.md** - Points d'intégration?
- **README_AUTH.md** - Index de tout

---

## 🎓 Conceptuellement

```
User says "Connexion" 
         ↓
Redirect to /login
         ↓
S'inscrire ou Login
         ↓
Backend envoie token (JWT)
         ↓
Frontend sauvegarde dans localStorage
         ↓
Frontend valide token avec GET /auth/me
         ↓
AuthContext charge user data
         ↓
Navbar affiche profile icon
         ↓
User peut faire actions (Add to cart, etc)
         ↓
Si clic logout → token supprimé
         ↓
Navbar revient à "Connexion" button
```

---

**Prêt à coder? 🚀**

*Utilisez `useAuth()` dans n'importe quel composant pour accéder au système d'authentification.*

