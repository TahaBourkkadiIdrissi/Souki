import type { User } from "@/contexts/auth-context"

export type AppRole =
  | "PUBLIC"
  | "CLIENT"
  | "PARENT"
  | "LIVREUR"
  | "FOURNISSEUR"
  | "ADMIN"
  | "OPS_MANAGER"
  | "CATALOG_MANAGER"
  | "FINANCE_MANAGER"
  | "SUPPORT_AGENT"
  | "ADMIN_SUPER"

export type RouteMatchMode = "exact" | "prefix"

export type RouteConfig = {
  path: string
  label: string
  match?: RouteMatchMode
  authRequired: boolean
  allowedRoles?: AppRole[]
  requiredPermissions?: string[]
  blockedRoles?: AppRole[]
  blockedPermissions?: string[]
  guestOnly?: boolean
  allowAuthenticatedWithIntent?: boolean
  loginPath?: string
  fallbackPath?: string
}

const ADMIN_ROLES: AppRole[] = [
  "ADMIN",
  "OPS_MANAGER",
  "CATALOG_MANAGER",
  "FINANCE_MANAGER",
  "SUPPORT_AGENT",
  "ADMIN_SUPER",
]

export const ROUTES: RouteConfig[] = [
  {
    path: "/",
    label: "Accueil public",
    authRequired: false,
    allowedRoles: ["PUBLIC", "CLIENT", "PARENT", "FOURNISSEUR"],
    blockedPermissions: ["admin.panel.access", "livreur.dashboard.access"],
  },
  {
    path: "/pwa-welcome",
    label: "Accueil application mobile",
    authRequired: false,
    allowedRoles: ["PUBLIC", "CLIENT", "PARENT", "FOURNISSEUR"],
    blockedPermissions: ["admin.panel.access", "livreur.dashboard.access"],
  },
  {
    path: "/login",
    label: "Choix du profil de connexion",
    match: "prefix",
    authRequired: false,
    allowedRoles: ["PUBLIC"],
    guestOnly: true,
    allowAuthenticatedWithIntent: true,
  },
  {
    path: "/admin/login",
    label: "Connexion back-office",
    authRequired: false,
    allowedRoles: ["PUBLIC"],
    guestOnly: true,
    allowAuthenticatedWithIntent: true,
    fallbackPath: "/admin",
  },
  {
    path: "/verify",
    label: "Verification de compte",
    authRequired: false,
    allowedRoles: ["PUBLIC", "CLIENT", "PARENT", "LIVREUR", "FOURNISSEUR"],
  },
  {
    path: "/catalogue",
    label: "Catalogue",
    authRequired: false,
    allowedRoles: ["PUBLIC", "CLIENT", "PARENT", "FOURNISSEUR"],
    blockedPermissions: ["admin.panel.access", "livreur.dashboard.access"],
  },
  {
    path: "/checkout",
    label: "Checkout",
    authRequired: true,
    allowedRoles: ["CLIENT", "PARENT", "FOURNISSEUR"],
    requiredPermissions: ["checkout.create"],
    loginPath: "/login/client",
  },
  {
    path: "/historique",
    label: "Historique commandes",
    authRequired: true,
    allowedRoles: ["CLIENT", "PARENT", "FOURNISSEUR"],
    requiredPermissions: ["orders.read_self"],
    loginPath: "/login/client",
  },
  {
    path: "/parametres",
    label: "Parametres",
    match: "prefix",
    authRequired: true,
    allowedRoles: ["CLIENT", "PARENT", "LIVREUR", "FOURNISSEUR"],
    requiredPermissions: ["profile.manage_self"],
    loginPath: "/login/client",
  },
  {
    path: "/parent",
    label: "Dashboard parent",
    authRequired: true,
    allowedRoles: ["PARENT"],
    requiredPermissions: ["parent.dashboard.access"],
    loginPath: "/login/parent",
  },
  {
    path: "/livreur",
    label: "Dashboard livreur",
    authRequired: true,
    allowedRoles: ["LIVREUR"],
    requiredPermissions: ["livreur.dashboard.access"],
    loginPath: "/login/livreur",
  },
  {
    path: "/devenir-fournisseur",
    label: "Demande fournisseur",
    match: "prefix",
    authRequired: true,
    allowedRoles: ["CLIENT"],
    // Pas de requiredPermissions : un compte CLIENT hérité (rôle dans t_users.role,
    // pas encore dans user_roles) n'a pas forcément la permission supplier.request.create.
    // Le backend protège déjà l'endpoint via require_role("CLIENT").
    loginPath: "/login/client",
  },
  {
    path: "/supplier",
    label: "Espace fournisseur",
    match: "prefix",
    authRequired: true,
    allowedRoles: ["FOURNISSEUR"],
    requiredPermissions: ["supplier.dashboard.view"],
    loginPath: "/login/client",
  },
  {
    path: "/fournisseur",
    label: "Espace fournisseur",
    match: "prefix",
    authRequired: true,
    allowedRoles: ["FOURNISSEUR"],
    requiredPermissions: ["supplier.dashboard.view"],
    loginPath: "/login/client",
  },
  {
    path: "/admin",
    label: "Back-office",
    match: "prefix",
    authRequired: true,
    allowedRoles: ADMIN_ROLES,
    requiredPermissions: ["admin.panel.access"],
    loginPath: "/admin/login",
  },
  {
    path: "/admin/orders",
    label: "Commandes back-office",
    match: "prefix",
    authRequired: true,
    allowedRoles: ADMIN_ROLES,
    requiredPermissions: ["admin.panel.access", "orders.read"],
    loginPath: "/admin/login",
  },
  {
    path: "/admin/clients",
    label: "Clients back-office",
    match: "prefix",
    authRequired: true,
    allowedRoles: ADMIN_ROLES,
    requiredPermissions: ["admin.panel.access", "clients.read"],
    loginPath: "/admin/login",
  },
  {
    path: "/admin/blacklist",
    label: "Blacklist back-office",
    match: "prefix",
    authRequired: true,
    allowedRoles: ADMIN_ROLES,
    requiredPermissions: ["admin.panel.access", "clients.blacklist"],
    loginPath: "/admin/login",
  },
  {
    path: "/admin/livreur",
    label: "Livreurs back-office",
    match: "prefix",
    authRequired: true,
    allowedRoles: ADMIN_ROLES,
    requiredPermissions: ["admin.panel.access", "deliveries.read"],
    loginPath: "/admin/login",
  },
  {
    path: "/admin/produits",
    label: "Produits back-office",
    match: "prefix",
    authRequired: true,
    allowedRoles: ADMIN_ROLES,
    requiredPermissions: ["admin.panel.access", "products.read"],
    loginPath: "/admin/login",
  },
  {
    path: "/admin/pricing",
    label: "Pricing back-office",
    match: "prefix",
    authRequired: true,
    allowedRoles: ADMIN_ROLES,
    requiredPermissions: ["admin.panel.access"],
    loginPath: "/admin/login",
  },
]

export type RouteAccessDecision = {
  allowed: boolean
  reason?: "loading" | "login_required" | "guest_only" | "blocked_role" | "blocked_permission" | "missing_role" | "missing_permission"
  redirectTo?: string
  route?: RouteConfig
}

export function normalizePath(pathname: string) {
  const normalized = pathname.split("?")[0].replace(/\/+$/, "")
  return normalized || "/"
}

export function getRouteConfig(pathname: string) {
  const normalizedPath = normalizePath(pathname)

  return [...ROUTES]
    .sort((a, b) => b.path.length - a.path.length)
    .find((route) => {
      const normalizedRoutePath = normalizePath(route.path)
      if (route.match === "prefix") {
        return normalizedPath === normalizedRoutePath || normalizedPath.startsWith(`${normalizedRoutePath}/`)
      }
      return normalizedPath === normalizedRoutePath
    })
}

export function getDefaultDashboard(user: User | null) {
  if (!user) {
    return "/login"
  }
  if (user.default_dashboard && user.default_dashboard !== "/") {
    return user.default_dashboard
  }
  if (user.permissions.includes("admin.panel.access")) {
    return "/admin"
  }
  if (user.permissions.includes("livreur.dashboard.access")) {
    return "/livreur"
  }
  if (user.permissions.includes("supplier.dashboard.view")) {
    return "/supplier"
  }
  if (user.permissions.includes("parent.dashboard.access")) {
    return "/parent"
  }
  return "/"
}

function hasAnyRole(user: User | null, roles?: AppRole[]) {
  if (!roles?.length || roles.includes("PUBLIC")) {
    return true
  }
  const userRoles = new Set([user?.role, user?.legacy_role, ...(user?.roles || [])].filter(Boolean).map((role) => String(role).toUpperCase()))
  return roles.some((role) => userRoles.has(role))
}

function hasAnyBlockedRole(user: User | null, roles?: AppRole[]) {
  if (!user || !roles?.length) {
    return false
  }
  const userRoles = new Set([user.role, user.legacy_role, ...user.roles].filter(Boolean).map((role) => String(role).toUpperCase()))
  return roles.some((role) => userRoles.has(role))
}

function hasPermissions(user: User | null, permissions?: string[]) {
  if (!permissions?.length) {
    return true
  }
  const userPermissions = new Set(user?.permissions || [])
  return permissions.every((permission) => userPermissions.has(permission))
}

function hasAnyBlockedPermission(user: User | null, permissions?: string[]) {
  if (!user || !permissions?.length) {
    return false
  }
  const userPermissions = new Set(user.permissions)
  return permissions.some((permission) => userPermissions.has(permission))
}

export function canAccessRoute({
  pathname,
  searchParams,
  user,
  isAuthenticated,
  isLoading,
}: {
  pathname: string
  searchParams?: URLSearchParams
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}): RouteAccessDecision {
  if (isLoading) {
    return { allowed: false, reason: "loading" }
  }

  const route = getRouteConfig(pathname)
  if (!route) {
    return { allowed: true }
  }

  const hasAuthIntent =
    route.allowAuthenticatedWithIntent &&
    (searchParams?.get("switch") === "1" ||
      searchParams?.get("force_login") === "1" ||
      searchParams?.get("logged_out") === "1")

  if (route.guestOnly && isAuthenticated && !hasAuthIntent) {
    return {
      allowed: false,
      reason: "guest_only",
      redirectTo: route.fallbackPath || getDefaultDashboard(user),
      route,
    }
  }

  if (route.authRequired && !isAuthenticated) {
    return {
      allowed: false,
      reason: "login_required",
      redirectTo: route.loginPath || "/login",
      route,
    }
  }

  if (hasAnyBlockedRole(user, route.blockedRoles)) {
    return {
      allowed: false,
      reason: "blocked_role",
      redirectTo: getDefaultDashboard(user),
      route,
    }
  }

  if (hasAnyBlockedPermission(user, route.blockedPermissions)) {
    return {
      allowed: false,
      reason: "blocked_permission",
      redirectTo: getDefaultDashboard(user),
      route,
    }
  }

  if (isAuthenticated && !hasAnyRole(user, route.allowedRoles)) {
    return {
      allowed: false,
      reason: "missing_role",
      redirectTo: getDefaultDashboard(user),
      route,
    }
  }

  if (isAuthenticated && !hasPermissions(user, route.requiredPermissions)) {
    return {
      allowed: false,
      reason: "missing_permission",
      redirectTo: getDefaultDashboard(user),
      route,
    }
  }

  return { allowed: true, route }
}

export function getAccessDeniedMessage(reason?: RouteAccessDecision["reason"]) {
  if (reason === "login_required") {
    return "Votre session est requise pour acceder a cette page."
  }
  if (reason === "guest_only") {
    return "Vous etes deja connecte. Redirection vers votre espace."
  }
  if (reason === "blocked_role" || reason === "blocked_permission") {
    return "Cet espace n'est pas autorise pour votre profil."
  }
  if (reason === "missing_role" || reason === "missing_permission") {
    return "Vous n'avez pas les permissions necessaires pour cette page."
  }
  return "Verification de vos droits d'acces."
}
