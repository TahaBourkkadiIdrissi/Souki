from typing import Dict, List, Set, Tuple


ROLE_DEFINITIONS: List[Dict[str, str]] = [
    {"code": "CLIENT", "label": "Client", "description": "Front-office customer account"},
    {"code": "PARENT", "label": "Parent", "description": "Parent household account"},
    {"code": "LIVREUR", "label": "Livreur", "description": "Delivery fleet account"},
    {"code": "ADMIN", "label": "Admin", "description": "Base back-office access"},
    {"code": "OPS_MANAGER", "label": "Operations Manager", "description": "Operations and dispatch management"},
    {"code": "CATALOG_MANAGER", "label": "Catalog Manager", "description": "Product and catalogue management"},
    {"code": "FINANCE_MANAGER", "label": "Finance Manager", "description": "Payments and wallet supervision"},
    {"code": "SUPPORT_AGENT", "label": "Support Agent", "description": "Customer support and moderation"},
    {"code": "ADMIN_SUPER", "label": "Super Admin", "description": "Full platform administration"},
]


PERMISSION_DEFINITIONS: List[Dict[str, str]] = [
    {"code": "client.dashboard.access", "resource": "client.dashboard", "action": "access", "description": "Access the client dashboard"},
    {"code": "parent.dashboard.access", "resource": "parent.dashboard", "action": "access", "description": "Access the parent dashboard"},
    {"code": "livreur.dashboard.access", "resource": "livreur.dashboard", "action": "access", "description": "Access the livreur dashboard"},
    {"code": "admin.panel.access", "resource": "admin.panel", "action": "access", "description": "Access the admin back-office"},
    {"code": "profile.manage_self", "resource": "profile", "action": "manage_self", "description": "Manage own profile"},
    {"code": "checkout.create", "resource": "checkout", "action": "create", "description": "Create a checkout"},
    {"code": "orders.read_self", "resource": "orders", "action": "read_self", "description": "Read own orders"},
    {"code": "orders.read", "resource": "orders", "action": "read", "description": "Read all orders"},
    {"code": "orders.assign_livreur", "resource": "orders", "action": "assign_livreur", "description": "Assign a livreur to an order"},
    {"code": "deliveries.read", "resource": "deliveries", "action": "read", "description": "Read delivery operations"},
    {"code": "deliveries.manage", "resource": "deliveries", "action": "manage", "description": "Manage delivery operations"},
    {"code": "deliveries.start_tour", "resource": "deliveries", "action": "start_tour", "description": "Start a delivery tour"},
    {"code": "products.read", "resource": "products", "action": "read", "description": "Read products from back-office"},
    {"code": "products.manage", "resource": "products", "action": "manage", "description": "Create, update or disable products"},
    {"code": "payments.read", "resource": "payments", "action": "read", "description": "Read payment information"},
    {"code": "wallets.read", "resource": "wallets", "action": "read", "description": "Read wallet balances and transactions"},
    {"code": "stats.read", "resource": "stats", "action": "read", "description": "Read analytics and KPIs"},
    {"code": "clients.read", "resource": "clients", "action": "read", "description": "Read client information"},
    {"code": "clients.blacklist", "resource": "clients", "action": "blacklist", "description": "Blacklist or reactivate a client"},
    {"code": "users.manage_roles", "resource": "users", "action": "manage_roles", "description": "Grant or revoke RBAC roles"},
]


ROLE_PERMISSION_MAP: List[Tuple[str, str]] = [
    ("CLIENT", "client.dashboard.access"),
    ("CLIENT", "profile.manage_self"),
    ("CLIENT", "checkout.create"),
    ("CLIENT", "orders.read_self"),
    ("PARENT", "parent.dashboard.access"),
    ("PARENT", "profile.manage_self"),
    ("PARENT", "checkout.create"),
    ("PARENT", "orders.read_self"),
    ("LIVREUR", "livreur.dashboard.access"),
    ("LIVREUR", "profile.manage_self"),
    ("LIVREUR", "deliveries.read"),
    ("LIVREUR", "deliveries.start_tour"),
    ("ADMIN", "admin.panel.access"),
    ("ADMIN", "orders.read"),
    ("ADMIN", "deliveries.read"),
    ("ADMIN", "products.read"),
    ("ADMIN", "payments.read"),
    ("ADMIN", "clients.read"),
    ("ADMIN", "clients.blacklist"),
    ("ADMIN", "stats.read"),
    ("OPS_MANAGER", "admin.panel.access"),
    ("OPS_MANAGER", "orders.read"),
    ("OPS_MANAGER", "orders.assign_livreur"),
    ("OPS_MANAGER", "deliveries.read"),
    ("OPS_MANAGER", "deliveries.manage"),
    ("OPS_MANAGER", "clients.read"),
    ("OPS_MANAGER", "stats.read"),
    ("CATALOG_MANAGER", "admin.panel.access"),
    ("CATALOG_MANAGER", "products.read"),
    ("CATALOG_MANAGER", "products.manage"),
    ("FINANCE_MANAGER", "admin.panel.access"),
    ("FINANCE_MANAGER", "payments.read"),
    ("FINANCE_MANAGER", "wallets.read"),
    ("FINANCE_MANAGER", "stats.read"),
    ("SUPPORT_AGENT", "admin.panel.access"),
    ("SUPPORT_AGENT", "clients.read"),
    ("SUPPORT_AGENT", "clients.blacklist"),
    ("SUPPORT_AGENT", "orders.read"),
]


LEGACY_ROLE_PERMISSION_FALLBACK: Dict[str, Set[str]] = {
    "CLIENT": {"client.dashboard.access", "profile.manage_self", "checkout.create", "orders.read_self"},
    "PARENT": {"parent.dashboard.access", "profile.manage_self", "checkout.create", "orders.read_self"},
    "LIVREUR": {"livreur.dashboard.access", "profile.manage_self", "deliveries.read", "deliveries.start_tour"},
    "ADMIN": {"admin.panel.access", "orders.read", "deliveries.read", "products.read", "payments.read", "clients.read", "clients.blacklist", "stats.read"},
    "OPS_MANAGER": {"admin.panel.access", "orders.read", "orders.assign_livreur", "deliveries.read", "deliveries.manage", "clients.read", "stats.read"},
    "CATALOG_MANAGER": {"admin.panel.access", "products.read", "products.manage"},
    "FINANCE_MANAGER": {"admin.panel.access", "payments.read", "wallets.read", "stats.read"},
    "SUPPORT_AGENT": {"admin.panel.access", "clients.read", "clients.blacklist", "orders.read"},
}

for permission in {permission["code"] for permission in PERMISSION_DEFINITIONS}:
    LEGACY_ROLE_PERMISSION_FALLBACK.setdefault("ADMIN_SUPER", set()).add(permission)


LOGIN_TARGET_PERMISSIONS: Dict[str, str] = {
    "CLIENT": "client.dashboard.access",
    "PARENT": "parent.dashboard.access",
    "LIVREUR": "livreur.dashboard.access",
}


ROLE_PRIORITY: List[str] = [
    "ADMIN_SUPER",
    "ADMIN",
    "OPS_MANAGER",
    "FINANCE_MANAGER",
    "CATALOG_MANAGER",
    "SUPPORT_AGENT",
    "LIVREUR",
    "PARENT",
    "CLIENT",
]


DEFAULT_DASHBOARD_RULES: List[Tuple[str, str]] = [
    ("admin.panel.access", "/admin"),
    ("livreur.dashboard.access", "/livreur"),
    ("parent.dashboard.access", "/parent"),
    ("client.dashboard.access", "/"),
]

