# 🏗️ SOUKI - Comprehensive Architecture & Design Document

**Last Updated**: June 2026  
**Project Status**: Active Production

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Architecture Layers](#architecture-layers)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Authentication & RBAC](#authentication--rbac)
7. [Core Services & Business Logic](#core-services--business-logic)
8. [External Integrations](#external-integrations)
9. [Frontend Pages & Components](#frontend-pages--components)
10. [Mobile Application](#mobile-application)
11. [Key Features](#key-features)
12. [Deployment & Infrastructure](#deployment--infrastructure)

---

## Executive Summary

**SOUKI** is a Moroccan AgriTech startup revolutionizing the fresh produce supply chain. The platform enables customers to order fresh vegetables sourced directly from wholesalers at dawn, with same-day morning delivery to their homes.

### Platform Pillars
- **🥬 Customer-Centric**: Same-day delivery with AI-powered ordering (voice or manual)
- **🤖 AI-Driven**: Gemma-2-2B model for intelligent basket composition with QLoRA fine-tuning
- **📊 B2B Integration**: Supplier marketplace with product management
- **🚚 Logistics Optimization**: JIT aggregation, route optimization, delivery tracking
- **👥 Multi-Tenant**: Support for clients, parents, delivery personnel, suppliers, admins

### Technology Stack
```
Frontend:      Next.js 16 + TypeScript + Shadcn/UI + TailwindCSS
Mobile:        React Native + Expo
Backend:       FastAPI (Python) + SQLAlchemy + APScheduler
Database:      PostgreSQL + Prisma
Storage:       Supabase Storage
ML:            Hugging Face (Gemma-2-2B), Gemini API
Auth:          JWT + OTP + Google OAuth
Deployment:    AWS/Supabase (TBD)
```

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐ │
│  │  Web Frontend   │  │  Mobile App     │  │  Admin Dashboard │ │
│  │  (Next.js)      │  │  (React Native) │  │  (Next.js)       │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬─────────┘ │
└───────────┼──────────────────────┼──────────────────┼──────────┘
            │                      │                  │
         HTTP/HTTPS              HTTP/HTTPS        HTTP/HTTPS
            │                      │                  │
┌───────────▼──────────────────────▼──────────────────▼──────────┐
│                      API GATEWAY / FASTAPI                      │
│                    (back-end/main.py)                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Controllers Layer (Routes)                              │  │
│  │  - auth_controller, catalogue_controller, etc.           │  │
│  └──────────────────┬───────────────────────────────────────┘  │
│  ┌──────────────────▼───────────────────────────────────────┐  │
│  │  Services Layer (Business Logic)                          │  │
│  │  - auth_service, panier_service, dispatch_service, etc.  │  │
│  └──────────────────┬───────────────────────────────────────┘  │
│  ┌──────────────────▼───────────────────────────────────────┐  │
│  │  DAO Layer (Data Access)                                 │  │
│  │  - product_dao, panier_dao, livreur_dao, etc.            │  │
│  └──────────────────┬───────────────────────────────────────┘  │
└───────────┬────────────────────────────────────────────────────┘
            │
    ┌───────▼──────────┬──────────────┬──────────────┐
    │                  │              │              │
┌───▼──────┐  ┌────────▼────┐  ┌─────▼──────┐  ┌───▼────────┐
│PostgreSQL │  │  Supabase   │  │  Redis     │  │ External   │
│  Primary  │  │  Storage    │  │  (Cache)   │  │ APIs       │
│   DB      │  │  (Avatars)  │  │            │  │ (HF, AI)   │
└───────────┘  └─────────────┘  └────────────┘  └────────────┘
```

### Application Instances

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Web Frontend** | Next.js 16 + TypeScript | Customer/Admin web interface |
| **Mobile App** | React Native + Expo | Customer mobile ordering |
| **Backend API** | FastAPI + Python | REST API & Business logic |
| **Database** | PostgreSQL | Transactional data |
| **Storage** | Supabase | File uploads (avatars, product images) |
| **ML Service** | Hugging Face | Intelligent basket generation |
| **Scheduling** | APScheduler | JIT aggregation, recurring jobs |

---

## Architecture Layers

### Backend Layered Architecture

```
back-end/
│
├── main.py ........................ FastAPI app entry point
├── config.py ...................... DB config, security keys
├── settings.py .................... App settings (Gemini key, etc.)
├── security.py .................... JWT, password hashing
├── dependencies.py ................ FastAPI dependency injection
├── auth_dependencies.py ........... Auth middleware & decorators
│
├── controllers/ ................... HTTP Route Handlers (14 files)
│   ├── auth_controller.py ......... POST /auth/* (register, login, OTP, Google)
│   ├── profile_controller.py ...... User profile, addresses
│   ├── catalogue_controller.py .... GET /api/catalogue
│   ├── panier_controller.py ....... POST/GET /api/*-basket
│   ├── checkout_controller.py ..... POST /api/checkout
│   ├── commande_controller.py ..... Voice orders
│   ├── dispatch_controller.py ..... Route optimization
│   ├── livreur_controller.py ...... Delivery tracking
│   ├── fournisseur_controller.py .. Supplier management
│   ├── jit_controller.py .......... Just-In-Time aggregation
│   ├── admin_controller.py ........ Admin operations
│   ├── claim_controller.py ........ Refund claims
│   └── settings_controller.py ..... User settings, avatar uploads
│
├── services/ ...................... Business Logic (38 files)
│   ├── auth_service.py ............ Registration, login, OTP verification
│   ├── authorization_service.py ... RBAC enforcement
│   ├── panier_service.py .......... Basket creation & management
│   ├── ml_panier_service.py ....... ML model inference (HF)
│   ├── catalogue_service.py ....... Product catalog logic
│   ├── dispatch_service.py ........ Route optimization
│   ├── livreur_service.py ......... Delivery operations
│   ├── jit_service.py ............ Aggregation logic (20h00 cron)
│   ├── fournisseur_service.py ..... Supplier management
│   ├── checkout_service.py ........ Payment processing
│   ├── commande_service.py ........ Order state machine
│   ├── notification_outbox_service WebSocket notifications
│   ├── email_delivery_service.py .. OTP & alert emails
│   ├── supabase_storage_service.py File uploads
│   ├── scheduler_service.py ....... APScheduler setup
│   └── [other services] .......... wallet, pricing, claims, etc.
│
├── dao/ ........................... Data Access Objects (15+ files)
│   ├── user_dao.py ................ User CRUD
│   ├── product_dao.py ............ Product CRUD
│   ├── panier_dao.py ............ Basket CRUD
│   ├── commande_dao.py ........... Order CRUD
│   ├── livreur_dao.py ........... Delivery personnel CRUD
│   ├── fournisseur_dao.py ........ Supplier CRUD
│   ├── tournee_dao.py ........... Route CRUD
│   ├── dispatch_dao.py .......... Dispatch CRUD
│   └── [other DAOs] ............. wallet, claim, pricing, etc.
│
├── entities/ ...................... SQLAlchemy ORM Models (30+ files)
│   ├── user_entity.py ............ User base model
│   ├── client_entity.py .......... Client profile
│   ├── parent_entity.py .......... Parent household
│   ├── livreur_entity.py ........ Delivery person
│   ├── fournisseur_entity.py ..... Supplier profile
│   ├── product_entity.py ........ Product/catalog item
│   ├── panier_entity.py ........ Basket (draft)
│   ├── commande_entity.py ....... Order (finalized)
│   ├── commande_vocale_entity.py Voice order
│   ├── tournee_entity.py ........ Delivery route
│   ├── souki_wallet_entity.py ... Wallet system
│   ├── transaction_wallet_entity Transactions
│   ├── claim_entity.py ......... Refund claims
│   ├── abonnement_entity.py .... Subscriptions
│   ├── anomalie_entity.py ...... Delivery issues
│   ├── role_entity.py ......... RBAC roles
│   ├── permission_entity.py ... RBAC permissions
│   ├── user_role_entity.py ... User role assignments
│   └── [other entities] ....... notifications, JIT logs, etc.
│
├── dto/ ........................... Data Transfer Objects (DTOs)
│   ├── user_dto.py ............... UserRegister, LoginRequest, etc.
│   ├── panier_dto.py ........... ManualBasketRequestDTO, etc.
│   ├── product_dto.py ......... ProductResponseDTO
│   ├── commande_dto.py ........ OrderResponseDTO
│   ├── livreur_dto.py ........ DeliveryEventDTO
│   └── [other DTOs] ......... Various request/response models
│
├── interfaces/ .................... Abstract Base Classes (Contracts)
│   ├── panier_service_interface.py IPanierService
│   ├── panier_dao_interface.py ... IPanierDao
│   ├── catalogue_service_interface ICatalogueService
│   ├── auth_service_interface.py . IAuthService
│   └── [other interfaces] ....... Enforce consistent contracts
│
├── api/ ........................... ML/AI Algorithms
│   ├── keys.py ................... GEMINI_API_KEY, GOOGLE_CLIENT_ID
│   └── algorithms.py ............ SYSTEM_PROMPT, _call_gemini()
│
├── sql/ ........................... Database schema & migrations
│   └── [migration files]
│
└── tests/ ......................... Test files
    ├── test_api.http ............ HTTP request samples
    ├── test_auth.py ............ Unit tests
    └── [other tests]
```

### Frontend Structure

```
front-end/
│
├── app/ ........................... Next.js App Router pages
│   ├── layout.tsx ................ Main layout
│   ├── page.tsx .................. Home page
│   ├── login/ .................... Authentication
│   │   └── page.tsx ............ Login form
│   ├── verify/ ................... OTP verification
│   │   └── page.tsx ............ OTP input
│   ├── catalogue/ ................ Product browsing
│   │   └── page.tsx ............ Catalog display
│   ├── checkout/ ................. Purchase flow
│   │   └── page.tsx ............ Checkout summary & payment
│   ├── historique/ ............... Order history
│   │   └── page.tsx ............ Past orders
│   ├── parametres/ ............... User settings
│   │   └── page.tsx ............ Profile, addresses, preferences
│   ├── parent/ ................... Parent dashboard
│   │   └── page.tsx ............ Household management
│   ├── livreur/ .................. Delivery dashboard
│   │   └── page.tsx ............ Routes, deliveries
│   ├── admin/ .................... Admin backoffice
│   │   ├── blacklist/ .......... Customer blacklist
│   │   ├── clients/ ............ Customer management
│   │   ├── orders/ ............ Order management
│   │   ├── pricing/ ......... Product pricing
│   │   ├── produits/ ....... Product management
│   │   └── page.tsx ........ Admin dashboard
│   └── backend/ .................. Not-found fallback
│
├── components/ ................... React Components
│   ├── ui/ ....................... Shadcn/UI components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── form.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── dialog.tsx
│   │   └── [20+ more components]
│   ├── auth/ ..................... Auth components
│   ├── admin/ .................... Admin specific components
│   ├── souki/ .................... Custom Souki components
│   ├── avatar/ ................... Avatar upload
│   └── routing/ .................. Navigation components
│
├── contexts/ ..................... React Context
│   └── auth_context.tsx ......... Authentication state
│
├── hooks/ ........................ Custom React Hooks
│   └── useAuth.ts ............... Auth hook
│
├── lib/ .......................... Utilities
│   ├── api.ts ................... API client
│   ├── catalogue.ts ............ Catalog functions
│   ├── auth.ts ................. Auth helpers
│   ├── checkout.ts ............ Checkout functions
│   └── [other utilities]
│
├── styles/ ....................... CSS & Tailwind
│   └── globals.css .............. Global styles
│
├── public/ ....................... Static assets
├── package.json .................. Dependencies
├── tsconfig.json ................. TypeScript config
├── next.config.mjs ............... Next.js config
├── tailwind.config.js ............ Tailwind config
└── postcss.config.mjs ............ PostCSS config
```

### Mobile Structure

```
mobile/
│
├── app/ ........................... Expo Router pages
│   ├── _layout.tsx ............... Root layout
│   ├── (tabs)/ ................... Tabbed navigation
│   ├── admin/ .................... Admin features
│   ├── catalogue/ ................ Product browsing
│   ├── checkout/ ................. Purchase flow
│   ├── livreur/ .................. Delivery tracking
│   ├── login/ .................... Authentication
│   ├── parametres/ ............... Settings
│   ├── parent/ ................... Parent dashboard
│   └── verify/ ................... OTP verification
│
├── src/ ........................... Source code
│   ├── contexts/ ................. React contexts
│   ├── hooks/ .................... Custom hooks
│   ├── components/ ............... React components
│   └── lib/ ...................... Utilities
│
├── assets/ ....................... Static assets
├── package.json .................. Dependencies
├── app.config.ts ................. Expo config
├── tailwind.config.js ............ Tailwind config
└── tsconfig.json ................. TypeScript config
```

---

## Database Schema

### Core Entities

#### **User** (t_users)
Root entity for all platform users
```
- id (PK)
- email (unique, nullable)
- phone (unique, nullable)
- password (hashed)
- role (CLIENT, PARENT, LIVREUR, FOURNISSEUR, ADMIN, OPS_MANAGER, CATALOG_MANAGER, FINANCE_MANAGER, SUPPORT_AGENT, ADMIN_SUPER)
- is_verified, is_email_verified, is_phone_verified
- auth_provider (local, google)
- avatar_url
- parent_id (self-referential for hierarchy)
- created_at, updated_at, last_login_at
```

**Related Tables**: Client, Parent, Livreur, Fournisseur, Address, Wallet, SoukiWallet, UserRole, UserSession

#### **Client** (t_clients)
Customer profile extending User
```
- user_id (PK, FK to User)
- blacklist_reason (nullable)
- is_blacklisted
- num_failed_deliveries
- total_orders
- total_spent
```

#### **Parent** (t_parents)
Household manager profile
```
- user_id (PK, FK to User)
- num_enfants
- total_household_orders
```

#### **Livreur** (t_livreurs)
Delivery personnel
```
- user_id (PK, FK to User)
- vehicule (vehicle type)
- disponible (availability)
- note_moyenne (rating)
```

**Related Tables**: Tournee, Commande, DeliveryEvent

#### **Fournisseur** (t_fournisseurs)
Supplier/Vendor profile
```
- user_id (PK, FK to User)
- shop_name, shop_slug
- description, address, ville, code_postal
- latitude, longitude (geo-location)
- siret (French business registration)
- logo_url, couverture_url
- horaires (JSONB - opening hours)
- rating, nb_avis
- statut (PENDING, APPROVED, REJECTED, SUSPENDED)
- validated_by, validated_at (audit)
- created_at, updated_at
```

**Related Tables**: Product

#### **Product** (T_Product)
Catalog items
```
- id (PK)
- nom_fr, nom_darija (bilingual names)
- prix_kg, unite (kg, piece, L, etc.)
- stock (current inventory)
- is_active
- image_url
- fournisseur_id (FK - optional for supplier products)
- marge_cible (target margin)
- coussin_securite (safety buffer)
- niveau (pricing tier: 1-3)
- volatilite (price volatility: STABLE, MEDIUM, HIGH)
- prix_gros_saisi (wholesale price)
- prix_affiche (display price)
```

**Related Tables**: LignePanier, LigneCommandeVocale, ProduitB2B

#### **Panier** (t_paniers)
Shopping basket (draft state)
```
- id (PK)
- user_id (FK)
- total_legumes (total quantity)
- total_facture (total amount)
- marge_brute (gross margin)
```

**Related Tables**: LignePanier, Commande

#### **LignePanier** (t_lignes_panier)
Individual items in basket
```
- id (PK)
- panier_id (FK)
- product_id (FK)
- quantite_kg (quantity)
- prix_unitaire (unit price)
- sous_total (line total)
- unite (unit)
```

#### **Commande** (t_commandes)
Finalized order
```
- id (PK)
- client_id (FK)
- panier_id (FK)
- livreur_id (FK, nullable)
- tournee_id (FK, nullable)
- ordre_passage (sequence in route)
- brouillon_vocal_id (FK to CommandeVocale, nullable)
- statut (CONFIRMEE, VERROUILLÉE, EN_ROUTE, LIVRÉE, ABSENT, REFUSÉE)
- date_commande, creneau_livraison
- enroute_at, delivered_at, absent_at, retour_depot_at (timestamps)
- payment_validated, mode_paiement (COD, WALLET, etc.)
- montant_total
- status_version (for versioning)
```

**Related Tables**: Client, Panier, Livreur, Tournee, Paiement, DeliveryEvent, AnomalieLogistique

#### **Tournee** (t_tournees)
Delivery route for a driver on a date
```
- id (PK)
- livreur_id (FK)
- date_tournee
- statut (PLANIFIÉE, EN_COURS, TERMINÉE)
- distance_totale_km (calculated)
- created_at
```

**Related Tables**: Commande, Livreur

#### **SoukiWallet** (wallets)
User wallet for prepaid balance
```
- id (UUID, PK)
- user_id (FK unique)
- wallet_code (unique identifier)
- password_hash (wallet security)
- balance (Decimal 12,2)
- created_at
```

**Related Tables**: TransactionWallet, User

#### **TransactionWallet** (t_transactions_wallet)
Wallet transaction history
```
- id (PK)
- wallet_id (FK UUID)
- type (CREDIT, DEBIT, REFUND)
- montant
- date
```

#### **Claim** (t_claims)
Refund/complaint claims
```
- id (PK)
- user_id (FK)
- commande_id (FK)
- ligne_panier_id (FK)
- reason (complaint reason)
- quantity_claimed (Decimal 12,3)
- amount_refunded (Decimal 12,2)
- status (REFUNDED, PENDING, REJECTED)
- is_suspect (fraud flag)
- created_at
```

#### **CommandeVocale** (T_CommandeVocale)
Voice-based order draft
```
- id (PK)
- user_id (FK)
- raw_text (original transcription/text)
- panier_json (parsed basket JSON)
- llm_model_used (Gemini, Gemma-2, etc.)
- confidence_score (0-1)
- created_at
```

**Related Tables**: LigneCommandeVocale, Commande

#### **LigneCommandeVocale** (T_LigneCommandeVocale)
Individual items in voice order
```
- id (PK)
- commande_vocale_id (FK)
- product_id (FK)
- quantite
```

#### **Abonnement** (t_abonnements)
Recurring subscription
```
- id (PK)
- parent_id (FK)
- enfant_id (FK - child account)
- poids_garanti (minimum weight guarantee)
- frequence (daily, weekly, etc.)
- montant_mensuel
- actif (Boolean)
```

#### **DeliveryEvent** (t_delivery_events)
Delivery status updates
```
- id (PK)
- commande_id (FK)
- livreur_id (FK)
- event_type (DEPART, ARRIVEE, ECHEC_LIVRAISON, ABSENT, etc.)
- event_timestamp
- location_latitude, location_longitude (GPS)
- metadata (JSONB - additional context)
```

#### **AnomalieLogistique** (t_anomalies)
Delivery issues for resolution
```
- id (PK)
- commande_id (FK)
- type_anomalie (ABSENT, REFUS, DOMMAGE, etc.)
- description
- statut (OUVERTE, RESOLUE, ANNULEE)
- created_at
```

#### **JITLog** (t_jit_logs)
Daily aggregation execution log
```
- id (PK)
- date_execution
- volume_total (total kg aggregated)
- nombre_commandes
- nombre_abonnements
- statut (succès, aucune_commande, erreur)
- details_volumes (JSONB - per-product breakdown)
- message_alerte
- created_at
```

### RBAC Tables

#### **Role** (t_roles)
Available roles in system
```
- id (PK)
- code (CLIENT, LIVREUR, FOURNISSEUR, ADMIN, etc.)
- label, description
```

#### **Permission** (t_permissions)
Available permissions
```
- id (PK)
- code (resource.action format)
- resource, action
- description
```

#### **RolePermission** (t_role_permissions)
Role → Permission mapping
```
- role_id (FK)
- permission_id (FK)
```

#### **UserRole** (t_user_roles)
User → Role assignment
```
- user_id (FK)
- role_id (FK)
```

---

## API Endpoints

### Authentication (`/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | ✗ | Register new user (email/phone) |
| POST | `/auth/login` | ✗ | Login with credentials |
| POST | `/auth/admin/login` | ✗ | Admin login |
| POST | `/auth/google` | ✗ | Google OAuth login |
| POST | `/auth/google-login` | ✗ | Legacy Google endpoint |
| POST | `/auth/verify-otp` | ✗ | Verify OTP code |
| POST | `/auth/resend-otp` | ✗ | Resend OTP |
| GET | `/auth/me` | ✓ | Get current user info |
| POST | `/auth/logout` | ✓ | Logout (invalidate token) |

### Catalog (`/api/catalogue`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/catalogue` | ✗ | Get full product catalog |
| GET | `/api/catalogue?limit=50&offset=0` | ✗ | Paginated catalog |
| GET | `/api/produit/{id}` | ✗ | Get product details |

### Basket & Orders (`/api`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/manual-basket` | ✓ | Create manual basket |
| GET | `/api/paniers/{id}` | ✗ | Get basket details |
| POST | `/api/text-basket` | ✓ | Create basket from text |
| POST | `/api/voice-basket` | ✓ | Create basket from voice |
| POST | `/api/checkout` | ✓ | Finalize purchase |
| GET | `/api/commandes/{id}` | ✓ | Get order details |
| GET | `/api/commandes` | ✓ | List user orders |

### Delivery (`/api/livreur`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/livreur/tournee` | ✓ | Get assigned tour |
| POST | `/api/livreur/demarrer-tournee` | ✓ | Start delivery tour |
| POST | `/api/livreur/livraisons/{id}/events` | ✓ | Record delivery event |
| POST | `/api/livreur/livraisons/{id}/cod/validate` | ✓ | Confirm COD payment |

### Dispatch (`/api/v1/admin/dispatch`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/admin/dispatch/run-daily` | ✓ | Run daily route optimization |
| GET | `/api/v1/admin/dispatch/tournees` | ✓ | Get all routes |
| PUT | `/api/v1/admin/dispatch/commandes/{id}/reassign` | ✓ | Reassign order to route |

### Supplier (`/api/supplier` & `/api/admin/supplier`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/supplier/dashboard` | ✓ | Supplier analytics |
| POST | `/api/supplier/products` | ✓ | Create product |
| GET | `/api/supplier/products` | ✓ | List supplier products |
| PUT | `/api/supplier/products/{id}` | ✓ | Update product |
| GET | `/api/supplier/orders` | ✓ | List supplier orders |
| POST | `/api/admin/supplier/approve` | ✓ | Approve supplier |
| GET | `/api/admin/supplier/list` | ✓ | List all suppliers |

### JIT Aggregation (`/api/jit`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/jit/agreger` | ✓ | Manual aggregation |
| GET | `/api/jit/logs` | ✓ | View aggregation logs |
| GET | `/api/jit/stats` | ✓ | Aggregation statistics |

### Admin (`/api/v1/admin`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/admin/dashboard` | ✓ | Admin dashboard |
| GET | `/api/v1/admin/clients` | ✓ | List all clients |
| POST | `/api/v1/admin/clients/{id}/blacklist` | ✓ | Blacklist client |
| POST | `/api/v1/admin/clients/{id}/unblacklist` | ✓ | Remove from blacklist |
| GET | `/api/v1/admin/orders` | ✓ | List all orders |

### Profile & Settings

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/profile/address` | ✓ | Add delivery address |
| GET | `/api/profile/addresses` | ✓ | List addresses |
| PUT | `/api/profile/address/{id}` | ✓ | Update address |
| POST | `/api/settings/avatar` | ✓ | Upload avatar (Supabase) |
| PUT | `/api/settings/preferences` | ✓ | Update notification preferences |

---

## Authentication & RBAC

### Authentication Flow

```
Client Request
    ↓
┌─────────────────────────────────────────┐
│ 1. POST /auth/register                   │
│    - Email/Phone + Password              │
│    - Create User (unverified)            │
│    - Issue OTP code                      │
│    - Send OTP via email/SMS              │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ 2. POST /auth/verify-otp                 │
│    - Verify OTP code                     │
│    - Mark user as verified               │
│    - Create profile (Client/Parent/etc.) │
│    - Issue JWT token                     │
│    - Create UserSession                  │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ 3. Subsequent Requests                   │
│    - Include JWT in Authorization header │
│    - Middleware validates token          │
│    - Extract user context                │
│    - Enforce RBAC permissions            │
└─────────────────────────────────────────┘
```

### JWT Token Structure

```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "role": "CLIENT",
  "roles": ["CLIENT"],
  "permissions": ["client.dashboard.access", "checkout.create", "orders.read_self"],
  "exp": 1234567890,
  "iat": 1234567800
}
```

### Role-Based Access Control (RBAC)

#### Roles Hierarchy

| Role | Level | Description | Dashboard |
|------|-------|-------------|-----------|
| **CLIENT** | User | Regular customer | `/` |
| **PARENT** | User | Household manager | `/parent` |
| **LIVREUR** | User | Delivery personnel | `/livreur` |
| **FOURNISSEUR** | Vendor | Product supplier | `/supplier` |
| **ADMIN** | Staff | Basic backoffice | `/admin` |
| **OPS_MANAGER** | Staff | Dispatch & operations | `/admin` |
| **CATALOG_MANAGER** | Staff | Product management | `/admin` |
| **FINANCE_MANAGER** | Staff | Payment & wallets | `/admin` |
| **SUPPORT_AGENT** | Staff | Customer support | `/admin` |
| **ADMIN_SUPER** | Staff | Full administration | `/admin` |

#### Permission Matrix

```
CLIENT
  ├─ client.dashboard.access ✓
  ├─ profile.manage_self ✓
  ├─ checkout.create ✓
  ├─ orders.read_self ✓
  └─ supplier.request.create ✓

PARENT
  ├─ parent.dashboard.access ✓
  ├─ profile.manage_self ✓
  ├─ checkout.create ✓
  └─ orders.read_self ✓

LIVREUR
  ├─ livreur.dashboard.access ✓
  ├─ profile.manage_self ✓
  ├─ deliveries.read ✓
  └─ deliveries.start_tour ✓

FOURNISSEUR
  ├─ supplier.dashboard.view ✓
  ├─ supplier.products.read ✓
  ├─ supplier.products.create ✓
  ├─ supplier.products.update ✓
  ├─ supplier.products.delete ✓
  ├─ supplier.orders.read ✓
  ├─ supplier.orders.update_status ✓
  ├─ supplier.profile.read ✓
  ├─ supplier.profile.update ✓
  └─ supplier.stats.read ✓

OPS_MANAGER
  ├─ admin.panel.access ✓
  ├─ orders.read ✓
  ├─ orders.assign_livreur ✓
  ├─ deliveries.read ✓
  ├─ deliveries.manage ✓
  ├─ clients.read ✓
  └─ stats.read ✓

[... and more for CATALOG_MANAGER, FINANCE_MANAGER, etc.]
```

### Authorization Middleware

```python
@app.get("/api/protected")
def protected_route(principal=Depends(require_auth)):
    """Requires valid JWT token"""
    return {"user_id": principal.user_id}

@app.post("/api/admin-only")
def admin_route(principal=Depends(require_permission("admin.panel.access"))):
    """Requires specific permission"""
    return {"action": "admin_operation"}
```

---

## Core Services & Business Logic

### 1. Authentication Service (`auth_service.py`)

**Responsibilities**:
- User registration with email/phone
- OTP generation, validation, and resend
- Login with credentials or Google OAuth
- Password hashing and JWT token generation
- Role profile initialization (Client, Parent, Livreur, etc.)
- RBAC role assignment

**Key Methods**:
```python
def register(data: UserRegister) → RegisterResponse
def login(data: LoginRequest) → str (JWT token)
def verify_otp(user_id: int, code: str, channel: str) → dict
def google_login(token: str, role: str) → str (JWT token)
```

### 2. Panier Service (`panier_service.py`)

**Responsibilities**:
- Create manual baskets from selected items
- Create baskets from ML model inference
- Validate stock availability
- Calculate totals and delivery fees
- Manage basket state transitions

**Key Methods**:
```python
def create_manual_basket(user_id: int, payload: ManualBasketRequestDTO) → ManualBasketResponseDTO
def get_panier_details(panier_id: int) → PanierDetailsDTO
def validate_stock(product_ids: List[int], quantities: List[float]) → bool
```

**Business Rules**:
- Free delivery if subtotal ≥ 80 DH
- Delivery fee: 10 DH (otherwise)
- Stock checked at basket creation
- Images mapped from Unsplash by product name

### 3. ML Panier Service (`ml_panier_service.py`)

**Responsibilities**:
- Generate intelligent basket compositions via prompt engineering (Groq / Llama)
- Build a system prompt from the live product catalogue + a strict JSON schema
- Validate Groq's JSON output against the catalogue; retry once then raise on failure
- Enforce a 1/2/3 price-level basket and cache results per criteria

**Technology**:
- Provider: Groq API (OpenAI-compatible `/chat/completions`, JSON mode)
- Model: `llama-3.3-70b-versatile` (default; `llama-3.1-8b-instant` as a faster option)
- No training, no fine-tuning, no Hugging Face endpoint, no internal dataset

**Key Methods**:
```python
def generer_panier(payload: PanierRequestDTO, user_id: int | None) → PanierResponseDTO
def build_system_prompt(products: list[Product]) → str
def call_groq(system_prompt: str, user_input: str) → dict
def generate_composition_json(payload, products) → dict
def validate_composition(data: dict, products) → bool
```
_On repeated Groq failure, `BasketGenerationError` is raised and surfaced as HTTP 503._

### 4. Dispatch Service (`dispatch_service.py`)

**Responsibilities**:
- Route optimization using geographic clustering
- Assign orders to delivery personnel
- Create daily tours (Tournee)
- Handle reassignments and anomalies
- Calculate distances

**Algorithm**:
1. Group orders by delivery zone
2. Assign to nearest available livreur
3. Order stops by proximity (TSP approximation)
4. Create Tournee with route details

**Key Methods**:
```python
def generate_daily_routes(target_date: date) → dict
def get_tournees_details(target_date: date) → List[TourneeResponseDTO]
def reassign_commande(commande_id: int, nouvelle_tournee_id: int) → dict
def resolve_anomalie_replanifier(anomalie_id: int, admin_id: int) → dict
```

### 5. JIT Service (`jit_service.py`)

**Responsibilities**:
- Daily aggregation of all orders at 20h00
- Calculate total volumes by product
- Add 10% buffer (safety stock)
- Lock confirmed orders
- Send notification to founder/procurement team
- Log execution to database

**Daily Workflow**:
```
20:00 ┤ APScheduler triggers agreger_commandes()
      ├─ Query all confirmed orders (statut: EN_ATTENTE, CONFIRMÉE)
      ├─ Calculate volumes by product
      ├─ Add 10% buffer: final = ceil(volume + volume*0.1)
      ├─ Lock commandes: statut → VERROUILLÉE
      ├─ Send email with shopping list
      ├─ Log execution with details
      └─ Alert if 0 orders
```

**Key Methods**:
```python
def agreger_commandes(date_aggregation: date) → ResultatAgregationJIT
def get_logs_by_date_range(start: date, end: date) → List[JITLogDTO]
```

### 6. Checkout Service (`checkout_service.py`)

**Responsibilities**:
- Process final purchase
- Create Commande from Panier
- Update inventory
- Initiate payment processing
- Handle COD (Cash on Delivery) validation
- Generate invoice/receipt

**Payment Modes**:
- **COD**: Cash at delivery (default)
- **WALLET**: Prepaid balance (SoukiWallet)

**Key Methods**:
```python
def create_commande_from_panier(panier_id: int, checkout_data: CheckoutRequest) → Commande
def process_payment(commande_id: int, mode_paiement: str) → dict
def confirm_cod_payment(commande_id: int, livreur_id: int) → dict
```

### 7. Catalog Service (`catalogue_service.py`)

**Responsibilities**:
- Retrieve and cache product catalog
- Filter/search products
- Handle product details and images
- Bootstrap initial catalog
- Update pricing/stock

**Key Methods**:
```python
def get_catalogue_complet() → List[ProductResponseDTO]
def get_produit_by_id(product_id: int) → ProductResponseDTO
def search_products(query: str) → List[ProductResponseDTO]
```

### 8. Authorization Service (`authorization_service.py`)

**Responsibilities**:
- Parse JWT tokens
- Extract user context and permissions
- Enforce permission checks
- Handle role hierarchy

**Key Methods**:
```python
def create_principal_from_token(token: str) → AuthorizationPrincipal
def has_permission(principal: AuthorizationPrincipal, permission: str) → bool
def require_role(principal: AuthorizationPrincipal, roles: List[str]) → bool
```

### 9. Livreur Service (`livreur_service.py`)

**Responsibilities**:
- Get assigned tours
- Start/complete delivery tours
- Record delivery events (GPS, status)
- Handle failed deliveries
- COD payment validation

**Delivery Events**:
- DEPART (left depot)
- ARRIVEE (arrived at delivery point)
- ECHEC_LIVRAISON (delivery failed)
- ABSENT (customer absent)
- REFUS (customer refused)

**Key Methods**:
```python
def get_tournee(livreur_id: int) → TourneeResponseDTO
def demarrer_tournee(livreur_id: int) → DemarrerTourneeResponseDTO
def apply_delivery_event(livreur_id: int, commande_id: int, event: DeliveryEventRequestDTO) → dict
def confirm_cod_payment(livreur_id: int, commande_id: int) → CodValidationResponseDTO
```

### 10. Supplier Service (`fournisseur_service.py`)

**Responsibilities**:
- Supplier registration and profile management
- Product CRUD for suppliers
- Order fulfillment status updates
- Supplier analytics and stats
- Approval workflow

**Supplier States**:
- PENDING → APPROVED → SUSPENDED (or REJECTED)

**Key Methods**:
```python
def create_supplier_request(data: FournisseurRequestDTO) → Fournisseur
def update_supplier_profile(supplier_id: int, data: dict) → Fournisseur
def create_product(supplier_id: int, product_data: dict) → Product
def get_supplier_stats(supplier_id: int) → dict
```

---

## External Integrations

### 1. Hugging Face (ML Model)

**Purpose**: Generate intelligent basket compositions from customer descriptions

**Model**: `TahaBDI/gemma-2-2b-panier-merged`
- Base Model: Google Gemma-2-2B
- Fine-tuned with: QLoRA (4-bit quantization)
- Training Data: 200+ real basket compositions
- Output: Valid JSON with product quantities

**Integration Points**:
```python
# back-end/services/ml_panier_service.py
inference_url = f"https://router.huggingface.co/hf-inference/models/{repo_id}"
headers = {"Authorization": f"Bearer {HF_TOKEN}"}
response = requests.post(inference_url, json=payload, headers=headers, timeout=45s)
```

**Fallback**: Local `200-compositions.json` if HF unavailable

**Environment Variables**:
```
SOUKI_ML_REPO_ID=TahaBDI/gemma-2-2b-panier-merged
HF_TOKEN=hf_xxxxx
SOUKI_ML_INFERENCE_URL=https://router.huggingface.co/...
SOUKI_ML_TIMEOUT_SECONDS=45
SOUKI_ML_DISABLE_MODEL=0 (set to 1 to disable)
```

### 2. Google Gemini API

**Purpose**: Advanced NLP tasks (future expansion)

**Integration Points**:
```python
# back-end/api/algorithms.py
import google.generativeai as genai
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-1.5-pro")
response = model.generate_content(prompt)
```

**Use Cases**:
- Basket composition from natural language
- Customer support chatbot
- Product recommendations

**Environment Variables**:
```
GEMINI_API_KEY=sk-xxxxx
```

### 3. Google OAuth 2.0

**Purpose**: Social login integration

**Flow**:
```
Frontend
  ↓ (Login with Google button)
Google OAuth Consent Screen
  ↓ (User approves)
Google ID Token
  ↓ (POST /auth/google)
Backend validates token
  ↓
Create/update User
  ↓
Issue JWT token
```

**Integration Points**:
```python
# back-end/services/auth_service.py
from google.oauth2 import id_token
import google.auth.transport.requests

payload = id_token.verify_oauth2_token(token, request, GOOGLE_CLIENT_ID)
user_email = payload["email"]
```

**Environment Variables**:
```
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
```

### 4. Supabase Storage

**Purpose**: File uploads (avatars, product images)

**Buckets**:
- `avatars` (user profile pictures) - max 2MB
- `products` (product images) - max 2MB

**File Formats**: JPG, PNG, WEBP

**Integration Points**:
```python
# back-end/services/supabase_storage_service.py
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
AVATAR_BUCKET = "avatars"

# Upload logic
url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}"
response = requests.post(url, files=file, headers=headers)
```

**API Endpoints** (Frontend):
```
POST /api/settings/avatar  → Upload user avatar
POST /api/produit/image    → Upload product image
```

**Environment Variables**:
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxx
```

### 5. Email Service

**Purpose**: OTP delivery, alerts, notifications

**SMTP Configuration**:
```python
# back-end/services/email_delivery_service.py
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
```

**Email Types**:
- **OTP**: 6-digit verification code
- **JIT Alerts**: Daily shopping list (20h00)
- **Order Confirmation**: Order details
- **Delivery Notification**: Delivery status updates

**Environment Variables**:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=souki@example.com
SMTP_PASSWORD=app_specific_password
```

### 6. APScheduler (Task Scheduling)

**Purpose**: Background jobs and recurring tasks

**Scheduled Jobs**:
- **20h00 Daily**: `agreger_commandes()` - JIT aggregation
- **5h00 Daily**: Send aggregation email (optional)
- **Hourly**: Cache refresh, metrics collection

**Integration Points**:
```python
# back-end/services/scheduler_service.py
from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler(timezone="Africa/Casablanca")
scheduler.add_job(
    func=JITService().agreger_commandes,
    trigger="cron",
    hour=20,
    minute=0,
    id="jit_aggregation"
)
scheduler.start()
```

**Environment Variables**:
```
SCHEDULER_TIMEZONE=Africa/Casablanca
```

---

## Frontend Pages & Components

### Page Structure

#### **Authentication Pages**

**`/login`** - Login Form
- Email/phone input
- Password input
- "Remember me" checkbox
- Google OAuth button
- Link to registration

**`/verify`** - OTP Verification
- OTP input (6 digits)
- Resend option with countdown
- Back to login link

#### **Customer Pages**

**`/`** - Home/Dashboard
- Welcome banner
- Quick order options (voice/manual)
- Recent orders
- Product highlights

**`/catalogue`** - Product Catalog
- Product grid/list view
- Filters (category, price range)
- Search functionality
- Add to basket buttons
- Basket preview sidebar

**`/checkout`** - Purchase Confirmation
- Basket review
- Delivery address selection/input
- Delivery time slot selection (8h-10h, 10h-12h, etc.)
- Payment method (COD, Wallet)
- Promo code (optional)
- Order confirmation

**`/historique`** - Order History
- List of past orders
- Order status
- Order details modal
- Reorder button
- Invoice download

**`/parametres`** - User Settings
- Profile edit (name, phone, email)
- Avatar upload
- Address book
- Notification preferences (email, SMS, push)
- Change password
- Account deletion

#### **Parent Pages**

**`/parent`** - Household Dashboard
- Linked children list
- Add new child
- Children's orders
- Subscription management
- Family spending analytics

#### **Livreur Pages**

**`/livreur`** - Delivery Dashboard
- Assigned tours today
- Map view of delivery points
- Current order details
- Delivery event buttons (arrived, failed, completed)
- GPS tracking
- Customer contact

#### **Admin Pages**

**`/admin`** - Admin Dashboard
- Key metrics (orders, revenue, customers)
- Real-time delivery tracking map
- Recent orders table
- System alerts

**`/admin/clients`** - Customer Management
- Customer list (search, filter)
- Customer details (orders, contact, blacklist status)
- Blacklist/unblacklist actions
- Message customer

**`/admin/orders`** - Order Management
- Orders table with filtering
- Order status lifecycle
- Manual order creation
- Order details modal

**`/admin/produits`** - Product Management
- Product catalog editor
- Add/edit/delete products
- Stock management
- Price management
- Image uploads

**`/admin/pricing`** - Pricing Strategy
- Product pricing editor
- Margin targets
- Safety buffers
- Volatility classification
- Bulk price updates

**`/admin/blacklist`** - Blacklist Management
- Blacklisted customers list
- Blacklist reasons
- Unblacklist actions
- Blacklist history

### Key Components

#### **UI Components** (Shadcn/UI)
```
Button, Card, Dialog, Form, Input, Select, Tabs,
Accordion, Avatar, Badge, Checkbox, DropdownMenu,
Label, Popover, ProgressBar, Separator, Slider,
Switch, Table, Textarea, Toast, Toggle, Tooltip,
NavigationMenu, ScrollArea, RadioGroup
```

#### **Custom Components**

**`<AuthProvider>`** - Authentication Context
- Stores JWT token
- Manages user session
- Provides `useAuth()` hook
- Auto-logout on expiration

**`<ProductCard>`** - Product Display
- Product image
- Name (FR/Darija)
- Price per unit
- Quick add to basket
- Availability indicator

**`<BasketSidebar>`** - Shopping Cart Preview
- Item count
- Subtotal
- Delivery fee
- Total amount
- Checkout button

**`<DeliveryMap>`** - Mapbox Integration
- Show delivery zones
- Display customer address
- Livreur GPS location
- Route visualization

**`<OrderTimeline>`** - Order Status
- Step-by-step status
- Timestamps
- Event descriptions
- Estimated delivery time

---

## Mobile Application

### Technology Stack
- **Framework**: React Native 0.85.3
- **Routing**: Expo Router
- **State Management**: Zustand + TanStack Query
- **UI Framework**: NativeWind (Tailwind)
- **Maps**: Mapbox GL Native
- **Location**: Expo Location
- **Notifications**: Expo Notifications
- **Storage**: Expo SecureStore + AsyncStorage
- **Auth**: Expo Auth Session

### Pages Structure

**Tab Navigation**:
- **Catalog** - Browse products
- **Basket** - View shopping cart
- **Orders** - Order history
- **Profile** - User settings

**Stack Navigation**:
- **Login** → **Verify OTP** → **Home**
- **Livreur** → **Tours** → **Delivery Map** → **Delivery Details**
- **Admin** → **Clients** → **Orders** → **Dispatch**
- **Parent** → **Children** → **Subscriptions**

### Key Features

**Product Browsing**:
- Grid view with images
- Product details modal
- Stock status indicator
- Quick add to basket

**Basket Management**:
- Add/remove items
- Adjust quantities
- Review totals
- Proceed to checkout

**Order Tracking**:
- Real-time delivery status
- Estimated arrival time
- Livreur contact
- Map tracking

**Profile Management**:
- Avatar upload with image picker
- Address management
- Payment methods
- Preferences

---

## Key Features

### 1. Intelligent Voice/Text Ordering

**Voice Ordering Flow**:
```
Customer Voice Input
    ↓
Speech-to-Text (built-in)
    ↓
Send to Gemini/Gemma-2
    ↓
Parse JSON response
    ↓
Validate basket structure
    ↓
Confirm with customer
    ↓
Create CommandeVocale
```

**Features**:
- Support for French and Darija
- Confidence scoring
- Multiple order formats
- Fallback to manual if needed

### 2. Just-In-Time (JIT) Aggregation

**Daily Workflow (20h00)**:
- Aggregate all confirmed orders
- Calculate precise volumes
- Add 10% safety buffer
- Round to next unit (ceiling)
- Lock commandes
- Send shopping list to procurement
- Log execution with metrics

**Benefits**:
- Zero food waste
- Exact procurement quantities
- Optimized supplier negotiations
- Historical tracking

### 3. Smart Delivery Dispatch

**Algorithm**:
1. Get all locked commandes for delivery day
2. Identify unique delivery zones (postal codes, neighborhoods)
3. Cluster customers by proximity
4. Assign clusters to available livreurs
5. Optimize route within cluster (nearest neighbor TSP)
6. Calculate total distance
7. Create Tournee records

**Optimization**:
- Minimize travel distance
- Balance workload between drivers
- Consider vehicle capacity
- Time window constraints (delivery slots)

### 4. Subscription Plans

**For Parents**:
- Recurring orders for children
- Set frequency (daily, 3x/week, weekly)
- Guarantee minimum weight
- Auto-checkout
- Convenient billing

**Data Model**:
```
Abonnement {
  parent_id
  enfant_id (child)
  poids_garanti
  frequence
  montant_mensuel
  actif
}
```

### 5. Wallet System (SoukiWallet)

**Features**:
- Prepaid balance for faster checkout
- Transaction history
- Refunds/credits tracking
- Secure password protection

**Use Cases**:
- Instant payment via wallet
- Store promotional credits
- Loyalty rewards balance
- Easy remittances

### 6. Complaint & Claim Management

**Claim Process**:
1. Customer reports issue
2. Specify product and quantity
3. Add reason/description
4. Admin reviews claim
5. Issue refund if valid
6. Update wallet balance
7. Flag suspect patterns (fraud detection)

**Data Tracking**:
```
Claim {
  user_id
  commande_id
  ligne_panier_id
  reason
  quantity_claimed
  amount_refunded
  status (REFUNDED, PENDING, REJECTED)
  is_suspect (fraud flag)
}
```

### 7. Supplier Marketplace

**Supplier Workflow**:
1. Request to become supplier
2. Admin approval process
3. Set up shop profile
4. Add products with pricing
5. View orders and fulfillment
6. Access analytics dashboard
7. Manage ratings/reviews

**Features**:
- Multiple suppliers per product
- Supplier rating system
- Product reviews
- Sales analytics

### 8. RBAC & Multi-Role Management

**Role Switching**:
- Users can have multiple roles
- Role-specific dashboards
- Permission-based feature access
- Admin can assign/revoke roles

**Use Case**: Same person could be:
- CLIENT (personal orders)
- LIVREUR (delivery work)
- FOURNISSEUR (sell products)

---

## Deployment & Infrastructure

### Development Environment

**Prerequisites**:
```bash
# Backend
- Python 3.10+
- PostgreSQL 13+
- Redis (optional)
- pip install -r back-end/requirements.txt

# Frontend
- Node.js 18+
- npm or pnpm
- npm install (in front-end/)

# Mobile
- Expo CLI
- eas-cli
- npm install (in mobile/)
```

**Environment Setup**:

**Back-end/.env**:
```
# Database
user=postgres_user
password=postgres_password
host=localhost
port=5432
dbname=souki_db

# Security
SECRET_KEY=your_secret_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# External APIs
GEMINI_API_KEY=sk-xxxxx
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
HF_TOKEN=hf_xxxxx

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=souki@example.com
SMTP_PASSWORD=app_password

# ML Settings
SOUKI_ML_REPO_ID=TahaBDI/gemma-2-2b-panier-merged
SOUKI_ML_TIMEOUT_SECONDS=45
SOUKI_ML_DISABLE_MODEL=0

# Scheduler
SCHEDULER_TIMEZONE=Africa/Casablanca

# Geolocation (Souki Depot)
SOUKI_DEPOT_LAT=34.0331
SOUKI_DEPOT_LNG=-5.0003
```

**Front-end/.env.local**:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxxx
NEXT_PUBLIC_MAPBOX_TOKEN=pk_xxxxx
```

**Mobile/.env**:
```
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_GOOGLE_CLIENT_ID=xxxxx
EXPO_PUBLIC_MAPBOX_TOKEN=pk_xxxxx
```

### Running Locally

**Backend**:
```bash
cd back-end
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend**:
```bash
cd front-end
npm run dev
# Access: http://localhost:3000
```

**Mobile**:
```bash
cd mobile
npm run start
# Scan QR code in Expo app
```

### Production Deployment

**Infrastructure**:
- **Compute**: AWS EC2 / Render / Railway
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage / AWS S3
- **Hosting**: Vercel (frontend) / Railway/Render (backend)
- **CI/CD**: GitHub Actions
- **Monitoring**: Sentry / DataDog

**Deployment Checklist**:
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] SSL certificates installed
- [ ] CORS configured for production domains
- [ ] Rate limiting enabled
- [ ] Logging/monitoring setup
- [ ] Backups scheduled
- [ ] Health checks configured
- [ ] CDN setup for static assets
- [ ] Load balancer configured

### Database Migrations

Using Prisma:
```bash
# Generate migration
npx prisma migrate dev --name migration_name

# Apply to production
npx prisma migrate deploy

# Reset (dev only)
npx prisma migrate reset
```

Using SQLAlchemy:
```bash
# Create migration
alembic revision --autogenerate -m "migration message"

# Apply migration
alembic upgrade head
```

### Monitoring & Logging

**Application Logging**:
- FastAPI request/response logging
- Service-level debug logging
- Error tracking with Sentry

**Database Monitoring**:
- Query performance monitoring
- Connection pool monitoring
- Backup verification

**Business Metrics**:
- Daily order count
- Revenue tracking
- JIT aggregation statistics
- Delivery success rate
- Customer satisfaction

---

## Development Best Practices

### Code Organization

**Backend**:
- Follow layered architecture strictly
- Use interfaces for all major services
- Keep DTOs for all API contracts
- Centralize business logic in services
- Use context managers for resource management

**Frontend**:
- Components in `components/`
- Pages in `app/`
- Utilities in `lib/`
- Contexts for global state
- Hooks for reusable logic

**Mobile**:
- Mirror frontend structure
- Use NativeWind for styling
- Zustand for state management
- Expo Router for navigation

### Testing Strategy

**Backend**:
- Unit tests for services
- Integration tests for API endpoints
- DAO layer tests with mock database
- Load testing for JIT aggregation

**Frontend**:
- Component snapshot tests
- Integration tests with userEvent
- E2E tests for critical flows
- Performance testing

### Code Quality

**Linting**:
```bash
# Backend
pylint back-end/
black back-end/

# Frontend
npm run lint

# Mobile
npm run lint
```

**Type Safety**:
```bash
# Frontend
tsc --noEmit

# Mobile
tsc --noEmit
```

---

## Glossary

| Term | Definition |
|------|-----------|
| **Panier** | Shopping basket (draft state) |
| **Commande** | Finalized order |
| **CommandeVocale** | Voice-based order |
| **Tournee** | Delivery route for a driver |
| **Livreur** | Delivery personnel / Driver |
| **Fournisseur** | Product supplier |
| **JIT** | Just-In-Time aggregation |
| **Creneau** | Time slot |
| **COD** | Cash on Delivery |
| **RBAC** | Role-Based Access Control |
| **OTP** | One-Time Password |
| **JWT** | JSON Web Token |
| **DTO** | Data Transfer Object |
| **DAO** | Data Access Object |

---

## Contact & Support

**Project Repository**: [GitHub Souki](https://github.com/souki)

**Key Contacts**:
- **CTO/Lead Developer**: Team Lead
- **Product Manager**: Product team
- **QA Lead**: QA team

**Documentation Repositories**:
- Architecture: `Documentation/ARCHITECTURE_RESTRUCTURED.md`
- API: `Documentation/API_MANUAL_CHECKOUT.md`
- Auth: `Documentation/README_AUTH.md`
- ML: `Documentation/NOTEBOOK_OPTIMISATION_DEEP_LEARNING.md`
- JIT: `Documentation/JIT_AGGREGATION_SYSTEM.md`

---

**Document Version**: 1.0  
**Last Updated**: June 2026  
**Status**: Comprehensive Overview Complete ✅
