# Trace Native — Browser Verification Checklist

**Date:** 2026-05-17  
**Status:** Routes not yet wired to Databricks — this checklist is prepared for when DDL is confirmed and routes are implemented.  
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

## Check T2 — POST /api/trace2/trace-graph (depth=1)

**Prerequisite:** Implement only after Check T1 passes.

**UI route:** Navigate to Trace Investigation workspace → enter material/batch → Trace Graph panel.

**Direct API call:**
```http
POST https://connectio-v2-604667594731808.8.azure.databricksapps.com/api/trace2/trace-graph
Content-Type: application/json

{
  "material_id": "000000000020052009",
  "batch_id": "0008602411"
}
```

**Expected response headers:**
```http
X-Data-Source: databricks-api
X-Adapter-Mode: databricks-api
X-Query-Name: trace2.get_trace_graph
```

**Expected response body shape:**
```json
{
  "nodes": [
    {
      "id": "<material_id>:<batch_id>",
      "type": "intermediate",
      "materialId": "<string>",
      "materialDescription": "<string or empty>",
      "batchId": "<string>",
      "plantId": "<string or null>"
    }
  ],
  "edges": [
    {
      "id": "<source_id>|<target_id>|<relationship_type>",
      "source": "<node_id>",
      "target": "<node_id>",
      "relationshipType": "produced-from" | "transferred-to" | "component-of" | "delivered-to" | "split-from" | "merged-into"
    }
  ],
  "direction": "both",
  "depth": 1,
  "rootBatch": "0008602411",
  "upstreamCount": <number>,
  "downstreamCount": <number>,
  "unresolvedNodeCount": 0
}
```

**Acceptable empty response (no lineage rows):**
```json
{
  "nodes": [],
  "edges": [],
  "direction": "both",
  "depth": 1,
  "rootBatch": "0008602411",
  "upstreamCount": 0,
  "downstreamCount": 0,
  "unresolvedNodeCount": 0
}
```

**Pass criteria:**
- [ ] HTTP 200
- [ ] `X-Data-Source: databricks-api` header present
- [ ] `X-Query-Name: trace2.get_trace_graph` header present
- [ ] Response is a JSON object with `nodes`, `edges`, `depth` fields
- [ ] No node has a null `id`, `materialId`, or `batchId`
- [ ] All edge `source` and `target` values correspond to node `id` values
- [ ] No duplicate node IDs
- [ ] No recursive edges (depth=1; no multi-hop paths)
- [ ] No 401/403/502/503

**Troubleshooting:**

| Status | Likely cause | Fix |
|---|---|---|
| 503 | Mode or catalog missing | Same as T1 |
| 401 | OAuth issue | Same as T1 |
| 403 | No SELECT on `gold_batch_lineage` | `GRANT SELECT ON VIEW connected_plant_uat.gold.gold_batch_lineage TO <user>` |
| 502 | language_id join failure | Verify `gold_material.language_id` column and 'EN' value |
| Empty graph | Test batch has no lineage records | Expected if batch entered production externally — try alternate anchor |

**Manual result:**

| Status | Date | Notes |
|---|---|---|
| [ ] not yet tested | — | Blocked — DDL verification incomplete; batch header not yet verified |

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
