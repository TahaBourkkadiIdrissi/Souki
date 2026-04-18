# Guide d'Utilisation - Système d'Authentification SOUKI

## 📋 Vue d'ensemble

Le système d'authentification global pour l'application SOUKI utilise:
- **Backend**: Endpoint `GET /auth/me` pour valider les tokens JWT
- **Frontend**: Context API + localStorage pour gérer l'état d'authentification global
- **Architecture**: Redirection automatique au login si l'utilisateur n'est pas connecté

---

## 🔧 Comment utiliser le système d'authentification

### 1. **Hook useAuth()** - Accéder à l'état d'authentification

```typescript
import { useAuth } from "@/hooks/useAuth"

export function MyComponent() {
  const { user, token, isAuthenticated, isLoading, login, logout, validateToken } = useAuth()

  // Utiliser l'état
  if (isLoading) return <div>Chargement...</div>

  return (
    <div>
      {isAuthenticated ? (
        <>
          <p>Connecté en tant que: {user?.email}</p>
          <button onClick={logout}>Déconnexion</button>
        </>
      ) : (
        <p>Non connecté</p>
      )}
    </div>
  )
}
```

### 2. **Protéger une action** - Rediriger vers login si non connecté

```typescript
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"

export function ProductCard() {
  const { isAuthenticated } = useAuth()
  const router = useRouter()

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      router.push("/login") // Rediriger vers login
      return
    }
    // Ajouter au panier
  }

  return <button onClick={handleAddToCart}>Ajouter au panier</button>
}
```

### 3. **Appels API protégés** - Utiliser le token Bearer

```typescript
import { useAuth } from "@/hooks/useAuth"

export function DashboardPage() {
  const { token } = useAuth()

  const fetchUserData = async () => {
    const response = await fetch("http://localhost:8000/profile/data", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    })
    
    if (response.status === 401) {
      // Token expiré
      router.push("/login")
      return
    }
    
    return response.json()
  }
}
```

---

## 📁 Structure des fichiers

```
front-end/
├── contexts/
│   └── auth-context.tsx          # Provider d'authentification global
├── hooks/
│   └── useAuth.ts                # Hook pour accéder au context
├── lib/
│   └── api.ts                    # Client API avec gestion Bearer tokens
├── components/souki/
│   ├── navbar.tsx                # Navbar réutilisable (conditionnelle)
│   └── profile-dropdown.tsx       # Menu dropdown du profil
├── app/
│   ├── layout.tsx                # <AuthProvider> + <Navbar> wrapper
│   ├── page.tsx                  # Home page (protégée)
│   └── login/client/page.tsx      # Redirection post-login vers /

back-end/
├── controllers.py                # Endpoint GET /auth/me
├── dal.py                        # Méthode UserDao.read()
└── services.py                   # Services d'authentification
```

---

## 🔐 Backend - Endpoint /auth/me

**URL**: `GET http://localhost:8000/auth/me`

**Headers requis**:
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Réponse (200 OK)**:
```json
{
  "id": 1,
  "email": "user@example.com",
  "phone": "+212612345678",
  "role": "CLIENT",
  "is_verified": true
}
```

**Réponse (401 Unauthorized)**:
```json
{
  "detail": "Session expirée ou token invalide"
}
```

---

## 🔄 Flux d'Authentification

### **Login**:
1. Utilisateur remplit email/password sur `/login/client`
2. Submit → `POST /auth/login` → reçoit token
3. Token sauvegardé dans `localStorage`
4. Redirection vers `/` (home page)
5. AuthContext valide le token avec backend
6. Profil chargé → Navbar affiche profile icon

### **Refresh Page**:
1. Au démarrage de l'app, AuthContext lit token depuis localStorage
2. Si token existe → appel `GET /auth/me` pour validation
3. Si valide (200) → user state peuplé, `isAuthenticated = true`
4. Si invalide (401) → token supprimé, `isAuthenticated = false`
5. Navbar adaptée en fonction de l'état

### **Actions Protégées** (Add to cart, etc):
1. Vérifier `isAuthenticated` avant action
2. Si false → `router.push("/login")`
3. Si true → action normale

### **Logout**:
1. Clic "Déconnexion" dans dropdown
2. Appel `logout()` du context
3. Token supprimé de localStorage
4. User state vidé, `isAuthenticated = false`
5. Redirect vers `/` (home)
6. Navbar revient à "Connexion" button

---

## ⚙️ Configuration

### Frontend - Variables d'environnement (si nécessaire)

Créez `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Puis utilisez:
```typescript
// Dans les fichiers frontend
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
```

### Backend - Token JWT

**Durée de vie**: 7 jours (504 minutes)  
**Algorithme**: HS256  
**Secret**: Stocké dans `config.py`

---

## 🚀 Démarrage de l'Application

```bash
# Terminal 1 - Backend
cd back-end
python -m uvicorn main:app --reload

# Terminal 2 - Frontend
cd front-end
npm run dev
```

Accès:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`

---

## 🧪 Scénarios de Test

### Test 1: Sans authentification
1. Accéder à `http://localhost:3000`
2. ✅ Navbar affiche "Connexion" button
3. Cliquer sur "Ajouter au panier"
4. ✅ Redirigé vers `/login`

### Test 2: Login et profil
1. Aller à `/login/client`
2. S'inscrire: email test@example.com, password: 123456
3. Se connecter avec mêmes identifiants
4. ✅ Redirected vers `/`
5. ✅ Navbar affiche profile icon (avatarTH)
6. Cliquer profile icon
7. ✅ Dropdown affiche email, role, options

### Test 3: Refresh et persistance
1. Être connecté (voir profile icon)
2. F5 refresh page
3. ✅ Token validé avec backend
4. ✅ Profile icon reste visible (pas de flash)
5. Ouvrir DevTools → Application → localStorage
6. ✅ Token présent dans localStorage

### Test 4: Logout
1. Être connecté
2. Cliquer profile dropdown → "Déconnexion"
3. ✅ Redirigé vers `/`
4. ✅ Navbar revient à "Connexion" button
5. F5 refresh
6. ✅ Toujours "Connexion" button

### Test 5: Actions protégées
1. Sans être connecté
2. Tous les boutons d'action → redirigent `/login`
3. Après login, boutons fonctionnent normalement

---

## ❌ Dépannage

### Issue: "useAuth must be used within AuthProvider"
**Solution**: Vérifier que `<AuthProvider>` enveloppe votre component dans `layout.tsx`

### Issue: Navbar ne s'affiche pas sur toutes les pages
**Solution**: Navbar est dans `layout.tsx`. Elle devrait apparaître partout. Vérifier les imports.

### Issue: Token non sauvegardé après login
**Solution**: Vérifier que `localStorage.setItem("token", data.access_token)` est appelé après login réussi

### Issue: 401 Unauthorized sur GET /auth/me
**Solution**: 
- Token expiré (après 7 jours)
- Token malformé dans localStorage
- Secret key ne correspond pas entre frontend/backend

### Issue: Profile icon ne s'affiche pas après login
**Solution**: 
- Vérifier que backend endpoint `GET /auth/me` fonctionne (test via Postman)
- Vérifier console navigateur pour erreurs
- Vérifier que `isLoading` passe à `false` après validation

---

## 📝 Notes pour les développeurs

1. **localStorage** est utilisé sans HttpOnly flag. Pour production, migrer vers cookies HttpOnly + refresh tokens
2. **Token validation** se fait au startup uniquement (une seule fois). Pour plus de sécurité, valider à chaque navigation
3. **Navbar globale** évite la duplication mais oblige tous les enfants à avoir accès au context
4. **Erreurs 401** lors d'appels API doivent net toyer le token et rediriger vers login
5. **CORS** doit être configuré côté backend pour accepter requests du frontend

---

## 📚 Liens Utiles

- [Next.js App Router](https://nextjs.org/docs/app)
- [React Context API](https://react.dev/reference/react/useContext)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [JWT Authentication](https://jwt.io)

