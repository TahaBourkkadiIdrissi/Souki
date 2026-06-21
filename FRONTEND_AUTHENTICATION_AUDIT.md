# Frontend Authentication & Logout Implementation Audit

## Executive Summary
This document provides a comprehensive overview of the authentication system, logout functionality, and profile selection components in the Souki frontend codebase. The authentication system is centralized using a React Context (AuthContext) with role-based access control.

---

## 1. LOGOUT FUNCTIONALITY & REDIRECTION

### 1.1 Core Logout Implementation
**File**: [contexts/auth-context.tsx](contexts/auth-context.tsx)

#### Logout Function (Lines 329-332):
```typescript
const logout = async () => {
  await syncAuthState(null)
}
```

#### State Clearing via syncAuthState (Lines 169-194):
```typescript
const syncAuthState = async (nextToken: string | null): Promise<User | null> => {
  if (!nextToken) {
    localStorage.removeItem("token")        // Remove token from storage
    setToken(null)                          // Clear token state
    setUser(null)                           // Clear user data
    setIsAuthenticated(false)               // Mark as unauthenticated
    return null
  }
  // ... rest of sync logic
}
```

**Key Behavior**: 
- Clears localStorage token
- Resets React state (token, user, isAuthenticated)
- Does NOT automatically redirect

### 1.2 Redirect Implementations by Component

#### A. Profile Dropdown Logout
**File**: [components/souki/profile-dropdown.tsx](components/souki/profile-dropdown.tsx)

**Lines 69-76** - handleLogout and handleSwitchAccount:
```typescript
const handleLogout = async () => {
  await logout()
  setIsOpen(false)
  window.location.assign("/login?logged_out=1")  // Redirect with logged_out flag
}

const handleSwitchAccount = async () => {
  await logout()
  setIsOpen(false)
  window.location.assign("/login?switch=1")      // Redirect with switch flag
}
```

**Redirection Pattern**:
- **Normal logout**: `/login?logged_out=1`
- **Account switch**: `/login?switch=1`
- Uses `window.location.assign()` for hard page navigation

#### B. Settings Page (Parametres) Logout
**File**: [app/parametres/page.tsx](app/parametres/page.tsx)

**Lines 194-195** - Disconnect functions:
```typescript
const onDisconnectAll = async () => { 
  await securityApi.disconnectAll(); 
  logout(); 
  router.push("/login/client")  // Redirect to client login
}

const onDeleteAccount = async () => { 
  await securityApi.deleteAccount("SUPPRIMER"); 
  logout(); 
  router.push("/app?page=deleted")  // Redirect to account deleted page
}
```

#### C. Supplier Profile Logout
**File**: [app/supplier/profil/page.tsx](app/supplier/profil/page.tsx)

**Lines 103-109** - handleLogout:
```typescript
const handleLogout = async () => {
  setLoggingOut(true)
  try {
    await logout()
    window.location.assign("/login?logged_out=1")  // Same pattern as profile dropdown
  } finally {
    setLoggingOut(false)
  }
}
```

#### D. Admin Logout
**Files**: 
- [app/admin/page.tsx](app/admin/page.tsx) - Lines 387-388
- [app/admin/pricing/page.tsx](app/admin/pricing/page.tsx) - Lines 340-341

```typescript
const handleAdminLogout = async () => {
  await logout()
  // No explicit redirect - relies on route guard to redirect to login
}
```

### 1.3 Summary of Redirect Destinations

| Component | Endpoint | Query Params | Notes |
|-----------|----------|--------------|-------|
| Profile Dropdown (Main) | `/login` | `logged_out=1` | Uses `window.location.assign()` |
| Profile Dropdown (Switch) | `/login` | `switch=1` | Uses `window.location.assign()` |
| Settings - Disconnect All | `/login/client` | None | Uses `router.push()` |
| Settings - Delete Account | `/app` | `page=deleted` | Uses `router.push()` |
| Supplier Profile | `/login` | `logged_out=1` | Uses `window.location.assign()` |
| Admin Pages | N/A | N/A | Relies on route guard |

---

## 2. AUTHENTICATION-RELATED PAGES & COMPONENTS

### 2.1 Login Pages Structure

#### Main Login Router: [app/login/page.tsx](app/login/page.tsx)
- Shows role selection at entry point
- Supports login and signup modes
- 3 role options displayed:
  - **Parent** (`/login/parent`) - "Espace parent & famille" 👨‍👩‍👧
  - **Livreur** (`/login/livreur`) - "Gérez vos livraisons" 🚚
  - Default: Client login (handled directly)

**Role Selection Code (Lines 17-35)**:
```typescript
const roles = [
  {
    title: "Parent",
    description: "Espace parent & famille",
    icon: Users,
    href: "/login/parent",
    emoji: "👨‍👩‍👧",
  },
  {
    title: "Livreur",
    description: "Gérez vos livraisons",
    icon: Truck,
    href: "/login/livreur",
    emoji: "🚚",
  },
]
```

### 2.2 Role-Specific Login Pages

#### A. Client Login
**File**: [app/login/client/page.tsx](app/login/client/page.tsx)
- Supports login and signup modes
- Phone number-based authentication with validation
- Password strength requirements
- Redirect target: `/` (or dashboard based on user role)

#### B. Livreur (Delivery) Login  
**File**: [app/login/livreur/page.tsx](app/login/livreur/page.tsx)
- Specialized for delivery drivers
- Mandatory phone field for livreurs
- City selection (Fès, Meknès, Casablanca, Rabat)
- Redirect target: `/livreur` (default)
- Enhanced validation for phone numbers

#### C. Parent Login
**File**: [app/login/parent/page.tsx](app/login/parent/page.tsx)
- Specialized for parent/family accounts
- Same validation as client but role-specific
- Redirect target: `/` (default)

#### D. Admin Login
**File**: [app/admin/login/page.tsx](app/admin/login/page.tsx)
- Separate authentication for staff/back-office
- Email or phone login
- Redirect target: `/admin` (default) or user's default_dashboard

### 2.3 Query Parameters Handling

**File**: [app/login/page.tsx](app/login/page.tsx) - Lines 13-16:
```typescript
const redirectTarget = searchParams.get("redirect") || "/"
const switchAccount = searchParams.get("switch") === "1"
const loggedOut = searchParams.get("logged_out") === "1"
```

These parameters are:
- **redirect**: Custom redirect destination after login
- **switch**: User is switching accounts (clears session)
- **logged_out**: User just logged out (informational)

---

## 3. PROFILE SELECTION & NAVIGATION

### 3.1 Profile Dropdown Component
**File**: [components/souki/profile-dropdown.tsx](components/souki/profile-dropdown.tsx)

#### Key Features (Lines 96-122):
```typescript
const canAccessAdmin = user.permissions.includes("admin.panel.access")
const canAccessLivreur = user.permissions.includes("livreur.dashboard.access")
const canAccessParent = user.permissions.includes("parent.dashboard.access")

const effectiveRoles = new Set(
  [user.role, user.legacy_role, ...(user.roles ?? [])]
    .filter(Boolean)
    .map((r) => String(r).toUpperCase()),
)
const canAccessSupplier = effectiveRoles.has("FOURNISSEUR")
const canBecomeSupplier = !canAccessSupplier && (
  effectiveRoles.has("CLIENT") || 
  user.permissions.includes("supplier.request.create")
)
```

#### Navigation Options Displayed:
1. **Back-office** (if admin access) → `/admin`
2. **Espace livreur** (if livreur access) → `/livreur`
3. **Espace parent** (if parent access) → `/parent`
4. **Espace fournisseur** (if supplier role) → `/supplier`
5. **Devenir fournisseur** (if eligible) → `/devenir-fournisseur`
6. **Mon profil** (account info) → `/parametres/compte`
7. **Paramètres** (notifications, security, payment) → `/parametres/notifications`
8. **Historique** (order history) → `/historique`
9. **Changer de compte** (switch account) → `/login?switch=1`
10. **Se déconnecter** (logout) → `/login?logged_out=1`

### 3.2 Role-Based Access Logic

The system uses a **permission-based model**:
- Each user has `permissions` array (e.g., "admin.panel.access")
- Falls back to `roles` array for role-checking
- Supports `legacy_role` for backward compatibility

**Example from profile dropdown (Lines 56-70)**:
```typescript
const dashboardTarget =
  canAccessAdmin ? "/admin" : 
  canAccessLivreur ? "/livreur" : 
  canAccessParent ? "/parent" : 
  null

const roleLabel = user.roles.length > 0 ? user.roles.join(" · ") : user.role
```

---

## 4. AUTHENTICATION CONTEXT & HOOKS

### 4.1 Auth Context Type
**File**: [contexts/auth-context.tsx](contexts/auth-context.tsx)

**Lines 6-27** - AuthContextType interface:
```typescript
interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (loginId: string, password: string, role?: string) => Promise<User>
  adminLogin: (loginId: string, password: string) => Promise<User>
  googleLogin: (googleToken: string, role?: string) => Promise<User>
  logout: () => Promise<void>
  validateToken: () => Promise<boolean>
  hasRole: (role: string) => boolean
  can: (permission: string) => boolean
}
```

### 4.2 useAuth Hook
**File**: [hooks/useAuth.ts](hooks/useAuth.ts)

Simple wrapper around AuthContext:
```typescript
import { useAuthContext } from "@/contexts/auth-context"

export function useAuth() {
  return useAuthContext()
}
```

### 4.3 User Data Structure
**File**: [contexts/auth-context.tsx](contexts/auth-context.tsx) - Lines 6-17:
```typescript
export interface User {
  id: number
  email?: string
  phone?: string
  role: string
  legacy_role?: string | null
  roles: string[]                    // Multi-role support
  permissions: string[]              // Permission-based access
  is_verified: boolean
  is_active: boolean
  default_dashboard: string
}
```

---

## 5. SESSION MANAGEMENT

### 5.1 Token Storage
**File**: [contexts/auth-context.tsx](contexts/auth-context.tsx)

- **Storage Method**: `localStorage` with key `"token"`
- **Token Format**: Bearer token (JWT)
- **Validation**: Sends to `/auth/me` endpoint with Authorization header

### 5.2 Session Security Features
**File**: [app/parametres/page.tsx](app/parametres/page.tsx)

#### Available Session Controls:
- **View active sessions**: Shows device name, location, last activity
- **Disconnect individual sessions**: Removes specific session
- **Disconnect all sessions**: Logs out from all devices
- **Delete account**: Permanent account deletion

#### Session Data Structure:
```typescript
{
  id: number
  device_name?: string
  browser?: string
  location?: string
  is_current: boolean
  last_active: string | null
}
```

### 5.3 Security-Related Hooks
**File**: [hooks/useSecurity.ts](hooks/useSecurity.ts) - Lines 24-33:
```typescript
const disconnectSession = useCallback(
  (id: number) => callApi<void>(`/api/user/sessions/${id}`, "DELETE"),
  [callApi]
)

const disconnectAll = useCallback(() => 
  callApi<{ success: boolean }>("/api/user/sessions", "DELETE"), 
  [callApi]
)

const deleteAccount = useCallback(
  (confirmation: string) => 
    callApi<void>("/api/user/account", "DELETE", { confirm: confirmation }),
  [callApi]
)
```

---

## 6. RECENT CHANGES & GIT HISTORY

### 6.1 Recent Commits (Last 2 weeks)
Key commits related to authentication and mobile:
- **6451cec**: "feat: add context-aware PWA welcome experience"
- **7fe2ece**: "fix(frontend): nettoyer les paramètres de redirection du RouteGuard..." (PWA support)
- **5d86c1e**: "Configuration routage client/admin/navigation"

### 6.2 Logout-Related Changes
The codebase shows a consistent pattern for logout redirection:
- Uses `window.location.assign()` in profile dropdown for hard navigation
- Uses `router.push()` in next.js pages for soft navigation
- No breaking changes detected in logout flow

---

## 7. SUMMARY OF KEY FILES

| File | Purpose | Key Functions |
|------|---------|---------------|
| `contexts/auth-context.tsx` | Central auth state & logic | `logout()`, `syncAuthState()`, token validation |
| `hooks/useAuth.ts` | Auth hook wrapper | `useAuth()` - returns context |
| `components/souki/profile-dropdown.tsx` | User profile menu | `handleLogout()`, `handleSwitchAccount()` |
| `app/login/page.tsx` | Role selection & login | Role selection, login dispatch |
| `app/login/client/page.tsx` | Client login page | Phone-based login/signup |
| `app/login/livreur/page.tsx` | Delivery driver login | Livreur-specific forms |
| `app/login/parent/page.tsx` | Parent account login | Parent-specific forms |
| `app/login/admin/page.tsx` | Admin login | Staff authentication |
| `app/parametres/page.tsx` | Settings/preferences | Session management, account deletion |
| `app/supplier/profil/page.tsx` | Supplier profile | Supplier info, logout |

---

## 8. LOGOUT FLOW DIAGRAM

```
User clicks "Se déconnecter"
         ↓
  handleLogout() in ProfileDropdown
         ↓
  await logout() [auth-context]
         ↓
  syncAuthState(null)
         ↓
  ├─ localStorage.removeItem("token")
  ├─ setToken(null)
  ├─ setUser(null)
  └─ setIsAuthenticated(false)
         ↓
  window.location.assign("/login?logged_out=1")
         ↓
  User redirected to login page with logout indicator
```

---

## 9. PERMISSION-BASED ACCESS CONTROL

### 9.1 Permissions Model
The system uses granular permissions:

**Admin Permissions**:
- `admin.panel.access` - Access to back-office

**Role Permissions**:
- `livreur.dashboard.access` - Delivery driver dashboard
- `parent.dashboard.access` - Parent/family dashboard
- `supplier.request.create` - Request supplier status

### 9.2 Usage Pattern
```typescript
const { can, hasRole } = useAuth()

// Check permission
if (user.permissions.includes("admin.panel.access")) { ... }

// Or use helper
if (can("admin.panel.access")) { ... }
if (hasRole("ADMIN")) { ... }
```

---

## 10. RECOMMENDATIONS & OBSERVATIONS

### Observations:
1. **Consistent Logout Pattern**: Both profile dropdown and supplier pages use `window.location.assign("/login?logged_out=1")`
2. **Multiple Redirect Destinations**: Different pages redirect to different locations after logout (inconsistency)
3. **Role-Based Access**: System supports multiple roles per user with permission-based checks
4. **Token Persistence**: Token is stored in localStorage for persistence across sessions
5. **Session Management**: Advanced session control with per-device disconnection

### Potential Improvements:
1. **Standardize Logout Redirects**: Consider consolidating logout destinations (e.g., always `/login`)
2. **Logout Indicators**: Query params (`logged_out=1`, `switch=1`) provide context but aren't utilized in login UI
3. **Error Handling**: Add error handling for logout failures (e.g., network errors during session termination)
4. **Analytics**: Consider tracking logout events for usage analytics

---

## Document Metadata
- **Generated**: 2026-06-20
- **Codebase**: Souki (Fresh Market Platform)
- **Frontend Framework**: Next.js 15+ with React Context
- **Authentication Method**: JWT Bearer Token
- **Role System**: Multi-role with permission-based access control
