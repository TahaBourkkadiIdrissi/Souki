BEGIN;

-- ============================================================================
-- SOUKI - RBAC / AuthZ foundation for MVC2 backend
-- PostgreSQL migration
--
-- Important:
-- 1. Existing t_users.password values are assumed to already be hashed.
-- 2. This migration is additive and keeps t_users.role for progressive rollout.
-- 3. The final column rename password -> password_hash should happen only after
--    the application code is switched to the new field name everywhere.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Harden t_users without breaking current code
-- --------------------------------------------------------------------------

UPDATE t_users
SET
    email = NULLIF(BTRIM(email), ''),
    phone = NULLIF(BTRIM(phone), ''),
    auth_provider = COALESCE(NULLIF(BTRIM(auth_provider), ''), 'local');

ALTER TABLE t_users
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE t_users
    ALTER COLUMN auth_provider SET DEFAULT 'local';

ALTER TABLE t_users
    ALTER COLUMN auth_provider SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_t_users_identity_present'
    ) THEN
        ALTER TABLE t_users
            ADD CONSTRAINT ck_t_users_identity_present
            CHECK (email IS NOT NULL OR phone IS NOT NULL);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_t_users_email_ci
    ON t_users (LOWER(email))
    WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_t_users_active_verified
    ON t_users (is_active, is_verified);

CREATE INDEX IF NOT EXISTS idx_t_users_parent_id
    ON t_users (parent_id)
    WHERE parent_id IS NOT NULL;

-- Keep business profile tables as they are, but guarantee 1 profile row per user.
CREATE UNIQUE INDEX IF NOT EXISTS uq_t_clients_user_id
    ON t_clients (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_t_livreurs_user_id
    ON t_livreurs (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_t_parents_user_id
    ON t_parents (user_id);

-- --------------------------------------------------------------------------
-- 2. Shared function to maintain updated_at
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trg_t_users_set_updated_at'
    ) THEN
        CREATE TRIGGER trg_t_users_set_updated_at
        BEFORE UPDATE ON t_users
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
    END IF;
END $$;

-- --------------------------------------------------------------------------
-- 3. RBAC tables
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS roles (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL,
    label VARCHAR(100) NOT NULL,
    description TEXT NULL,
    is_system BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_roles_code UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_roles_active
    ON roles (is_active);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trg_roles_set_updated_at'
    ) THEN
        CREATE TRIGGER trg_roles_set_updated_at
        BEFORE UPDATE ON roles
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS permissions (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(100) NOT NULL,
    resource VARCHAR(60) NOT NULL,
    action VARCHAR(60) NOT NULL,
    description TEXT NULL,
    is_system BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_permissions_code UNIQUE (code),
    CONSTRAINT uq_permissions_resource_action UNIQUE (resource, action)
);

CREATE INDEX IF NOT EXISTS idx_permissions_resource
    ON permissions (resource);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trg_permissions_set_updated_at'
    ) THEN
        CREATE TRIGGER trg_permissions_set_updated_at
        BEFORE UPDATE ON permissions
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by_user_id BIGINT NULL,
    expires_at TIMESTAMPTZ NULL,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_roles_user
        FOREIGN KEY (user_id) REFERENCES t_users (id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_role
        FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE RESTRICT,
    CONSTRAINT fk_user_roles_assigned_by
        FOREIGN KEY (assigned_by_user_id) REFERENCES t_users (id) ON DELETE SET NULL,
    CONSTRAINT ck_user_roles_expiry
        CHECK (expires_at IS NULL OR expires_at > assigned_at)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role_id
    ON user_roles (role_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_active_user
    ON user_roles (user_id)
    WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id BIGINT NOT NULL,
    permission_id BIGINT NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by_user_id BIGINT NULL,
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_role_permissions_role
        FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
    CONSTRAINT fk_role_permissions_permission
        FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE,
    CONSTRAINT fk_role_permissions_granted_by
        FOREIGN KEY (granted_by_user_id) REFERENCES t_users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id
    ON role_permissions (permission_id);

-- --------------------------------------------------------------------------
-- 4. Seed core roles
-- --------------------------------------------------------------------------

INSERT INTO roles (code, label, description)
VALUES
    ('CLIENT', 'Client', 'Front-office customer account'),
    ('PARENT', 'Parent', 'Parent subscription and household account'),
    ('LIVREUR', 'Livreur', 'Delivery fleet account'),
    ('ADMIN', 'Admin', 'Base back-office access'),
    ('OPS_MANAGER', 'Operations Manager', 'Operations and dispatch management'),
    ('CATALOG_MANAGER', 'Catalog Manager', 'Product and catalogue management'),
    ('FINANCE_MANAGER', 'Finance Manager', 'Payments and wallet supervision'),
    ('SUPPORT_AGENT', 'Support Agent', 'Customer support and moderation'),
    ('ADMIN_SUPER', 'Super Admin', 'Full platform administration')
ON CONFLICT (code) DO UPDATE
SET
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    is_active = TRUE;

-- --------------------------------------------------------------------------
-- 5. Seed permissions
-- --------------------------------------------------------------------------

INSERT INTO permissions (code, resource, action, description)
VALUES
    ('client.dashboard.access', 'client.dashboard', 'access', 'Access the client dashboard'),
    ('parent.dashboard.access', 'parent.dashboard', 'access', 'Access the parent dashboard'),
    ('livreur.dashboard.access', 'livreur.dashboard', 'access', 'Access the livreur dashboard'),
    ('admin.panel.access', 'admin.panel', 'access', 'Access the admin back-office'),
    ('profile.manage_self', 'profile', 'manage_self', 'Manage own profile'),
    ('checkout.create', 'checkout', 'create', 'Create a checkout'),
    ('orders.read_self', 'orders', 'read_self', 'Read own orders'),
    ('orders.read', 'orders', 'read', 'Read all orders'),
    ('orders.assign_livreur', 'orders', 'assign_livreur', 'Assign a livreur to an order'),
    ('deliveries.read', 'deliveries', 'read', 'Read delivery operations'),
    ('deliveries.manage', 'deliveries', 'manage', 'Manage delivery operations'),
    ('deliveries.start_tour', 'deliveries', 'start_tour', 'Start a delivery tour'),
    ('products.read', 'products', 'read', 'Read products from back-office'),
    ('products.manage', 'products', 'manage', 'Create, update or disable products'),
    ('payments.read', 'payments', 'read', 'Read payment information'),
    ('wallets.read', 'wallets', 'read', 'Read wallet balances and transactions'),
    ('stats.read', 'stats', 'read', 'Read analytics and KPIs'),
    ('clients.read', 'clients', 'read', 'Read client information'),
    ('clients.blacklist', 'clients', 'blacklist', 'Blacklist or reactivate a client'),
    ('users.manage_roles', 'users', 'manage_roles', 'Grant or revoke RBAC roles')
ON CONFLICT (code) DO UPDATE
SET
    resource = EXCLUDED.resource,
    action = EXCLUDED.action,
    description = EXCLUDED.description;

-- --------------------------------------------------------------------------
-- 6. Seed role -> permission mappings
-- --------------------------------------------------------------------------

WITH role_permission_map(role_code, permission_code) AS (
    VALUES
        ('CLIENT', 'client.dashboard.access'),
        ('CLIENT', 'profile.manage_self'),
        ('CLIENT', 'checkout.create'),
        ('CLIENT', 'orders.read_self'),

        ('PARENT', 'parent.dashboard.access'),
        ('PARENT', 'profile.manage_self'),
        ('PARENT', 'checkout.create'),
        ('PARENT', 'orders.read_self'),

        ('LIVREUR', 'livreur.dashboard.access'),
        ('LIVREUR', 'profile.manage_self'),
        ('LIVREUR', 'deliveries.read'),
        ('LIVREUR', 'deliveries.start_tour'),

        ('ADMIN', 'admin.panel.access'),
        ('ADMIN', 'orders.read'),
        ('ADMIN', 'deliveries.read'),
        ('ADMIN', 'products.read'),
        ('ADMIN', 'payments.read'),
        ('ADMIN', 'clients.read'),
        ('ADMIN', 'stats.read'),

        ('OPS_MANAGER', 'admin.panel.access'),
        ('OPS_MANAGER', 'orders.read'),
        ('OPS_MANAGER', 'orders.assign_livreur'),
        ('OPS_MANAGER', 'deliveries.read'),
        ('OPS_MANAGER', 'deliveries.manage'),
        ('OPS_MANAGER', 'clients.read'),
        ('OPS_MANAGER', 'stats.read'),

        ('CATALOG_MANAGER', 'admin.panel.access'),
        ('CATALOG_MANAGER', 'products.read'),
        ('CATALOG_MANAGER', 'products.manage'),

        ('FINANCE_MANAGER', 'admin.panel.access'),
        ('FINANCE_MANAGER', 'payments.read'),
        ('FINANCE_MANAGER', 'wallets.read'),
        ('FINANCE_MANAGER', 'stats.read'),

        ('SUPPORT_AGENT', 'admin.panel.access'),
        ('SUPPORT_AGENT', 'clients.read'),
        ('SUPPORT_AGENT', 'clients.blacklist'),
        ('SUPPORT_AGENT', 'orders.read')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_permission_map rpm
JOIN roles r
    ON r.code = rpm.role_code
JOIN permissions p
    ON p.code = rpm.permission_code
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'ADMIN_SUPER'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- --------------------------------------------------------------------------
-- 7. Migrate existing users from legacy t_users.role into user_roles
-- --------------------------------------------------------------------------

WITH legacy_role_map AS (
    SELECT
        u.id AS user_id,
        CASE UPPER(COALESCE(u.role, 'CLIENT'))
            WHEN 'CLIENT' THEN 'CLIENT'
            WHEN 'PARENT' THEN 'PARENT'
            WHEN 'LIVREUR' THEN 'LIVREUR'
            WHEN 'ADMIN' THEN 'ADMIN'
            ELSE 'CLIENT'
        END AS role_code
    FROM t_users u
)
INSERT INTO user_roles (user_id, role_id, is_active, assigned_at)
SELECT
    lrm.user_id,
    r.id,
    TRUE,
    NOW()
FROM legacy_role_map lrm
JOIN roles r
    ON r.code = lrm.role_code
ON CONFLICT (user_id, role_id) DO NOTHING;

COMMIT;

-- --------------------------------------------------------------------------
-- Phase-8 cleanup, to run only after backend/frontend are fully switched:
--
-- ALTER TABLE t_users RENAME COLUMN password TO password_hash;
-- ALTER TABLE t_users DROP COLUMN role;
-- DROP INDEX IF EXISTS uq_t_users_email_ci; -- optional if replaced by CITEXT
-- --------------------------------------------------------------------------
