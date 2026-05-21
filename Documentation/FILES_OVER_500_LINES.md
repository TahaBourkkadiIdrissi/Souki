# Files over 500 lines to read first

Generated during handoff preparation. Counts are line counts from tracked files.

| Lines | File | Why read first |
|---:|---|---|
| 2592 | `front-end/app/admin/orders/admin-orders-client.tsx` | Main admin orders UI; COD/JIT/order dashboard behavior. |
| 2467 | `front-end/app/admin/orders/page.tsx` | Large admin orders page variant/shell; may duplicate client file behavior. |
| 2384 | `front-end/app/livreur/page.tsx` | Main livreur delivery UI and Mapbox integration. |
| 1451 | `front-end/app/catalogue/page.tsx` | Customer catalogue/cart and free-delivery progress. |
| 1154 | `front-end/app/admin/pricing/page.tsx` | Product pricing admin, image, alerts, recalculation UI. |
| 1004 | `front-end/app/admin/blacklist/page.tsx` | Admin blacklist list/report/lift requests. |
| 942 | `front-end/lib/api.ts` | Central frontend API client and DTO types. |
| 895 | `front-end/app/checkout/page.tsx` | Final checkout, COD blacklist alert, free-delivery threshold. |
| 817 | `back-end/services/livreur_service.py` | Delivery status transitions, COD validation, refusal blacklist. |
| 741 | `front-end/app/admin/page.tsx` | Admin dashboard KPIs/charts. |
| 731 | `front-end/app/admin/livreur/page.tsx` | Admin livreur/tournee monitoring. |
| 672 | `front-end/components/ui/sidebar.tsx` | Large reusable UI sidebar component. |
| 637 | `back-end/dao/commande_dao.py` | Core order queries: client fiche, history, COD locked orders, dispatch. |
| 622 | `front-end/app/login/livreur/page.tsx` | Livreur login UI. |
| 617 | `front-end/app/login/parent/page.tsx` | Parent login UI. |
| 606 | `front-end/components/souki/ai-modals.tsx` | AI/voice modal UI. |
| 584 | `back-end/services/dispatch_service.py` | Dispatch route generation, reassignment, anomaly resolution. |
| 560 | `front-end/app/login/client/page.tsx` | Client login UI. |
| 550 | `Documentation/RBAC_MVC2_IMPLEMENTATION_PLAN.md` | RBAC/MVC2 planning doc. |
| 546 | `front-end/app/parametres/page.tsx` | Customer settings/profile/wallet and blacklist lift notification. |
| 539 | `front-end/app/admin/clients/page.tsx` | Admin clients page. |

Excluded from priority list despite >500 lines:
- `projet_complet.md` (122234 lines): likely generated/project dump, not primary source.
- `200-compositions.json` (14505 lines): data file.
- lock files and binary assets.
