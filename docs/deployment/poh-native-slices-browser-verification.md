# POH Native Slices — Browser Verification Checklist

**Date:** 2026-05-17  
**Status:** Not yet verified — complete each item below in the UAT environment before marking done  
**App URL:** `https://connectio-v2-604667594731808.8.azure.databricksapps.com`  
**Reference:** `docs/audit/adapter-source-status-matrix.md`

---

## Prerequisites

Before running any check:
- UAT app must be RUNNING: `databricks apps get connectio-v2` → state = RUNNING
- `BACKEND_ADAPTER_MODE=databricks-api` confirmed in `apps/api/app.yaml`
- Authenticated as a Databricks user with `sql` scope in `effective_user_api_scopes`
- Browser DevTools → Network panel open

---

## 1. `GET /api/por/order-operations` — NOT YET VERIFIED

**UI route:** Navigate to a process order in Process Order Review, then to the Operations/Phases tab.

**Direct API call (DevTools or curl):**
```
GET https://connectio-v2-604667594731808.8.azure.databricksapps.com/api/por/order-operations?process_order_id=7006965038
```
No request body required. OAuth cookie/header forwarded automatically by the browser when using the Databricks Apps URL.

**Expected response headers:**
```
X-Data-Source: databricks-api
X-Adapter-Mode: databricks-api
X-Query-Name: poh.get_order_operations
```

**Expected response body shape:**
```json
[
  {
    "operationId": "<string — from PROCESS_ORDER_PHASE_ID>",
    "operationNumber": "<string — from PHASE_ID e.g. '0010'>",
    "operationText": "<string — from PHASE_DESCRIPTION>",
    "workCentre": "",
    "plannedStart": "",
    "plannedFinish": "",
    "plannedDurationMinutes": 0,
    "status": "pending" | "in-progress" | "confirmed",
    "confirmationStatus": "unconfirmed" | "partially-confirmed" | "final-confirmed",
    "confirmed": true | false,
    "hasException": false
  }
]
```

**Known acceptable gaps:**
- `workCentre`, `plannedStart`, `plannedFinish`, `plannedDurationMinutes`, `hasException` will be empty/zero — this is by design, not an error. `vw_gold_process_order_phase` does not expose these columns.
- An empty array `[]` is a valid response if process order 7006965038 has no phase rows in the view.

**Pass criteria:**
- [ ] HTTP 200
- [ ] `X-Data-Source: databricks-api` header present
- [ ] `X-Query-Name: poh.get_order_operations` header present
- [ ] Response is a JSON array (may be empty)
- [ ] If non-empty: `operationId`, `operationNumber`, `operationText` are non-empty strings
- [ ] No 401/403/502/503

**Result:** `[ ] PASS` / `[ ] FAIL` — Date: ___________

---

## Troubleshooting

| Status | Likely cause | Fix |
|--------|-------------|-----|
| 401 | OAuth token missing or `sql` scope not in user token | Run `databricks bundle deploy --target uat` to re-apply `user_api_scopes: [sql]` |
| 403 | User lacks SELECT on `vw_gold_process_order_phase` | Grant: `GRANT SELECT ON VIEW connected_plant_uat.csm_process_order_history.vw_gold_process_order_phase TO <user>` |
| 503 (databricks-api message) | `BACKEND_ADAPTER_MODE` is not `databricks-api` | Check `apps/api/app.yaml` env section |
| 503 (DATABRICKS_HOST) | `DATABRICKS_HOST` or `SQL_WAREHOUSE_ID` not set | Check `apps/api/app.yaml` literals |
| 502 | Databricks SQL warehouse unreachable or query error | Check `databricks apps logs connectio-v2` for exception details |
| Empty array | Process order 7006965038 has no phases in `vw_gold_process_order_phase` | Try another process order, or run `SELECT COUNT(*) FROM connected_plant_uat.csm_process_order_history.vw_gold_process_order_phase WHERE PROCESS_ORDER_ID = '7006965038'` in the workspace |

---

## Already verified (for reference)

| Route | Status | Date | Process order |
|-------|--------|------|--------------|
| `POST /api/por/order-header` | **PASS** | 2026-05-17 | 7006965038 |
| `GET /api/cq/lab/plants` | **PASS** | 2026-05-17 | N/A |
