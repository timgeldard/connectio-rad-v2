# UAT Smoke-Test Checklist — ConnectIO V2

**Environment:** `https://connectio-v2-604667594731808.8.azure.databricksapps.com`
**Last updated:** 2026-05-18

---

## Section A — Deployment smoke test (PASSED 2026-05-17)

These tests confirm the app deploys, starts, and serves its static UI. No data connectivity is required.

- [x] `databricks apps get connectio-v2` shows `state: RUNNING`
- [x] Root URL loads (`https://connectio-v2-604667594731808.8.azure.databricksapps.com`)
- [x] React shell renders (workspace navigation visible)
- [x] Static assets load (JS, CSS, fonts — no 404s in browser network tab)
- [ ] `/health` responds `{"status": "ok"}` — **not yet manually confirmed** (endpoint exists in code; confirm in browser)

---

## Section B — Legacy-api smoke test (PENDING — blocked by V1 apps STOPPED)

These tests confirm the V2 → V1 proxy path works end-to-end. Requires V1 Databricks Apps to be running.

**Prerequisite:** Start the V1 apps. Contact the V1 team or restart via:
```bash
databricks apps start trace2          # or whichever app name applies
databricks apps start connectedquality
databricks apps start poh
databricks apps start wh360
```

Once V1 apps are running, verify each route in sequence.

### B1 — Trace2 batch header

```bash
curl -s -X POST https://connectio-v2-604667594731808.8.azure.databricksapps.com/api/trace2/batch-header \
  -H "Content-Type: application/json" \
  -H "Cookie: <auth-cookie-from-browser>" \
  -d '{"material_id": "<known-id>", "batch_id": "<known-id>"}' | jq .
```

- [ ] Returns HTTP 200 with data (not mock, not 503)
- [ ] `source` field in response is `legacy-api`
- [ ] No 502 (would indicate firewall/private-link issue between Apps network and V1)

### B2 — CQ lab plants

```bash
curl -s https://connectio-v2-604667594731808.8.azure.databricksapps.com/api/cq/lab/plants \
  -H "Cookie: <auth-cookie-from-browser>" | jq .
```

- [ ] Returns HTTP 200 with plant list
- [ ] `source` field is `legacy-api`

### B3 — POH order header

```bash
curl -s -X POST https://connectio-v2-604667594731808.8.azure.databricksapps.com/api/por/order-header \
  -H "Content-Type: application/json" \
  -H "Cookie: <auth-cookie-from-browser>" \
  -d '{"process_order_id": "<known-id>"}' | jq .
```

- [ ] Returns HTTP 200 with order header
- [ ] `source` field is `legacy-api`

### B4 — Expected failures while V1 STOPPED

While V1 apps are STOPPED, all routes above should return:
- HTTP 503 with `{"detail": "..."}` — not a V2 defect, expected behaviour

| Route | HTTP status while V1 stopped | Notes |
|---|---|---|
| `POST /api/trace2/batch-header` | Expected 503 | |
| `GET /api/cq/lab/plants` | Expected 503 | |
| `POST /api/por/order-header` | Expected 503 | |
| `POST /api/wh360/warehouse-summary` | Expected 503 | |

---

## Section C — Native Databricks smoke test (ACTIVE — browser verification pending)

These tests confirm V2 can query Databricks directly using end-user OAuth.

**Current state (2026-05-17):**
- `BACKEND_ADAPTER_MODE=databricks-api` — native reads active for CQ lab plants and POH order header
- `DATABRICKS_HOST`, `SQL_WAREHOUSE_ID`, `POH_CATALOG`, `CQ_CATALOG` set as literals in `app.yaml`
- `sql` OAuth scope added to app (`effective_user_api_scopes: ["sql", "iam.current-user:read", "iam.access-control:read"]`)
- All SQL column names confirmed from live DDL (connected_plant_uat, 2026-05-17)
- CLI-based curl tests cannot verify end-to-end — CLI tokens bypass the Databricks Apps OAuth consent flow and don't carry the `sql` scope. **Browser testing required.**

### C1 — Prerequisites (COMPLETE)

- [x] `BACKEND_ADAPTER_MODE=databricks-api` set in `app.yaml`
- [x] `DATABRICKS_HOST` set to `https://adb-604667594731808.8.azuredatabricks.net`
- [x] `SQL_WAREHOUSE_ID` set to `e76480b94bea6ed5`
- [x] `POH_CATALOG` and `CQ_CATALOG` set to `connected_plant_uat`
- [x] `sql` OAuth scope in `effective_user_api_scopes`
- [x] App service principal has READ on `connectio-v2` secret scope
- [x] App deployed and `state: RUNNING`

### C2 — OAuth header verification (CONFIRMED 2026-05-17)

- [x] `token_present: true` — `x-forwarded-access-token` is being injected
- [x] `user_header_present: true` — `x-forwarded-user` is being injected
- [x] `email_header_present: true` — `x-forwarded-email` is being injected
- [x] `token_length_bucket: "long"` — token is a real OAuth JWT
- [x] `gap-auth` response header confirms authenticated user identity
- [x] `ENABLE_AUTH_DIAGNOSTICS` removed from `app.yaml` (disabled 2026-05-17)

### C3 — CQ lab plants (native Databricks) ✓ PASSED 2026-05-17

```
GET /api/cq/lab/plants
```

- [x] Returns HTTP 200 with plant list
- [x] Response header `X-Data-Source: databricks-api` present
- [x] Response header `X-Adapter-Mode: databricks-api` present
- [x] No SPN/PAT token used — query executes as the end user's identity

### C4 — POH order header (native Databricks) ✓ PASSED 2026-05-17

Tested with process order `7006965038` (plant C113, MIXED BERRY FLV LQD 70373871, status: closed).

```
POST /api/por/order-header
{"process_order_id": "7006965038"}
```

- [x] Returns HTTP 200 with order data
- [x] Response header `X-Data-Source: databricks-api` present
- [x] Response header `X-Query-Name: poh.get_process_order_header` present
- [x] Fields not in the view (`plannedQuantity`, `confirmedQuantity`, `uom`, dates) return zero/empty defaults — expected, by design

### C5 — Auth failure cases ✓ PASSED 2026-05-17

- [x] Without auth (no cookie / expired session): returns HTTP 401 — Databricks Apps gateway rejects before reaching FastAPI
- [x] Confirmed no 200 with mock data when token is absent

### C6 — No SPN/PAT fallback ✓ PASSED 2026-05-17

- [x] `databricks apps logs connectio-v2` — zero entries containing `service_principal`, `client_secret`, or `DATABRICKS_TOKEN`
- [x] `X-Data-Source` header confirmed `databricks-api` on C3 and C4

---

### C7 — POH order operations (native Databricks) ✓ PASSED 2026-05-17

`GET /api/por/order-operations?process_order_id=7006965038`

- [x] Returns HTTP 200 with array — 11 operations returned for PO 7006965038
- [x] Response header `X-Data-Source: databricks-api` present
- [x] Response header `X-Query-Name: poh.get_order_operations` present
- [x] `operationId`, `operationNumber`, `operationText` are strings
- [x] No SPN/PAT token used — query executes as end-user identity

See `docs/deployment/poh-native-slices-browser-verification.md` for full checklist and troubleshooting.

---

### C8 — POH order confirmations (native Databricks) — EXECUTABLE, awaiting browser verification

`GET /api/por/order-confirmations?process_order_id=7006965038`

**Status: IMPLEMENTED** — route wired, DDL confirmed 2026-05-17, all tests passing. Browser verification pending.

- [ ] Returns HTTP 200 with JSON array
- [ ] Response header `X-Data-Source: databricks-api` present
- [ ] Response header `X-Query-Name: poh.get_order_confirmations` present
- [ ] Each item has `confirmationId`, `operationId`, `confirmedYield`, `uom`, `confirmedAt`
- [ ] Duration fields (`setupDurationMinutes`, `machineDurationMinutes`, `cleaningDurationMinutes`) present where view has data
- [ ] `operationText` and `isFinalConfirmation` absent — not in `vw_gold_confirmation` by design
- [ ] No SPN/PAT token used — query executes as end-user identity

See `docs/deployment/browser-verification-backlog.md` (BV-01) for full pass criteria and troubleshooting.

---

### C9 — POH goods movements (native Databricks) — EXECUTABLE, awaiting browser verification

`GET /api/por/order-goods-movements?process_order_id=7006965038`

**Status: IMPLEMENTED** — route wired, DDL confirmed 2026-05-17, all tests passing. Browser verification pending.

- [ ] Returns HTTP 200 with JSON array
- [ ] Response header `X-Data-Source: databricks-api` present
- [ ] Response header `X-Query-Name: poh.get_order_goods_movements` present
- [ ] All `direction` values are `"input"`, `"output"`, or `"unknown"` — never null
- [ ] `materialId` values preserve leading zeros (string, not numeric)
- [ ] `materialDescription` absent — no material master join in `vw_gold_adp_movement` by design
- [ ] No SPN/PAT token used — query executes as end-user identity

See `docs/deployment/browser-verification-backlog.md` (BV-02) for full pass criteria and troubleshooting.

---

### C10 — EnvMon site summary (native Databricks) ✓ PASSED 2026-05-18

`GET /api/envmon/site-summary?plant_id=C061&period_start=2026-01-01&period_end=2026-05-18`

**Status: BROWSER-VERIFIED** — HTTP 200, all 12 schema keys present, `gap-auth: tim.geldard@kerry.com` confirms end-user identity.

Actual response (C061, 2026-01-01 → 2026-05-18):
```json
{"plantId":"C061","plantName":"","zonesMonitored":0,"zonesWithAlerts":0,"positiveCount":0,"positiveRate":0.0,"openCorrectiveActions":0,"overdueActions":0,"complianceRate":0.0,"riskStatus":"unknown","highestSeverity":"low","confidence":0.0}
```

- [x] Returns HTTP 200 with JSON object
- [x] All 12 EnvMonSiteSummarySchema keys present
- [x] `plantName` is `""` — placeholder by design
- [x] `openCorrectiveActions` / `overdueActions` are `0` — contract compat by design
- [x] `riskStatus: "unknown"` — valid enum value
- [x] `highestSeverity: "low"` with `positiveCount: 0` — consistent (inspection lots with low-severity classifications exist; none rate as positives)
- [x] No SPN/PAT token used — query executes as end-user identity

See `docs/deployment/envmon-native-browser-verification.md` for full pass criteria and troubleshooting.

---

### C11 — EnvMon swab results (native Databricks) ✓ PASSED 2026-05-18

`GET /api/envmon/swab-results?plant_id=C061&period_start=2026-01-01&period_end=2026-05-18&limit=100`

**Status: BROWSER-VERIFIED** — HTTP 200 confirmed. Route wired (p.txt, 2026-05-17), DDL confirmed for same three Group A SAP QM views as site-summary, 56 new adapter + route tests passing.

- [x] Returns HTTP 200
- [x] No SPN/PAT token used — query executes as end-user identity

See `docs/deployment/envmon-native-browser-verification.md` (swab-results section) for full pass criteria and troubleshooting.

---

### C12 — Trace graph (native Databricks, multi-hop) ✓ PASSED 2026-05-18

```http
POST /api/trace2/trace-graph
Content-Type: application/json

{
  "material_id": "20052009",
  "batch_id": "0008602411",
  "plant_id": "C061",
  "direction": "both",
  "max_depth": 2,
  "max_edges": 100
}
```

**Status: BROWSER-VERIFIED** — HTTP 200, `ok: true`. UC GRANT applied to `tim.geldard@kerry.com` on `connected_plant_uat.gold`. Route wired (q.txt, 2026-05-18), gold_batch_lineage DDL confirmed (18 columns), iterative multi-hop expansion, 47 new adapter + route tests (655 total).

- [x] Returns HTTP 200 with JSON object
- [x] No SPN/PAT token used — query executes as end-user identity
- [x] No mock or legacy-api fallback on Databricks error (returns 502/503/etc.)

See `docs/deployment/trace-native-browser-verification.md` (Check T2) for full pass criteria and troubleshooting.

---

### C13 — Trace Graph UI (frontend wiring) — EXECUTABLE, awaiting UI browser verification

**Status: IMPLEMENTED** — `Trace2LegacyApiAdapter.getTraceGraph` override wired (u.txt, 2026-05-18), TypeScript mapper in place, contract mismatch resolved, 113 tests passing. UI browser verification pending after next deploy.

Test: open Trace Investigation workspace, enter `material_id=000000000020052009`, `batch_id=0008602411`, `plant_id=C061`. Navigate to the Trace Graph panel.

- [ ] Trace Graph panel renders without crash
- [ ] ReactFlow nodes and edges drawn (not empty — at least anchor node)
- [ ] `source: databricks-api` shown in panel source badge (green)
- [ ] No mock graph data displayed when native call succeeds
- [ ] No mock graph data displayed when native call fails — error state shown instead
- [ ] Node click shows material/batch details in selection panel
- [ ] Edge click shows relationship type, quantity, document reference
- [ ] Direction toggle (Both / Upstream / Downstream) filters nodes correctly
- [ ] Warnings banner appears for truncated or max-depth-reached responses
- [ ] Empty-state message appears when backend returns no nodes

---

## Notes

- CQ Lab failures (`/api/cq/lab/fails`) is blocked pending `vw_gold_process_order_plan` availability — do not test until that view is confirmed in `connected_plant_uat`.
- `vw_gold_process_order_phase` DDL is confirmed (2026-05-17). No column-name blockers for order-operations route.
- `vw_gold_confirmation` DDL confirmed 2026-05-17 — confirmations route is implemented and executable.
- `vw_gold_adp_movement` DDL confirmed 2026-05-17 — goods movements route is implemented and executable.
- All tests in this checklist require a human in the loop with valid Databricks workspace access. Do not attempt to automate against live Databricks in CI.
