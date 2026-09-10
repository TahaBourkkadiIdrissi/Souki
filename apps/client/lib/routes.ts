import type { User } from "@/contexts/auth-context"
export type AppRole = "PUBLIC" | "CLIENT" | "LIVREUR" | "ADMIN" | "ADMIN_SUPER"
export const normalizePath = (path: string) => path.split("?")[0].replace(/\/+$/, "") || "/"
export const getDefaultDashboard = (_user: User | null) => "/"
const LOGIN = "/login/client"
const PUBLIC = ["/login", "/verify", "/forgot-password", "/reset-password", "/offline", "/politique-confidentialite", "/", "/pwa-welcome", "/catalogue", "/abonnements", "/onboarding"]
export type RouteAccessDecision = { allowed: boolean; reason?: "loading" | "login_required" | "missing_role"; redirectTo?: string }
export function canAccessRoute({ pathname, user, isAuthenticated, isLoading }: { pathname: string; user: User | null; isAuthenticated: boolean; isLoading: boolean; searchParams?: URLSearchParams }): RouteAccessDecision {
  const path = normalizePath(pathname)
  if (PUBLIC.some(prefix => path === prefix || (prefix !== "/" && path.startsWith(prefix + "/")))) return { allowed: true }
  if (isLoading) return { allowed: false, reason: "loading" }
  if (!isAuthenticated || !user) return { allowed: false, reason: "login_required", redirectTo: LOGIN }
  const roles = new Set([user.role, user.legacy_role, ...user.roles])
  if (!(roles.has("CLIENT") && !["ADMIN", "ADMIN_SUPER", "FOURNISSEUR", "PARENT", "LIVREUR"].some(value => roles.has(value)))) return { allowed: false, reason: "missing_role", redirectTo: LOGIN }
  return { allowed: true }
}
export function getAccessDeniedMessage(reason?: string) { return reason === "missing_role" ? "Ce compte ne peut pas accéder à cet espace." : "Connectez-vous pour continuer." }
