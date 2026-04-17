# 📚 Documentation - Système d'Authentification SOUKI

Bienvenue dans la documentation complète du système d'authentification global de SOUKI!

---

## 📖 Guides Disponibles

### 1. **IMPLEMENTATION_SUMMARY.md** 📋
**Pour qui?** Les développeurs qui veulent comprendre exactement ce qui a été fait.

**Contient**:
- Résumé complet des changements
- Fichiers modifiés/créés avec descriptions détaillées
- Flux d'exécution complet
- Compilation et vérifications
- Notes importantes et points forts

**À lire d'abord** ✅

---

### 2. **AUTHENTICATION_GUIDE.md** 🔐
**Pour qui?** Les développeurs qui vont utiliser le système.

**Contient**:
- Guide d'utilisation du hook `useAuth()`
- Comment protéger des actions
- Exemple d'appels API protégés
- Documentation complète de l'architecture
- Configuration et démarrage
- Dépannage et solutions
- Scénarios de test

**À consulter lors du développement** 📖

---

### 3. **TESTING_CHECKLIST.md** ✅
**Pour qui?** Les QA/testeurs ou avant de déployer.

**Contient**:
- Checklist complète de déploiement
- 8 suites de tests détaillées
- Cas de test spécifiques avec étapes
- Résultats attendus
- Gestion des erreurs
- Notes finales

**À utiliser avant production** 🚀

---

### 4. **back-end/test_auth.py** 🧪
**Pour qui?** Tester rapidement l'endpoint backend.

**Utilisation**:
```bash
cd back-end
python test_auth.py
```

**Teste**: Login, validation token, erreurs

---

## 🗂️ Structure des Fichiers

```
SOUKI/
├── 📄 IMPLEMENTATION_SUMMARY.md      ← Commencer ici
├── 📄 AUTHENTICATION_GUIDE.md         ← Guide d'utilisation
├── 📄 TESTING_CHECKLIST.md            ← Checklist de test
├── 📄 README_AUTH.md                  ← Ce fichier
│
├── back-end/
│   ├── controllers.py                  [✅ Modifié - GET /auth/me ajouté]
│   ├── dal.py                          [✅ Modifié - UserDao.read() ajouté]
│   ├── test_auth.py                    [✅ Nouveau - Test script]
│   └── ... (autres fichiers unchanged)
│
└── front-end/
    ├── contexts/
    │   └── auth-context.tsx            [✅ Nouveau - Auth provider]
    │
    ├── hooks/
    │   └── useAuth.ts                  [✅ Nouveau - useAuth hook]
    │
    ├── lib/
    │   └── api.ts                      [✅ Nouveau - API client]
    │
    ├── components/souki/
    │   ├── navbar.tsx                  [✅ Nouveau - Global navbar]
    │   ├── profile-dropdown.tsx         [✅ Nouveau - Profile menu]
    │   └── ... (autres components unchanged)
    │
    ├── app/
    │   ├── layout.tsx                  [✅ Modifié - AuthProvider wrapper]
    │   ├── page.tsx                    [✅ Modifié - Actions protégées]
    │   ├── login/client/page.tsx       [✅ Modifié - Redirect après login]
    │   └── ... (autres pages unchanged)
    │
    └── ... (autres fichiers unchanged)
```

---

## 🚀 Quick Start

### Démarrage rapide (3 étapes)

```bash
# Terminal 1: Backend
cd back-end
python -m uvicorn main:app --reload

# Terminal 2: Frontend
cd front-end
npm run dev

# Terminal 3: Test backend (optionnel)
cd back-end
python test_auth.py
```

**URLs**:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`

---

## 🎯 Cas d'Usage Courants

### 1. Ajouter une page protégée

```typescript
"use client"
import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"

export default function DashboardPage() {
  const { isAuthenticated } = useAuth()
  const router = useRouter()

  if (!isAuthenticated) {
    router.push("/login")
  }

  return <div>Dashboard (seulement si connecté)</div>
}
```

### 2. Protéger une action

```typescript
const { isAuthenticated } = useAuth()
const router = useRouter()

const handleProtectedAction = () => {
  if (!isAuthenticated) {
    router.push("/login")
    return
  }
  // Faire l'action
}
```

### 3. Afficher profil utilisateur

```typescript
const { user, isAuthenticated } = useAuth()

if (isAuthenticated && user) {
  return <div>Bienvenue {user.email}!</div>
}
```

### 4. Appel API protégé

```typescript
const { token } = useAuth()

const fetchUserData = async () => {
  const response = await fetch("/api/user", {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  })
  // Gérer la réponse
}
```

---

## ❓ FAQ

### Q: Le système utilise localStorage, c'est sûr?
**A**: Pour MVP oui. Pour production, utiliser cookies HttpOnly + refresh tokens. Voir [AUTHENTICATION_GUIDE.md](AUTHENTICATION_GUIDE.md#configuration).

### Q: Peut-on ajouter d'autres rôles (ADMIN, SUPER_ADMIN)?
**A**: Oui! Le système support déjà les rôles. Juste ajouter dans `User.role` et mettre en place permission checks.

### Q: Comment rafraîchir le profil utilisateur?
**A**: Appeler `validateToken()` du hook useAuth() pour forcer une re-validation.

### Q: Que faire si le token expire pendant une action?
**A**: Capturer l'erreur 401 et redirigé vers /login. Voir [AUTHENTICATION_GUIDE.md](AUTHENTICATION_GUIDE.md#dépannage).

### Q: Peut-on utiliser Google OAuth?
**A**: Oui! Backend a déjà `/auth/google-login`. À intégrer frontend.

### Q: Comment logger out l'utilisateur automatiquement après inactivité?
**A**: À implémenter: setInterval qui valide token periodiquement.

---

## 📞 Support & Dépannage

### Erreurs Courantes

| Erreur | Solution |
|--------|----------|
| "useAuth must be used within AuthProvider" | Vérifier `<AuthProvider>` dans layout.tsx |
| Token non sauvegardé | Vérifier localStorage.setItem dans login |
| 401 Unauthorized | Token expiré ou invalide, logout automatique |
| Profile ne s'affiche pas | Vérifier GET /auth/me backend + console errors |

**Plus de détails**: Voir [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md#-dépannage)

---

## ✅ Checklist de Mise en Production

- [ ] Tous les tests TESTING_CHECKLIST.md passent
- [ ] Backend e frontend compilent sans erreurs
- [ ] Token validé auprès du backend
- [ ] Erreurs 401 gérées gracieusement
- [ ] localStorage sécurisé (voir notes)
- [ ] CORS configuré correctement
- [ ] `.env` correctement configuré (SECRET_KEY, etc)
- [ ] SSL/HTTPS activé (production)
- [ ] Monitoring des erreurs d'auth (Sentry, etc)

---

## 📊 Architecture Vue d'ensemble

```
┌─────────────────────────────────┐
│   Front-end (Next.js + React)   │
│                                  │
│  ┌────────────────────────────┐  │
│  │   AuthProvider (Context)   │  │
│  │  - user                    │  │
│  │  - token                   │  │
│  │  - isAuthenticated         │  │
│  │  - login/logout/validate   │  │
│  └────────────────────────────┘  │
│              ▲                    │
│      useAuth() hook              │
│              ▲                    │
│  ┌─────────────────────────────┐ │
│  │  Navbar (Conditionnelle)   │ │
│  │  ProfileDropdown           │ │
│  │  Protected Components      │ │
│  └─────────────────────────────┘ │
└─────────────────────────────────┘
          │
          │ Bearer Token
          │ localStorage
          ▼
┌─────────────────────────────────┐
│   Back-end (FastAPI)            │
│                                  │
│  ┌────────────────────────────┐  │
│  │  POST /auth/login          │  │
│  │  POST /auth/register       │  │
│  │  GET /auth/me ✅ Nouveau   │  │
│  │  POST /auth/google-login   │  │
│  └────────────────────────────┘  │
│              ▲                    │
│      JWT Token Validation        │
│              ▲                    │
│  ┌─────────────────────────────┐ │
│  │  Database (PostgreSQL)      │ │
│  │  t_users table              │ │
│  │  t_addresses (related)      │ │
│  └─────────────────────────────┘ │
└─────────────────────────────────┘
```

---

## 📚 Ressources Supplémentaires

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [React Context API](https://react.dev/reference/react/useContext)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [JWT.io - JWT Debugger](https://jwt.io)
- [Bearer Token Documentation](https://tools.ietf.org/html/rfc6750)

---

## ✨ Améliorations Futures

- [ ] Ajouter refresh tokens
- [ ] Migrer localStorage vers cookies HttpOnly
- [ ] Validation token périodique
- [ ] 2FA (Two-Factor Authentication)
- [ ] OAuth2 Google/Facebook
- [ ] Rate limiting sur login
- [ ] Audit logging des logins
- [ ] Permission-based access control (RBAC)
- [ ] Multi-device session management

---

## 📄 Versions & Dates

| Version | Date | Changements |
|---------|------|-------------|
| 1.0 | 15 Avril 2026 | ✅ Implémentation initiale complète |

---

**Documentation compilée pour SOUKI Fresh Market 🥬**

*Dernière mise à jour: 15 Avril 2026*

