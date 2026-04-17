# 🔗 Points d'Intégration - Système d'Authentification SOUKI

Ce document énumère tous les points d'intégration et interactions du système d'authentification avec le reste de l'application.

---

## 📌 Points d'Intégration Critiques

### 1. **AuthProvider dans RootLayout** ✅ *IMPLÉMENTÉ*

**Fichier**: `front-end/app/layout.tsx`

**Intégration**:
```typescript
<AuthProvider>
  <ThemeProvider>
    <Navbar />
    {children}
  </ThemeProvider>
</AuthProvider>
```

**Points clés**:
- AuthProvider doit envelopper **toute** l'application
- Validation du token se fait au démarrage ici
- Tous les composants enfants ont accès à `useAuth()`

**❓ À vérifier**: Aucun composant n'utilise auth en dehors du provider

---

### 2. **Navbar Globale vs Page-Specific** ✅ *IMPLÉMENTÉ*

**Ancien**: Navbar dans chaque page (app/page.tsx avait sa propre navbar)  
**Nouveau**: Navbar centralisée dans layout.tsx

**Points clés**:
- La navbar du layout s'affiche sur **toutes** les pages
- Si besoin d'une navbar différente sur certaines pages, créer un wrapper/conditional
- État de la navbar (connecté/pas connecté) mis à jour globalement

**❓ À vérifier**: Les autres pages (/login, /profile, /catalogue, etc) ont-elles besoin d'une navbar différente?

---

### 3. **Redirect Post-Login** ✅ *IMPLÉMENTÉ*

**Ancien**: `/dashboard` (page n'existe pas)  
**Nouveau**: `/` (home page)

**Fichier**: `front-end/app/login/client/page.tsx`

**Points clés**:
```typescript
// Ancien
router.push("/dashboard") // ❌ Route n'existe pas

// Nouveau
router.push("/") // ✅ Home page existe
```

**À considérer**:
- Après login, où devrait-on redirect l'utilisateur?
  - Option 1: Home page (✅ actuel)
  - Option 2: Dashboard utilisateur (nécessite page /dashboard)
  - Option 3: Dernière page visitée (sessionStorage)

**❓ À décider**: Devrait-on créer un /dashboard séparé ou garder home?

---

### 4. **Actions Protégées dans Home Page** ✅ *IMPLÉMENTÉ*

**Fichier**: `front-end/app/page.tsx`

**Implémenté**:
```typescript
const handleAddToCart = () => {
  if (!isAuthenticated) {
    router.push("/login")
    return
  }
  // Action...
}
```

**Points clés**:
- Chaque action/bouton sensible protect avec cette logique
- Redirect vers /login avant action
- UX: Message "Connectez-vous pour continuer" (optional toast)

**À implémenter dans d'autres pages**:
- [ ] `/catalogue` - Same protection
- [ ] `/abonnements` - Same protection  
- [ ] `/profile` - Redirect to /login if not authed
- [ ] `/dashboard` (si créé) - Redirect to /login if not authed

---

### 5. **Appels API Protégés** ⚠️ *À IMPLÉMENTER*

**Utilisation**: Quand on appelle des endpoints backend qui nécessitent un token

**Pattern à utiliser**:
```typescript
const { token } = useAuth()

const response = await fetch("http://localhost:8000/profile/address", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify(data)
})

if (response.status === 401) {
  // Token expiré, logout
  logout()
  router.push("/login")
}
```

**Endpoints à protéger**:
- [ ] `POST /profile/address` - Ajouter adresse
- [ ] `GET /profile/orders` - Récupérer commandes (à créer)
- [ ] `POST /orders` - Créer commande (à créer)
- [ ] `GET /user/wallet` - Solde wallet (si implémenté)

---

### 6. **Gestion des Erreurs 401** ⚠️ *PARTIELEMENT IMPLÉMENTÉ*

**Actuellement**: Automatique dans AuthContext au startup

**À améliorer**: Gérer 401 sur appels API faits après le login

**Pattern à ajouter**:
```typescript
// Dans chaque composant qui fait des appels API
if (response.status === 401) {
  logout() // Vider le state
  router.push("/login")
}
```

**Ou créer un interceptor global** (bonus):
```typescript
// lib/api.ts - Ajouter une fonction wrapper
export async function apiCallWithAuth(endpoint, options) {
  const response = await apiCall(endpoint, options)
  
  if (response.status === 401) {
    // Auto-logout et redirect
    dispatch(logout())
    router.push("/login")
  }
  
  return response
}
```

---

### 7. **Profile Page** ⚠️ *À CRÉER*

**Actuellement**: Référencé dans ProfileDropdown mais page n'existe pas

**À créer**: `front-end/app/profile/page.tsx`

**Besoins**:
- [ ] Page protégée (redirect si pas authed)
- [ ] Afficher données utilisateur (email, phone, role)
- [ ] Form pour éditer profil (nom, adresse)
- [ ] Bouton pour changer password
- [ ] Section "Mes commandes"
- [ ] Section "Mes adresses"
- [ ] Bouton "Déconnexion"

**Exemple structure**:
```typescript
"use client"
import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"

export default function ProfilePage() {
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()

  if (!isAuthenticated) {
    router.push("/login")
    return null
  }

  return (
    <div>
      <h1>Mon Profil</h1>
      <p>Email: {user?.email}</p>
      {/* Rest of profile content */}
    </div>
  )
}
```

---

### 8. **Intégration Google OAuth** ⚠️ *BACKEND OK, FRONTEND À FAIRE*

**Backend**: `/auth/google-login` existe déjà ✅

**À implémenter frontend**:
- [ ] Installer `@react-oauth/google`
- [ ] Ajouter GoogleLoginButton sur /login pages
- [ ] Récupérer token Google
- [ ] Appeler `POST /auth/google-login` avec token
- [ ] Même logique que login normal (save token, redirect home)

**Exemple**:
```typescript
import { GoogleLogin } from '@react-oauth/google'

export function LoginPage() {
  const handleGoogleSuccess = async (credentialResponse) => {
    const response = await fetch("/auth/google-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: credentialResponse.credential })
    })
    
    const data = await response.json()
    localStorage.setItem("token", data.access_token)
    router.push("/")
  }

  return (
    <GoogleLogin onSuccess={handleGoogleSuccess} />
  )
}
```

---

### 9. **Rôles et Permissions** ⚠️ *À IMPLÉMENTER*

**Actuellement**: Only storing `role` field, no permission check

**À ajouter**:
```typescript
// hooks/useAuth.ts - Ajouter helper
export function useAuth() {
  const context = useAuthContext()
  
  return {
    ...context,
    // Helpers
    isCLIENT: () => context.user?.role === "CLIENT",
    isPARENT: () => context.user?.role === "PARENT",
    isLIVREUR: () => context.user?.role === "LIVREUR",
    hasRole: (role: string) => context.user?.role === role
  }
}
```

**Usage**:
```typescript
const { isCLIENT, isPARENT } = useAuth()

if (!isCLIENT) {
  return <NotAuthorized />
}
```

---

### 10. **Persévérance d'état entre Tabs** ⚠️ *BONUS - À IMPLÉMENTER*

**Actuellement**: Si on se logout dans un tab, l'autre tab reste connecté

**À ajouter** (bonus):
```typescript
// AuthContext - Ajouter listener
useEffect(() => {
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === "token") {
      if (e.newValue === null) {
        // Token supprimé dans autre tab
        logout()
      } else {
        // Token changé
        validateTokenWithBackend(e.newValue)
      }
    }
  }

  window.addEventListener("storage", handleStorageChange)
  return () => window.removeEventListener("storage", handleStorageChange)
}, [])
```

---

## 🔄 Flux de Données Complet

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER INTERACTION                             │
└──────────────────────┬──────────────────────────────────────────┘
                       ▼
            Home Page → Click "Add to Cart"
                       ▼
        ┌─────────────────────────────┐
        │ Check: isAuthenticated?     │
        └──────┬────────────┬─────────┘
             NO │            │ YES
               ▼             ▼
         Redirect       Execute
         to /login      Action
               ▼             ▼
        ┌──────────┐   ┌──────────────┐
        │Login     │   │API Call with │
        │Register  │   │Bearer Token  │
        └────┬─────┘   └──────┬───────┘
             │                 ▼
             │         ┌───────────────┐
             │         │Response API   │
             │         │200 OK or 401? │
             │         └──┬────────┬───┘
             │          OK│        │401
             │            ▼        ▼
             │          Update  Logout +
             │          State    Redirect
             │            ▼        ▼
             │            ├──────→/login
             │            │
             ▼            ▼
        POST /login  localStorage
        with JWT      Updated
             ▼
        ┌──────────────┐
        │GET /auth/me  │ ← Validate token
        │(Verify User) │
        └──────┬───────┘
             ▼
        Update AuthContext
        with user data
             ▼
        Redirect to /
             ▼
        Navbar displays
        Profile Icon
```

---

## 📋 Checklist d'Intégration des Autres Équipes

### Frontend - Pages à Adapter

- [ ] `/catalogue` - Protéger actions, afficher produits
- [ ] `/abonnements` - Protéger achat abonnement
- [ ] `/profile` - Créer cette page
- [ ] `/dashboard` - Créer si nécessaire (ou utiliser /profile)
- [ ] `/orders` - Afficher commandes utilisateur
- [ ] Toute page avec action → check `useAuth().isAuthenticated`

### Backend - À Vérifier

- [ ] `GET /auth/me` endpoint implémenté ✅
- [ ] Toutes routes sensibles requièrent token ✅
- [ ] Erreur 401 retournée si token invalide ✅
- [ ] CORS configuré pour frontend
- [ ] `get_current_user` utilisé sur toutes routes sensibles ✅
- [ ] Tester endpoints via Swagger UI

### DevOps / Infra

- [ ] SSL/HTTPS activé (production)
- [ ] Secure cookies (HttpOnly flag)
- [ ] CORS headers configurés correctement
- [ ] Token secret (SECRET_KEY) secure
- [ ] Rate limiting sur /auth/login

---

## ⚠️ Points Critiques à Surveiller

1. **Fuite d'authentification**: Vérifier aucune route sensible accessible sans auth
2. **CORS**: Frontend et backend sur ports différents, CORS MUST être config
3. **Token sécurité**: localStorage ok pour MVP, migrer vers HttpOnly cookies pour prod
4. **Expiration**: Token JWT expire après 7 jours, need refresh mechanism
5. **Multi-device**: Même user sur 2 devices = 2 tokens différents (normal)

---

## 🚀 Prochaines Étapes

1. **Court terme** (Cette semaine):
   - [ ] Valider tous les points d'intégration
   - [ ] Créer page `/profile`
   - [ ] Protéger toutes pages/actions
   - [ ] Testing complet

2. **Moyen terme** (Prochaines semaines):
   - [ ] Ajouter Google OAuth frontend
   - [ ] Implémenter permission checks
   - [ ] Ajouter refresh tokens
   - [ ] Migrer localStorage → cookies

3. **Long terme** (Production):
   - [ ] 2FA
   - [ ] Audit logging
   - [ ] RBAC complet
   - [ ] Session management multi-device

---

**Intégration en cours... ✅**

*Maintenir ce document à jour au fur et à mesure des changements.*

