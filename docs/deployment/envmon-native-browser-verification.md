# EnvMon Native Databricks — Browser Verification Checklist

**Date:** 2026-05-17  
**Updated:** 2026-05-17 (m.txt — corrected route; added site-summary shape and params)  
**Status:** BLOCKED — DDL not confirmed; route not wired
**Reference:** `docs/migration/envmon-site-summary-native-route-plan.md`

---

## Current Status

**Route `GET /api/envmon/site-summary` is NOT WIRED.**

The route was not wired in m.txt because UAT DDL has not been confirmed for the required
SAP QM gold views. Per m.txt §6 and §12, the route may only be wired after
`DESCRIBE TABLE` verification in connected_plant_uat.

**Blocker:** DDL for `gold_inspection_lot`, `gold_inspection_point`, and
`gold_batch_quality_result_v` has not been run. See required SQL in
`docs/audit/envmon-native-column-verification-checklist.md`.

No browser verification items can be checked until:

- [ ] DDL confirmed for all three Group A views
- [ ] `apps/api/routes/envmon.py` implemented
- [ ] Route registered in FastAPI app
- [ ] All backend tests passing
- [ ] App deployed to UAT with `BACKEND_ADAPTER_MODE=databricks-api`

---

## Route: `GET /api/envmon/site-summary`

**Status: NOT WIRED — blocked by DDL**

```
GET /api/envmon/site-summary?plant_id=C061&period_start=2026-01-01&period_end=2026-05-17
```

### Required query parameters

| Parameter | Required | Example | Notes |
|---|---|---|---|
| `plant_id` | Yes | `C061` | SAP plant code — no default |
| `period_start` | Yes | `2026-01-01` | ISO date — no default unbounded range |
| `period_end` | Yes | `2026-05-17` | ISO date — no default |

### Expected: success

| Property | Expected value |
|---|---|
| HTTP status | 200 |
| `X-Data-Source` header | `databricks-api` |
| `X-Adapter-Mode` header | `databricks-api` |
| `X-Query-Name` header | `envmon.get_site_summary` |
| Body shape | `EnvMonSiteSummary` (see below) |

### Expected body shape

```json
{
  "plantId": "C061",
  "totalSamples": 142,
  "positiveSamples": 3,
  "positiveRate": 0.021,
  "criticalZoneExposures": 0,
  "openCorrectiveActions": 0,
  "trendDirection": "stable"
}
```

**Important:** `criticalZoneExposures`, `openCorrectiveActions`, and `trendDirection` are
TEMPORARY CONTRACT PLACEHOLDERS — not business facts. `0` does not mean "no exposures" or
"no open actions"; `"stable"` is a schema default, not a calculated signal. These fields
will remain placeholders until em_* spatial tables and CAPA sources are confirmed.

### Expected: error cases

| Condition | Expected HTTP status | How to trigger |
|---|---|---|
| Session expired or no cookie | 401 | Clear session cookies and retry |
| Wrong `BACKEND_ADAPTER_MODE` | 503 | Deploy with `BACKEND_ADAPTER_MODE=legacy-api` or unset |
| Missing Databricks config | 503 | Remove `DATABRICKS_HOST` from app.yaml |
| UC permission denied | 403 | Remove UC permissions for the user's identity on gold views |
| Rate limit | 429 | Trigger many rapid requests |
| SQL/query error | 502 | Introduce bad SQL or wrong view name |
| Timeout | 504 | Use a warehouse that is suspended and slow to start |

### Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| 401 Unauthorized | Missing or expired Databricks Apps session | Log in at the Databricks Apps URL and retry |
| 503 Service Unavailable | `BACKEND_ADAPTER_MODE != databricks-api` | Check `app.yaml` → `BACKEND_ADAPTER_MODE` value; redeploy |
| 503 missing config | `DATABRICKS_HOST` or `DATABRICKS_WAREHOUSE_ID` unset | Check app.yaml secrets; confirm warehouse ID |
| 403 Forbidden | User lacks UC SELECT on `connected_plant_uat.gold.*` | Check UC permissions via Databricks admin |
| 429 Too Many Requests | Statement-level rate limit hit | Wait and retry; check cluster/warehouse limits |
| 502 Bad Gateway | Databricks query failed | Check `databricks apps logs connectio-v2` for SQL error; verify view names |
| 504 Gateway Timeout | SQL timeout | Check warehouse availability; increase timeout in QuerySpec if needed |
| 200 with zeros | No data for plant_id / period | Run `SELECT DISTINCT PLANT_ID FROM connected_plant_uat.gold.gold_inspection_lot WHERE INSPECTION_TYPE IN ('14','Z14')` to find valid plant IDs |
| `X-Data-Source` absent | Route not implementing header set | Verify `set_databricks_response_headers` is called in route |
| `criticalZoneExposures` non-zero | Unexpected — placeholder should return 0 | Investigate mapper; placeholder must not vary |

---

## Manual Result Record

| Date | Tester | Route | HTTP | `X-Data-Source` | `X-Query-Name` | Data returned | Notes |
|---|---|---|---|---|---|---|---|
| (pending) | — | `GET /api/envmon/site-summary?plant_id=C061&period_start=2026-01-01&period_end=2026-05-17` | — | — | — | — | Route not wired — DDL pending |

**Do not mark any item above as verified without live UAT testing in Databricks Apps.**  
**Do not claim browser verification unless actually tested in Databricks Apps.**

---

## History

| Date | Tranche | Change |
|---|---|---|
| 2026-05-17 | j.txt | Created with placeholder routes `/api/envmon/locations` and `/api/envmon/swab-results` (pre-source-recovery) |
| 2026-05-17 | m.txt | Replaced with correct route `/api/envmon/site-summary`; marked BLOCKED by DDL; added required params, expected body shape, partial coverage note, full troubleshooting guide |
