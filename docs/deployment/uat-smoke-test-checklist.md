# UAT Smoke-Test Checklist — ConnectIO V2

**Environment:** `https://connectio-v2-604667594731808.8.azure.databricksapps.com`
**Last updated:** 2026-05-17

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
- Record exact HTTP status and route for each failure and note here

| Route | HTTP status while V1 stopped | Notes |
|---|---|---|
| `POST /api/trace2/batch-header` | Expected 503 | |
| `GET /api/cq/lab/plants` | Expected 503 | |
| `POST /api/por/order-header` | Expected 503 | |
| `POST /api/wh360/warehouse-summary` | Expected 503 | |

---

## Section C — Native Databricks smoke test (PENDING — not yet active)

These tests confirm V2 can query Databricks directly using end-user OAuth. Requires switching `BACKEND_ADAPTER_MODE=databricks-api`.

**Current state:** `BACKEND_ADAPTER_MODE=legacy-api` — native reads not active.

### C1 — Prerequisites

1. Set required secrets in the `connectio-v2` scope:
   ```bash
   databricks secrets put-secret connectio-v2 databricks-host \
     --string-value "<workspace>.azuredatabricks.net"

   databricks secrets put-secret connectio-v2 sql-warehouse-id \
     --string-value "<warehouse-id>"

   databricks secrets put-secret connectio-v2 poh-catalog \
     --string-value "<catalog-name>"

   databricks secrets put-secret connectio-v2 cq-catalog \
     --string-value "<catalog-name>"
   ```

2. Update `apps/api/app.yaml` — change `BACKEND_ADAPTER_MODE` and uncomment native Databricks blocks:
   ```yaml
   - name: BACKEND_ADAPTER_MODE
     value: databricks-api
   - name: DATABRICKS_HOST
     valueFrom: connectio-v2/databricks-host
   - name: SQL_WAREHOUSE_ID
     valueFrom: connectio-v2/sql-warehouse-id
   - name: POH_CATALOG
     valueFrom: connectio-v2/poh-catalog
   - name: CQ_CATALOG
     valueFrom: connectio-v2/cq-catalog
   ```
   > **Reminder:** `valueFrom` must be `scope/key` as a plain string. Do NOT use nested YAML dicts.

3. Redeploy:
   ```bash
   npm run prepare:databricks
   databricks bundle deploy --target uat
   databricks apps deploy connectio-v2 \
     --source-code-path "/Workspace/Shared/.bundle/connectio-v2/uat/files/apps/api"
   ```

### C2 — OAuth header verification

Enable the diagnostic endpoint first:
```bash
# Option A: set via app.yaml literal
# Add to app.yaml env:
# - name: ENABLE_AUTH_DIAGNOSTICS
#   value: "true"

# Option B: set via secret
databricks secrets put-secret connectio-v2 enable-auth-diagnostics \
  --string-value "true"
# Reference in app.yaml:
# - name: ENABLE_AUTH_DIAGNOSTICS
#   valueFrom: connectio-v2/enable-auth-diagnostics
```

Then call the diagnostic endpoint from an authenticated browser session:
```
GET https://connectio-v2-604667594731808.8.azure.databricksapps.com/api/diagnostics/auth-headers
```

- [ ] `token_present: true` — `x-forwarded-access-token` is being injected
- [ ] `user_header_present: true` — `x-forwarded-user` is being injected
- [ ] `token_length_bucket: "long"` — token is a real OAuth JWT (≥ 500 chars)
- [ ] **Disable diagnostics** after verification (`ENABLE_AUTH_DIAGNOSTICS` absent or `"false"`)

### C3 — CQ lab plants (native Databricks)

```bash
curl -s https://connectio-v2-604667594731808.8.azure.databricksapps.com/api/cq/lab/plants \
  -H "Cookie: <auth-cookie-from-browser>" | jq .
```

- [ ] Returns HTTP 200 with plant list
- [ ] Response header `X-Data-Source: databricks-api` present
- [ ] Response header `X-Adapter-Mode: databricks-api` present
- [ ] No SPN/PAT token used — query executes as the end user's identity
- [ ] `databricks apps logs connectio-v2` shows `Executing Databricks statement` with `user_id` logged

### C4 — POH order header (native Databricks)

```bash
curl -s -X POST https://connectio-v2-604667594731808.8.azure.databricksapps.com/api/por/order-header \
  -H "Content-Type: application/json" \
  -H "Cookie: <auth-cookie-from-browser>" \
  -d '{"process_order_id": "<known-id>"}' | jq .
```

- [ ] Returns HTTP 200 with order data
- [ ] Response header `X-Data-Source: databricks-api` present
- [ ] Response header `X-Query-Name: poh.get_process_order_header` present

### C5 — Auth failure cases

- [ ] Without auth (no cookie / expired session): returns HTTP 401 — not a silent fallback to mock
- [ ] Confirm no 200 with mock data when token is absent

### C6 — No SPN/PAT fallback

- [ ] Check `databricks apps logs connectio-v2` — no log entries containing `service_principal`, `client_secret`, or `DATABRICKS_TOKEN`
- [ ] Confirm X-Data-Source header is `databricks-api`, not `mock` or `legacy-api`

---

## Notes

- SQL column names in POH and CQ adapters are marked TODO — queries may return 502 if actual column names differ from what V2 expects. Verify via `DESCRIBE TABLE <object>` in the target Unity Catalog.
- CQ Lab failures (`/api/cq/lab/fails`) is blocked pending `vw_gold_process_order_plan` availability — do not test until that view is confirmed.
- All tests in this checklist require a human in the loop with valid Databricks workspace access. Do not attempt to automate against live Databricks in CI.
