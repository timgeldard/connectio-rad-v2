# Native Databricks Execution Readiness

**Date:** 2026-05-17 (updated — l.txt hardening tranche)
**Scope:** k.txt tranche — first executable Databricks read path; l.txt — hardening and verification readiness
**References:** ADR-024, ADR-025

---

## Purpose

Documents the current state of the native Databricks read path after the k.txt tranche. Replaces the "not yet implemented" status from pre-k.txt with accurate post-implementation status.

---

## QuerySpec fields — implemented

| Field | Implemented | Notes |
|---|---|---|
| `name` | Yes | Dot-qualified, e.g. `"poh.get_process_order_header"` |
| `module` | Yes | Domain identifier |
| `endpoint` | Yes | FastAPI route path |
| `sql` | Yes | `:param` syntax; `LIMIT :max_rows` in all query SQL |
| `params` | Yes | Merged with `max_rows` by QueryExecutor before client call |
| `cache_policy` | Yes | `CacheTier` enum; not yet active (no cache backend) |
| `source_badge` | Yes | Forwarded to `X-Data-Source` response header in both routes |
| `catalog_override` | Yes (field) | Not used by current slices; wh360 deferred |
| `schema_override` | Yes (field) | Not used by current slices |
| `max_rows` | Yes | Merged into `params` as `"max_rows"` int value |
| `timeout_seconds` | Yes | Forwarded to client as `wait_timeout: "{n}s"` |
| `tags` | Yes | List[str] merged into `dict[str,str]` and logged; not sent to Statement API |

---

## QueryExecutor — current behaviour

| Behaviour | Status |
|---|---|
| Requires `UserIdentity` with `raw_oauth_token` | Yes — `require_user_oauth()` called first |
| Refuses execution without token | Yes — raises `DatabricksAuthRequiredError` |
| Merges `max_rows` into params | Yes |
| Builds tags dict with query metadata + user_id | Yes |
| Calls `DatabricksQueryClient.execute()` | Yes (async) |
| Returns rows as `list[dict]` | Yes |
| Does not read service-principal env vars | Confirmed in tests |
| Does not mutate spec.params | Confirmed in tests |
| Cache layer | Not active — no cache backend yet (ADR-024 open question #7) |

---

## Databricks client — current status

| Client | Status |
|---|---|
| `DatabricksQueryClient` (ABC) | Implemented |
| `StatementApiDatabricksClient` | Implemented — httpx, async, Statement API |
| `NotImplementedDatabricksClient` | Retained as fallback for unwired adapters |

`StatementApiDatabricksClient` uses:
- `POST https://{DATABRICKS_HOST}/api/2.0/sql/statements`
- `Authorization: Bearer {oauth_token}` — user token forwarded verbatim
- `wait_timeout: "{n}s"`, `on_wait_timeout: "CANCEL"` — synchronous or cancel
- `disposition: "INLINE"`, `format: "JSON_ARRAY"`
- Typed parameter list for all bound parameters

Query tags are not natively supported by the Statement API. Tags are logged via Python `logging`.

---

## OAuth identity extraction — current status

| Header | Role | Status | Verified in Databricks Apps? |
|---|---|---|---|
| `x-forwarded-access-token` | OAuth bearer token | Assumed — MUST verify | No — TODO |
| `x-forwarded-user` | User identifier | Assumed — MUST verify | No — TODO |
| `x-forwarded-email` | User email | Assumed — MUST verify | No — TODO |

`extract_user_identity()` FastAPI dependency is implemented in `shared/query_service/identity.py`. Header names are marked `TODO: Verify` pending Databricks Apps deployment.

Missing OAuth token does not raise in `extract_user_identity()` — the caller (route) is responsible for calling `identity.require_user_oauth()` via the executor, which raises `DatabricksAuthRequiredError` → HTTP 401.

---

## Cache status

**Not active.** ADR-024 open question #7 (in-process LRU vs Redis/Lakebase) is not resolved. `CacheTier` values are assigned to all QuerySpecs but not enforced at runtime.

---

## Query tagging status

**Partial.** Tags are built by `QueryExecutor` and logged. They are not forwarded to Databricks natively because the Statement API has no tag field. Future work: investigate `custom_tags` or `query_text` annotation approaches.

---

## Route integration status

| Route | Mode gate | Databricks path | Legacy path preserved | Response headers (databricks-api mode) |
|---|---|---|---|---|
| `POST /api/por/order-header` | Yes — `BACKEND_ADAPTER_MODE` | Yes — `_order_header_databricks()` | Yes | `X-Data-Source`, `X-Adapter-Mode`, `X-Query-Name` |
| `GET /api/cq/lab/plants` | Yes — `BACKEND_ADAPTER_MODE` | Yes — `_lab_plants_databricks()` | Yes | `X-Data-Source`, `X-Adapter-Mode`, `X-Query-Name` |
| `GET /api/cq/lab/fails` | No gate needed | N/A — blocked | Yes | N/A |
| `POST /api/trace2/batch-header` | No gate — not wired yet | No | Yes | N/A |
| `GET /api/diagnostics/auth-headers` | Env var gate — `ENABLE_AUTH_DIAGNOSTICS=true` | N/A (diagnostic only) | N/A | N/A |

---

## Known blockers

### Must-verify before production use

1. **Databricks Apps OAuth header names**: `x-forwarded-access-token`, `x-forwarded-user`, `x-forwarded-email` assumed from documentation. Must be confirmed by inspecting request headers in a deployed Databricks App.

2. **POH column names**: All SQL column names in `get_process_order_header_spec` are TODO-marked (inferred from SAP AUFNR/AUART/MATNR conventions). Must run `DESCRIBE TABLE connected_plant_uat.vw_gold_process_order` to confirm.

3. **CQ Lab column names**: `werks`/`name1` → `plant_id`/`plant_name` aliases in `get_lab_plants_spec` are TODO-marked. Must confirm against `DESCRIBE TABLE connected_plant_uat.gold_plant`.

4. **POH order status mapping**: `objnr` column alias → status mapping is approximate. The actual gold view may expose a status text column rather than the SAP status object number. Must verify with `DESCRIBE TABLE` and inspect sample rows.

5. **Cache backend** (ADR-024 open question #7): No active cache. All Databricks queries go to the warehouse on every request.

### Deferred by design

6. **Trace batch header route wiring**: 6 unverified column TODOs in `gold_batch_summary_v`. Route wiring deferred until `DESCRIBE TABLE` confirms all column names.

7. **Recursive Trace graph**: Deferred per k.txt rules.

8. **CQ Lab failures**: `vw_gold_process_order_plan` view missing — route implementation blocked.

---

## How to test locally with mocked Databricks client

```bash
# From repo root
cd apps/api

# Run all tests (uses NotImplementedDatabricksClient by default — no real Databricks needed)
python -m pytest -q

# Run specific shared tests
python -m pytest tests/shared/ -q

# Run route tests (route tests patch StatementApiDatabricksClient.execute)
python -m pytest tests/routes/ -q
```

All 276 tests pass without a Databricks connection (250 from k.txt tranche + 26 new in l.txt hardening tranche).

---

## How to test in Databricks Apps with a real user OAuth token

1. Deploy the app: `databricks apps deploy connectio-v2 --source-code-path apps/api`

2. Set secrets (one-time):
   ```bash
   databricks secrets put-secret connectio-v2 databricks-host \
     --string-value "<your-workspace>.azuredatabricks.net"
   databricks secrets put-secret connectio-v2 sql-warehouse-id \
     --string-value "<warehouse-id>"
   ```

3. Update `apps/api/app.yaml` — change `BACKEND_ADAPTER_MODE` to `databricks-api` and uncomment the `DATABRICKS_HOST`/`SQL_WAREHOUSE_ID` `valueFrom.secretScope` blocks (already present in app.yaml as commented-out placeholders).

4. Redeploy and open the app in a browser (as an authenticated Databricks user).

5. Navigate to the Process Order Review workspace. The POH header panel should load data from Databricks.

6. Check `databricks apps logs connectio-v2` for `Executing Databricks statement` log entries confirming user_id and query_name.

7. Verify these headers are present in browser DevTools → Network → the order-header request:
   - `X-Data-Source: databricks-api`
   - `X-Adapter-Mode: databricks-api`
   - `X-Query-Name: poh.get_process_order_header`

8. Before switching to databricks-api, enable `ENABLE_AUTH_DIAGNOSTICS=true` and call `GET /api/diagnostics/auth-headers` to confirm the OAuth headers are injected. See `docs/audit/databricks-apps-oauth-header-verification.md`.

9. If the panel shows a 401 error: OAuth header names differ from assumed values. Inspect the actual headers in the Databricks Apps logs and update `identity.py`.

10. Column name verification: if data returns but fields show empty values, the SQL column aliases are wrong. Run `DESCRIBE TABLE` queries from `docs/audit/native-databricks-column-verification-checklist.md`.
