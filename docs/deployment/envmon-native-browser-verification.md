# EnvMon Native Databricks — Browser Verification Checklist

**Date:** 2026-05-17
**Tranche:** j.txt
**Status:** BLOCKED — no route wired; source view not confirmed
**Reference:** `docs/migration/envmon-first-native-slice-plan.md`

---

## Current Status

No EnvMon FastAPI routes exist. No Databricks QuerySpecs exist for EnvMon. All verification items below are pre-filled for reference — none can be checked until the source view is confirmed and the route is implemented.

This document is created now so that when a route is wired, the verification checklist is ready to fill in without additional doc work.

---

## Planned Route: `GET /api/envmon/locations`

**Status: NOT WIRED — deferred pending source view confirmation**

```
GET /api/envmon/locations?plant_id=C061
```

### Pre-conditions (must be true before testing)

- [ ] Source view confirmed via `DESCRIBE TABLE` (update `docs/audit/envmon-native-column-verification-checklist.md`)
- [ ] `envmon_databricks_adapter.py` QuerySpec implemented
- [ ] `apps/api/routes/envmon.py` route implemented
- [ ] Route registered in FastAPI app
- [ ] All backend tests passing
- [ ] App deployed to UAT

### Browser Verification Steps

1. Open `https://connectio-v2-604667594731808.8.azure.databricksapps.com` as an authenticated Databricks user
2. Open DevTools → Network tab
3. Navigate to the Environmental Monitoring workspace
4. Locate the locations/zones panel network request (or use DevTools filter)
5. Alternatively, test the API directly with valid auth cookie:

```
GET https://connectio-v2-604667594731808.8.azure.databricksapps.com/api/envmon/locations?plant_id=C061
```

### Pass Criteria

- [ ] Returns HTTP 200
- [ ] Response header `X-Data-Source: databricks-api` present
- [ ] Response header `X-Adapter-Mode: databricks-api` present
- [ ] Response header `X-Query-Name: envmon.get_locations` present
- [ ] Response body is a JSON array (may be empty if no data for plant C061 in UAT)
- [ ] If non-empty: each item has at minimum `locationId` and `plantId`
- [ ] `hygieneZone` values are one of: `zone-1`, `zone-2`, `zone-3`, `zone-4` (or absent if not in view)
- [ ] `areaType` values are one of: `production`, `storage`, `packaging`, `utility`, `corridor`, `other` (or absent if not in view)
- [ ] No SPN/PAT token used — check `databricks apps logs connectio-v2` for `service_principal` — must be absent
- [ ] 401 returned if session expires or cookie is absent

### Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| 401 Unauthorized | Missing or expired session cookie | Log in to the Databricks Apps URL and retry |
| 503 Service Unavailable | `BACKEND_ADAPTER_MODE` not `databricks-api`, or route config missing | Check `app.yaml` and redeploy |
| 502 Bad Gateway | Databricks query failed | Check `databricks apps logs connectio-v2` for SQL error |
| 504 Gateway Timeout | SQL timeout | Check query timeout in QuerySpec; check warehouse availability |
| 200 with empty array | No data for plant_id in UAT | Try a different `plant_id`; run `SELECT DISTINCT PLANT_ID FROM ...` in Databricks SQL Editor |
| `X-Data-Source` absent | Route missing header set logic | Add `run_query` helper call in the route |

---

## Planned Route: `GET /api/envmon/swab-results` (fallback slice)

**Status: NOT WIRED — deferred pending source view confirmation**

```
GET /api/envmon/swab-results?plant_id=C061&limit=100
```

Pass criteria and troubleshooting would mirror the locations route above, with these additions:

- [ ] Each item has `sampleId`, `locationId`, `sampleDate`, `testType`, `result`
- [ ] `result` values are one of: `negative`, `positive`, `borderline`, `pending`
- [ ] `sampleDate` is a valid ISO 8601 datetime string
- [ ] `resultValue` is a number (not a string) where present

---

## Manual Result Record

| Date | Tester | Route | HTTP | Data returned | X-Data-Source | Notes |
|---|---|---|---|---|---|---|
| (pending) | — | `/api/envmon/locations` | — | — | — | Route not yet wired |
| (pending) | — | `/api/envmon/swab-results` | — | — | — | Route not yet wired |

Update this table when browser verification is performed. Do not mark any item above as checked without live UAT verification.
