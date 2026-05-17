# EnvMon Native Databricks Architecture Check

**Date:** 2026-05-17
**Tranche:** i.txt groundwork
**Scope:** Architecture guardrail verification for the EnvMon groundwork tranche
**Result:** ALL CHECKS PASS — vacuously, because no code was added

---

## Overview

No code was added to the EnvMon module in this tranche. All checks below are vacuously satisfied: there is no SQL, no routes, no QuerySpecs, and no frontend changes to evaluate. The checks are recorded here to establish a baseline for future tranches.

---

## Guardrail Checklist

### Structural Rules

| Rule | Status | Evidence |
|---|---|---|
| No SQL in React components | **Pass** | No EnvMon Databricks code added |
| No SQL in FastAPI routes | **Pass** | No EnvMon routes added |
| SQL only in QuerySpec factories | **Pass (vacuous)** | No QuerySpecs added |
| QueryExecutor used for all Databricks calls | **Pass (vacuous)** | No Databricks calls added |
| No new workspace added | **Pass** | EnvMon workspace already exists in product model |
| No broad API surface added | **Pass** | No routes added |

### Identity and Security Rules

| Rule | Status | Evidence |
|---|---|---|
| OAuth required (no SPN/PAT fallback) | **Pass (vacuous)** | No routes added |
| Missing OAuth returns 401 | **Pass (vacuous)** | No routes added |
| Missing config returns 503 | **Pass (vacuous)** | No routes added |
| No silent fallback to mock or legacy-api | **Pass (vacuous)** | No routes added |
| No service-principal credential use | **Pass** | `app.yaml` unchanged |

### Data Integrity Rules

| Rule | Status | Evidence |
|---|---|---|
| No invented field values | **Pass** | No mapping added |
| No fake browser verification | **Pass** | No verification claimed |
| No invented EnvMon risk scoring | **Pass** | No risk logic added |
| No speculative alerting workflow | **Pass** | No alert logic added |
| No unverified floor plan / heatmap data | **Pass** | Heatmap deferred with blocker documented |

---

## Known Concern: Panel Source Badge

All 8 EnvMon panels register `sourceOwnership: { domainId: 'envmon', systemName: 'lims', legacyAppId: 'lims' }`.

This is **not a code defect in the current tranche** — the panels are correctly attributed to LIMS because that is the intended source system. However, when a native Databricks slice is implemented:

- The `systemName: 'lims'` field will become misleading if the data now comes from Databricks
- The EvidencePanel component renders this field as a visible source badge to users
- Each panel's registration object must be updated at the time the native route is wired

**Action required at implementation time:** Update `systemName` in each affected panel's `sourceOwnership` registration. Do not update it before the native route is wired — the badge should reflect the actual active source, not the future intended source.

---

## Future Tranche Requirements

When a native EnvMon slice is implemented, the implementing developer must verify:

1. SQL is in a `QuerySpec` factory (`envmon_databricks_adapter.py`), not in a route or React component
2. The route uses `QueryExecutor` and calls `require_user_oauth()` before execution
3. `BACKEND_ADAPTER_MODE != 'databricks-api'` returns 503 (no mock fallback in the native route)
4. Route tests cover: success, 401, 403, 502, 503, 504 — no fallback assertions
5. All QuerySpec SQL uses `:param` binding — no f-string interpolation
6. Databricks objects are fully qualified (`catalog.schema.view`)
7. Panel source badge (`systemName`) is updated to reflect the actual Databricks source
8. No `confirmed-ddl` claim is made for any column unless `DESCRIBE TABLE` output was seen
9. No `browser-verified` claim is made unless the response was observed in UAT DevTools

This checklist must be re-run and updated for each new EnvMon route added.
