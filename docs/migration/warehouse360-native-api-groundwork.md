# Warehouse360 Native API Groundwork Notes

This document provides a technical audit and source-mapping analysis of the **Warehouse360** domain to lay a safe, read-only native API foundation.

---

## 🔍 1. Current State Audit

### Current API Endpoints (Backend)
- `POST /api/wh360/warehouse-summary`
  - Status: Thin proxy route to V1. Active in code but unverified against live V1.

### Current Frontend Adapter Methods (`Warehouse360Adapter` & `ProductionStagingAdapter`)
- **`Warehouse360Adapter`**:
  - `getWarehouse360Context` (mock)
  - `getWarehouse360Summary` (legacy-api, proxies `/api/wh360/warehouse-summary` - unverified)
  - `getStockOverview` (mock)
  - `getOpenHolds` (mock)
  - `getGoodsMovements` (mock)
  - `getReplenishmentNeeds` (mock)
  - `getLocationCapacities` (mock)
  - `getNearExpiryStock` (mock)
  - `getWarehouseExceptions` (mock)
- **`ProductionStagingAdapter`**:
  - `getProductionStagingContext` (mock)
  - `getStagingReadinessSummary` (mock)
  - `getStagingOrderSummaries` (mock)
  - `getStagingPickTasks` (mock)
  - `getStagingZoneCapacity` (mock)
  - `getStagingShortfalls` (mock)
  - `getStagingMoveRequests` (mock)
  - `getStagingPickingWaves` (mock)
  - `getStagingAlerts` (mock)

---

## 🗄️ 2. Databricks Source Object Mapping

Since we are doing **read-only groundwork** without direct UAT access, we classify all required tables based on V1 source blueprints.

| Target V2 Endpoint / Query | Databricks Source View | Classification | Notes |
|---|---|---|---|
| `GET /api/warehouse360/overview` | `wh360.wh360_cockpit_summary_v` / `wh360_kpis_v` | confirmed-v1, referenced-only | High-level summary count views |
| `GET /api/warehouse360/inbound` | `wh360.wh360_inbound_v` | confirmed-v1, referenced-only | PO/STO receipt document details |
| `GET /api/warehouse360/outbound` | `wh360.wh360_deliveries_v` | confirmed-v1, referenced-only | Outbound delivery lines |
| `GET /api/warehouse360/staging` | `wh360.staging_orders_v` | confirmed-v1, referenced-only | Staging order demand and quantities |
| `GET /api/warehouse360/exceptions` | `wh360.wh360_imwm_exceptions_v` | confirmed-v1, referenced-only | Reconciliation & inventory mismatch details |
| - | `wh360.wh360_near_expiry_batches_v` | confirmed-v1, referenced-only | Backup for expiry exceptions |

> **Blockade Note:** Schema `wh360` is a separate catalog schema in Unity Catalog. The backend object resolver `object_resolver.py` must support the `wh360` domain explicitly to direct queries to `WH360_CATALOG` and `WH360_SCHEMA`.

---

## 🚀 3. Recommended API Groundwork Sequence

To establish a safe, highly modular native groundwork that Claude can later verify, we will implement the following read-only slices in order:

1. **Object Resolver Alignment:** Add `wh360` domain to `object_resolver.py` to enable fully-qualified catalog/schema routing.
2. **Data Contracts Expansion:** Write additive schemas in `packages/data-contracts` for `Warehouse360Overview`, `Warehouse360InboundItem`, `Warehouse360OutboundItem`, `Warehouse360StagingItem`, and `Warehouse360ExceptionItem`.
3. **QuerySpec Factories & Row Mappers:** Create `apps/api/adapters/warehouse360/warehouse360_databricks_adapter.py` implementing robust, injection-safe parameterised SQL queries and defensive null-safe row mappers.
4. **FastAPI Route Shell:** Implement `/api/warehouse360/*` endpoints inside `apps/api/routes/warehouse360.py` supporting `databricks-api` mode checks, proper error status mapping, and native response headers.
5. **Frontend Adapter Foundations:** Extend the frontend adapter layer with corresponding endpoints (gated, with no silent mock fallbacks in native mode).
6. **Robust Test Verification:** Write unit tests for mappers, QuerySpecs, routes, and architecture guardrails.
