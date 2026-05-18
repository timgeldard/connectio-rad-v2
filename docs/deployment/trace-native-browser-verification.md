# Trace Native — Browser Verification Checklist

**Date:** 2026-05-18 — q.txt: `POST /api/trace2/trace-graph` route wired (iterative multi-hop, gold_batch_lineage, 655 tests)  
**Status:** T2 **BROWSER-VERIFIED 2026-05-18** (HTTP 200, UC GRANT applied). T1 (batch-header) and T3 (mass-balance) still blocked on DDL verification.  
**App URL:** `https://connectio-v2-604667594731808.8.azure.databricksapps.com`  
**Reference:**  
- `docs/audit/trace-native-column-verification-checklist.md` — DDL verification (must complete first)
- `docs/migration/trace-native-batch-header-lineage-plan.md` — implementation decisions

---

## Prerequisites

Before running any check:
- DDL verification in `trace-native-column-verification-checklist.md` must be COMPLETE
- All blocking TODOs in `apps/api/adapters/trace2/trace2_databricks_adapter.py` must be resolved
- Routes must be wired to Databricks in `apps/api/routes/trace2.py`
- UAT app must be RUNNING: `databricks apps get connectio-v2` → state = RUNNING
- `BACKEND_ADAPTER_MODE=databricks-api` confirmed in `apps/api/app.yaml`
- `TRACE_CATALOG=connected_plant_uat` must be set in `apps/api/app.yaml`
- Authenticated as a Databricks user with `sql` scope in `effective_user_api_scopes`

---

## Test Anchor

| Field | Value |
|---|---|
| material_id | `000000000020052009` |
| batch_id | `0008602411` |
| plant_id | `C061` |

If this anchor has no rows, identify an alternate batch from `gold_batch_stock_v` that has known stock.

---

## Check T1 — POST /api/trace2/batch-header (Databricks native)

**UI route:** Navigate to Trace Investigation workspace → enter material/batch → Batch Header panel.

**Direct API call:**
```http
POST https://connectio-v2-604667594731808.8.azure.databricksapps.com/api/trace2/batch-header
Content-Type: application/json

{
  "material_id": "000000000020052009",
  "batch_id": "0008602411"
}
```

**Expected response headers (databricks-api mode):**
```http
X-Data-Source: databricks-api
X-Adapter-Mode: databricks-api
X-Query-Name: trace2.get_batch_header_summary
```

**Expected response body shape:**
```json
{
  "materialId": "000000000020052009",
  "materialDescription": "<string from gold_material.material_name>",
  "batchId": "0008602411",
  "plantId": "<string from gold_batch_summary_v.plant_id>",
  "plantName": "<string from gold_plant.plant_name>",
  "batchStatus": "active" | "blocked" | "archived" | "deleted",
  "stockStatus": "unrestricted" | "blocked" | "quality-inspection" | "returns" | "transit",
  "qualityStatus": "pending" | "not-applicable",
  "releaseStatus": "released" | "blocked" | "restricted" | "not-released" | "unknown",
  "quantity": <number>,
  "uom": "<string>",
  "manufactureDate": "<date string or absent>",
  "expiryDate": "<date string or absent>",
  "processOrderId": "<string or absent>"
}
```

**Pass criteria:**
- [ ] HTTP 200
- [ ] `X-Data-Source: databricks-api` header present
- [ ] `X-Query-Name: trace2.get_batch_header_summary` header present
- [ ] Response is a JSON object (not array)
- [ ] `materialId` matches request `material_id` (leading zeros preserved)
- [ ] `batchId` matches request `batch_id`
- [ ] `batchStatus` is a known enum value (not null)
- [ ] No 401/403/502/503

**Troubleshooting:**

| Status | Likely cause | Fix |
|---|---|---|
| 503 (mode) | `BACKEND_ADAPTER_MODE` not `databricks-api` | Check `app.yaml` |
| 503 (catalog) | `TRACE_CATALOG` not set | Add `TRACE_CATALOG=connected_plant_uat` to `app.yaml` |
| 401 | OAuth token missing or `sql` scope absent | Re-deploy bundle; check `user_api_scopes: [sql]` |
| 403 | User lacks SELECT on gold views | Grant UC access: `GRANT SELECT ON VIEW connected_plant_uat.gold.gold_batch_summary_v TO <user>` |
| 404 | Batch not found in `gold_batch_stock_v` | Try alternate test anchor |
| 502 | Query error — likely wrong column name | Check adapter TODO columns; check `databricks apps logs connectio-v2` |
| 429 | Rate limit | Retry after 30 seconds |
| 504 | Timeout | Check warehouse health; retry |

**Manual result:**

| Status | Date | Notes |
|---|---|---|
| [ ] not yet tested | — | Blocked — DDL verification incomplete |

---

## Check T2 — POST /api/trace2/trace-graph (multi-hop, q.txt)

**Status:** Route wired (q.txt, 2026-05-18) — executable, awaiting browser verification.  
**Note:** T2 can be browser-verified independently of T1 (batch-header) — gold_batch_lineage DDL is confirmed; no joins to unverified views.

**Direct API call:**
```http
POST https://connectio-v2-604667594731808.8.azure.databricksapps.com/api/trace2/trace-graph
Content-Type: application/json
Authorization: Bearer <user-oauth-token>

{
  "material_id": "000000000020052009",
  "batch_id": "0008602411",
  "plant_id": "C061",
  "direction": "both",
  "max_depth": 6,
  "max_edges": 1000
}
```

**Expected response headers:**
```http
X-Data-Source: view:gold_batch_lineage
X-Adapter-Mode: databricks-api
X-Query-Name: trace2.get_trace_graph
```

**Expected response body shape (data exists):**
```json
{
  "anchor": {
    "materialId": "000000000020052009",
    "batchId": "0008602411",
    "plantId": "C061",
    "nodeKey": "000000000020052009:0008602411:C061"
  },
  "nodes": [
    {
      "nodeKey": "000000000020052009:0008602411:C061",
      "materialId": "000000000020052009",
      "batchId": "0008602411",
      "plantId": "C061",
      "label": "000000000020052009 / 0008602411",
      "depth": 0,
      "directions": ["anchor"],
      "isAnchor": true
    }
  ],
  "edges": [
    {
      "id": "<parent_key>|<child_key>|<link_type>|<doc_num>|<hop>",
      "source": "<parent_node_key>",
      "target": "<child_node_key>",
      "linkType": "PRODUCTION",
      "processOrderId": "<string or null>",
      "materialDocumentNumber": "<string or null>",
      "quantity": <number or null>,
      "baseUnitOfMeasure": "<string or null>",
      "postingDate": "<date or null>",
      "movementType": "<string or null>",
      "depth": 0,
      "direction": "downstream"
    }
  ],
  "depthReached": 1,
  "truncated": false,
  "warnings": []
}
```

**Acceptable empty response (anchor exists, no lineage edges):**
```json
{
  "anchor": { "materialId": "000000000020052009", "batchId": "0008602411", "plantId": "C061", "nodeKey": "..." },
  "nodes": [{ "isAnchor": true, ... }],
  "edges": [],
  "depthReached": 0,
  "truncated": false,
  "warnings": ["no_edges_found"]
}
```

**Pass criteria:**
- [ ] HTTP 200
- [ ] `X-Data-Source: view:gold_batch_lineage` header present
- [ ] `X-Adapter-Mode: databricks-api` header present
- [ ] `X-Query-Name: trace2.get_trace_graph` header present
- [ ] Response has `anchor`, `nodes`, `edges`, `depthReached`, `truncated`, `warnings` keys
- [ ] Anchor node is present in `nodes` with `isAnchor: true`
- [ ] `anchor.materialId` = `"000000000020052009"` (leading zeros preserved)
- [ ] `anchor.batchId` = `"0008602411"` (leading zeros preserved)
- [ ] If edges exist: all edge `source`/`target` values correspond to `nodeKey` values in `nodes`
- [ ] No duplicate `nodeKey` values in `nodes`
- [ ] No 401/403/502/503

**Troubleshooting:**

| Status | Likely cause | Fix |
|---|---|---|
| 503 (mode) | `BACKEND_ADAPTER_MODE` ≠ `databricks-api` | Check `app.yaml` |
| 503 (catalog) | `TRACE_CATALOG` not set | Add to `app.yaml` |
| 401 | OAuth token missing or `sql` scope absent | Re-deploy bundle; check `user_api_scopes: [sql]` |
| 403 | No SELECT on `gold_batch_lineage` | `GRANT SELECT ON TABLE connected_plant_uat.gold.gold_batch_lineage TO <user>` |
| 422 | Invalid `direction` value | Use `upstream`, `downstream`, or `both` |
| 502 | SQL execution error | Check `databricks apps logs connectio-v2` |
| Empty graph (`no_edges_found` warning) | Anchor has no lineage edges | Expected for some batches — try alternate anchor |

**Manual result:**

| Status | Date | Notes |
|---|---|---|
| [x] **PASSED** | 2026-05-18 | HTTP 200 — `ok: true`. UC GRANT applied to `tim.geldard@kerry.com` on `connected_plant_uat.gold`. Test anchor: `material_id=20052009`, `batch_id=0008602411`, `plant_id=C061`, `direction=both`, `max_depth=2`. |

---

## Check T2-UI — Trace Graph Panel (frontend wiring) — EXECUTABLE, UI BV pending

**Status:** Frontend wiring complete (u.txt, 2026-05-18). Shell routing fixed (a.txt, 2026-05-18) — verification page added and `traceability-workspace` placeholder removed. UI browser verification pending after next UAT deploy.

**What changed (a.txt, 2026-05-18):**
- `traceability-workspace` in `WorkspaceViews.tsx` now renders `TraceInvestigationWorkspace` — no longer hits the "implementation pending" placeholder
- New `trace-graph-verify` page added at `?workspace=trace-graph-verify` — form with materialId/batchId/plantId inputs and Run Trace button; renders `TraceGraphPanel` with the submitted request; no mock fallback

**Prerequisites:** T2 API check must be PASSED first.

**Primary URL for UI BV:**
```
https://connectio-v2-604667594731808.8.azure.databricksapps.com/?workspace=trace-graph-verify
```

**Test anchor (pre-filled in form):**
- Material ID: `000000000020052009`
- Batch ID: `0008602411`
- Plant ID: `C061`

**Steps:**
1. Navigate to `/?workspace=trace-graph-verify`
2. Confirm inputs are pre-filled with test anchor values
3. Click **Run Trace**
4. Verify the graph panel renders with data from the backend

**Pass criteria:**
- [ ] Page loads at `?workspace=trace-graph-verify` without crash
- [ ] Material ID, Batch ID, Plant ID inputs are visible with pre-filled default values
- [ ] Click **Run Trace** — graph panel appears
- [ ] ReactFlow canvas is visible with at least the anchor node
- [ ] `source: databricks-api` badge visible (green) — NOT `source: mock`
- [ ] Node count and edge count match what T2 API returns
- [ ] Click any node → detail panel shows materialId, batchId, plantId
- [ ] Click any edge → detail panel shows relationship type, quantity, movement type
- [ ] Direction toggle (Both / Upstream / Downstream) filters the graph
- [ ] Warnings banner appears when backend returns `truncated: true` or `max_depth_reached`
- [ ] Empty state message (`No lineage edges found for this material/batch/plant.`) appears when backend returns no edges
- [ ] No mock data shown when native call fails — error state in panel instead

**Also verify (Option A — shell fix):**
- [ ] `?workspace=traceability-workspace&tab=trace` no longer shows "implementation pending (Phase 3+)"
- [ ] It renders the `TraceInvestigationWorkspace` instead (scope will be empty, graph panel will show empty/error state — that is expected without scope context)

**Troubleshooting:**

| Symptom | Likely cause | Fix |
|---|---|---|
| `?workspace=trace-graph-verify` returns NotFound | Build does not include a.txt changes | Redeploy UAT bundle |
| Green badge not showing | `VITE_ADAPTER_MODE` not `legacy-api` in build | Check Vite build config |
| Panel shows mock nodes only | `getTraceGraph` not calling backend | Check adapter factory — mode must be `legacy-api` |
| React Flow crash | `undefined` on `node.type` or `edge.relationshipType` | Fixed in u.txt — check build includes latest panel |
| Empty nodes/edges from a batch that T2 returned data for | Mapper bug | Check `mapBackendTraceGraph` output vs raw response |

**Manual result:**

| Status | Date | Notes |
|---|---|---|
| [ ] not yet tested | — | Awaiting UAT deploy after a.txt changes |

---

## Check T3 — POST /api/trace2/mass-balance (deferred)

Route not yet wired — `gold_batch_mass_balance_v` WHERE column names unverified.

Run DDL check first:
```sql
DESCRIBE TABLE connected_plant_uat.gold.gold_batch_mass_balance_v;
```

When wired, test:
```http
POST /api/trace2/mass-balance
{ "material_id": "000000000020052009", "batch_id": "0008602411" }
```

Expected headers: `X-Query-Name: trace2.get_mass_balance`

**Manual result:**

| Status | Date | Notes |
|---|---|---|
| [ ] not yet tested | — | Blocked — DDL verification incomplete |

---

## Verification Sequence

1. Complete `trace-native-column-verification-checklist.md`
2. Implement and wire routes (following POH dual-mode pattern)
3. Deploy to UAT
4. Run Check T1 → if passed, proceed to Check T2
5. Run Check T2 → if passed, document `getTraceGraph` as browser-verified
6. Run Check T3 when wired
7. Update `docs/audit/adapter-source-status-matrix.md` after each pass

Do not mark any check as passed unless manually tested in Databricks Apps UAT.  
Do not claim browser verification for V1 legacy-api path — only for native Databricks routes.
