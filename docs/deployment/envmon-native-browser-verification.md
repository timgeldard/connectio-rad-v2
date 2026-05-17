# EnvMon Native Databricks — Browser Verification Checklist

**Date:** 2026-05-17  
**Updated:** 2026-05-17 (m.txt — corrected route; n.txt — DDL confirmed, route wired, status updated)  
**Status:** EXECUTABLE — route wired, DDL confirmed (2026-05-17); browser verification pending
**Reference:** `docs/migration/envmon-site-summary-native-route-plan.md`

---

## Current Status

**Route `GET /api/envmon/site-summary` is WIRED (n.txt, 2026-05-17).**

DDL confirmed for all three Group A views via `DESCRIBE TABLE` in `connected_plant_uat` on
2026-05-17. Route implemented in `apps/api/routes/envmon.py`, registered in `main.py`.
99 backend tests passing. Browser verification pending — requires deployment to UAT.

Previously blocking items (all resolved):

- [x] DDL confirmed for all three Group A views (2026-05-17)
- [x] `apps/api/routes/envmon.py` implemented (n.txt, 2026-05-17)
- [x] Route registered in FastAPI app (`main.py`)
- [x] All backend tests passing (99 tests)
- [ ] App deployed to UAT with `BACKEND_ADAPTER_MODE=databricks-api` — **pending**

---

## Route: `GET /api/envmon/site-summary`

**Status: EXECUTABLE — route wired, DDL confirmed; browser verification pending**

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
  "plantName": "",
  "zonesMonitored": 50,
  "zonesWithAlerts": 3,
  "positiveCount": 3,
  "positiveRate": 6.0,
  "openCorrectiveActions": 0,
  "overdueActions": 0,
  "complianceRate": 88.0,
  "riskStatus": "non-compliant",
  "highestSeverity": "high",
  "confidence": 1.0
}
```

**Note on partial coverage fields:** `plantName` returns `""` (no gold_plant JOIN in current SQL — PLACEHOLDER).
`openCorrectiveActions`/`overdueActions` return `0` — contract compatibility only; CAPA is out of scope for
EnvMon V2 parity and these values are fixed at 0. The remaining fields (`riskStatus`, `highestSeverity`,
`complianceRate`, `confidence`) are V2-contract derivations computed from inspection-lot aggregate counts —
not V1 business semantics.

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
| `openCorrectiveActions` or `overdueActions` non-zero | Unexpected — contract compatibility fixed zeros must not vary | Investigate mapper; CAPA is out of scope, these values are always 0 |

---

## Manual Result Record

| Date | Tester | Route | HTTP | `X-Data-Source` | `X-Query-Name` | Data returned | Notes |
|---|---|---|---|---|---|---|---|
| (pending) | — | `GET /api/envmon/site-summary?plant_id=C061&period_start=2026-01-01&period_end=2026-05-17` | — | — | — | — | Route wired (n.txt); DDL confirmed; browser verification pending |

**Do not mark any item above as verified without live UAT testing in Databricks Apps.**  
**Do not claim browser verification unless actually tested in Databricks Apps.**

---

## History

| Date | Tranche | Change |
|---|---|---|
| 2026-05-17 | j.txt | Created with placeholder routes `/api/envmon/locations` and `/api/envmon/swab-results` (pre-source-recovery) |
| 2026-05-17 | m.txt | Replaced with correct route `/api/envmon/site-summary`; marked BLOCKED by DDL; added required params, expected body shape, partial coverage note, full troubleshooting guide |
| 2026-05-17 | n.txt | DDL confirmed; route wired; status EXECUTABLE; body shape updated to V2 contract (EnvMonSiteSummarySchema); placeholder/derivation distinction clarified |
