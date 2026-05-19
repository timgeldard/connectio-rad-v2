# UAT Validation Ledger — Traceability Investigation Cockpit (V2)

**Status:** Pre-validation  
**Date opened:** 2026-05-19  
**Audience:** QA, food safety, supply chain — and the engineering team during review

> **Mock-only constraint.**
> As of 2026-05-19, the V2 traceability cockpit is backed by mock data only. No browser or Databricks session has been performed against a live source. This ledger is open and awaiting first UAT run. Nothing recorded below constitutes a parity claim between V2 and V1.

---

## Purpose

This ledger tracks every UAT run of the V2 Traceability Investigation Cockpit. It records:

- which batches were tested and by whom
- the app version (git commit) in use at the time
- the environment the session ran against
- which test scenarios were executed (keyed to `uat-acceptance-script.md`)
- the result of each scenario (pass / fail / blocked)
- any defects found, with enough detail to reproduce

The ledger is a living document. Each UAT run adds one or more rows to the run table below. Rows are never deleted — if a previous result is overturned, add a new row with a reference to the original run ID.

---

## Validation not yet performed

As of **2026-05-19**, no browser-verified or Databricks-validated UAT session has been performed on V2. The cockpit is mock-only.

Implications:
- No panel in V2 has been confirmed to return correct data from a live source.
- No parity claim between V2 and V1 can be made until at least one batch has been validated against a live Databricks gold view or a browser-verified legacy-api response.
- The mock development batch (material `100023847`, batch `CH-240308-0047`, plant `IE10`) is a fictional fixture — it does not exist in any production system and cannot be used to demonstrate live parity.
- The reference candidate batch (material `000000000020052009`, batch `0008602411`, plant `C061`) has not been tested in V2. Its expected behaviour is unknown.

First UAT is expected to occur once:
1. The V2 app is deployed to a live Databricks Apps environment with OAuth authentication.
2. A tester with `trace.read` permission can log in and submit a real batch via the query form.
3. The Databricks SQL adapter (not the mock) is activated (requires `VITE_ADAPTER_MODE` or equivalent configuration to be set to a live source).

---

## First Live Validation Run — Preparation

This section pre-defines exactly what to capture when a tester runs the first live Databricks-connected session. No values are filled in; the section acts as a template. Copy it into a new run entry in the [Run table](#run-table) when the session is complete.

### Candidate batch

| Field | Value |
|---|---|
| material_id | `000000000020052009` |
| batch_id | `0008602411` |
| plant_id | `C061` |

This batch was selected because its lineage rows exist in the `gold_batch_lineage` view (confirmed from V1 source inspection) and it was the fixture anchor in adapter integration tests. It is the most likely batch to return non-empty data from a fresh query. See `golden-test-batches.md` for the full justification.

### Environment prerequisites

Before running, confirm all of the following:

- [ ] V2 app deployed to a Databricks Apps environment (not a local dev server with mock data)
- [ ] `VITE_ADAPTER_MODE` (or equivalent) is set to `databricks-api` — confirm via the source badge shown on each panel
- [ ] Tester is authenticated via AAD OAuth (not a service principal)
- [ ] Unity Catalog grants for `gold_batch_stock_v`, `gold_batch_lineage`, `gold_batch_mass_balance_v`, `gold_material`, `gold_plant` are active for the tester's identity
- [ ] `gold_batch_summary_v` column names have been verified against the live catalog (see `databricks-column-verification-queries.md`)

### What to capture

Fill these in during the session. Record only observed values — do not infer or extrapolate.

| Evidence field | What to record | Value |
|---|---|---|
| Session date | YYYY-MM-DD | — |
| App version commit | `git rev-parse --short HEAD` on the deployed build | — |
| App URL / environment name | Full URL or environment label | — |
| Tester identity | Name or email (no tokens, no credentials) | — |
| Adapter mode confirmed | Source badge text shown on batch header panel | — |
| **Batch header** | | |
| Batch header — returned? | Yes / No / Error | — |
| Batch header — batchStatus value | Exact value as shown in UI | — |
| Batch header — stockStatus value | Exact value as shown in UI | — |
| Batch header — qualityStatus value | Exact value as shown in UI | — |
| Batch header — releaseStatus value | Exact value as shown in UI | — |
| Batch header — plantName | Populated or blank | — |
| Batch header — manufactureDate | Populated or blank | — |
| Batch header — expiryDate | Populated or blank | — |
| **Trace graph** | | |
| Trace graph — returned? | Yes / No / Error | — |
| Trace graph — node count | Integer | — |
| Trace graph — edge count | Integer | — |
| Trace graph — truncated flag | true / false / not shown | — |
| Trace graph — truncation banner shown? | Yes / No | — |
| Trace graph — linkType examples | List up to 3 raw LINK_TYPE values as shown in edge details | — |
| Trace graph — relationshipType examples | Mapped values from those edges | — |
| Trace graph — upstream nodes | Count of nodes with direction upstream | — |
| Trace graph — downstream nodes | Count of nodes with direction downstream | — |
| **Mass balance** | | |
| Mass balance — returned? | Yes / No / Error | — |
| Mass balance — confidence value | 0.0 – 1.0 as shown | — |
| Mass balance — unresolvedMovements | Integer | — |
| Mass balance — movement row count | Integer | — |
| **Quality / CoA** | | |
| Quality status source | Label shown in UI (e.g. "QI stock", "unknown") | — |
| CoA panel — returned? | Yes / No / Error / Not implemented | — |
| **Customer exposure** | | |
| Customer exposure — returned? | Yes / No / Error | — |
| Customer exposure — severity banner | Exact banner text shown | — |
| Customer exposure — affectedCustomers | Integer or "data unavailable" | — |
| Customer exposure — shippedQuantity | Value or "data unavailable" | — |
| **Other** | | |
| Any error messages shown | Exact text | — |
| Screenshots taken? | Yes / No | — |
| Defects observed | Brief description or "none" | — |

### Quality status interpretation note

If `qualityStatus` returns `"unknown"`: this is the **expected safe result** from the current adapter when no QI stock is present and no QM usage-decision field is available. It does not mean the batch was accepted — it means the information needed to make that determination was not in the query. Record it as-is and do not interpret it as positive quality signal.

If `qualityStatus` returns `"pending"`: QI stock > 0 was detected. An open quality inspection is in progress. Do not release or conclude quality status from this run alone.

### After the session

1. Create a new row in the [Run table](#run-table) with the evidence captured above.
2. Update any defect entries that were resolved or reproduced.
3. Update `production-readiness-checklist.md` rows 1.1, 1.2, 1.5, 3.2, 3.4 to reflect the result.
4. If `gold_batch_summary_v` column names were verified, update `databricks-column-verification-queries.md` with date, environment, and confirmed columns.

---

## Run table

| run_id | date | environment | app_version_commit | tester | batch_tested | scenario_ref | result | defects_found | notes |
|---|---|---|---|---|---|---|---|---|---|
| UAT-TRACE-001 | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | First expected UAT run — awaiting live environment deployment |

---

## Table column definitions

| Column | Description |
|---|---|
| `run_id` | Sequential identifier, format `UAT-TRACE-NNN`. Increment by 1 per run. |
| `date` | Date of the session in YYYY-MM-DD format. |
| `environment` | Name of the target environment (e.g. `databricks-apps-dev`, `databricks-apps-uat`). |
| `app_version_commit` | The short git commit SHA (`git rev-parse --short HEAD`) of the build under test. |
| `tester` | Name or email of the person who ran the session. |
| `batch_tested` | The material ID, batch ID, and plant ID entered in the query form (format: `materialId / batchId / plantId`). |
| `scenario_ref` | Scenario number(s) from `uat-acceptance-script.md` exercised in this run (e.g. `S1, S2, S3`). |
| `result` | `pass` — all pass criteria met; `fail` — one or more fail criteria triggered; `blocked` — scenario could not be executed (state the blocker in notes). |
| `defects_found` | Short description of any defect, or "none". Reference a defect ID if one is raised. |
| `notes` | Any context useful for the next run — environment issues, workarounds used, follow-up actions. |

---

## Known pre-validation defects

These defects were identified by code review before any UAT run was performed. They are recorded here so that testers know what to look for and can confirm resolution during live sessions.

---

### DEF-TRACE-001 — Null customerExposure silently defaulted severity to LOW

**Identified:** Code review, prior to UAT  
**Fixed in:** Commits `74f4b5c` and `1612703` on `main` (part of the traceability recall-maturity hardening branch, merged after PR #23)  
**Status:** Fix present in codebase — not yet confirmed by live UAT session

**Description:**  
When the customer delivery data source was unavailable (i.e. the adapter returned `ok: false` for `getCustomerExposureSummary`, resulting in a null `customerExposure` value in the cockpit), the Investigation Summary component was silently treating null as equivalent to zero shipments and displaying "Low Risk" severity. This would falsely signal to an investigator that the batch was contained, when in fact the delivery data had simply not loaded.

**Behaviour before fix:**
- `customerExposure === null` produced severity "Low Risk" (green banner).
- "Total Shipped" showed 0 KG.
- "Downstream Exposure" showed "across 0 countries".

**Behaviour after fix (expected):**
- `customerExposure === null` produces severity "Exposure Unknown" (amber/warn banner).
- Alert message reads: "Customer delivery data is unavailable. Downstream exposure cannot be assessed — do not assume containment."
- "Total Shipped" shows "?".
- "Downstream Exposure" sub-label reads "data unavailable".

**UAT verification:** Scenario 10 in `uat-acceptance-script.md`. The fix cannot be exercised via the default mock fixture — it requires triggering a null adapter response (controlled error injection or live source failure).

---

### DEF-TRACE-002 — Truncation state not surfaced in trace graph UI

**Identified:** Gap analysis (`mb56-parity-review.md`), prior to UAT  
**Fixed in:** Current tranche — `trace-graph-panel.tsx` truncation banner  
**Status:** Code-fixed — live validation pending

**Description:**  
The `TraceGraph` data-contract schema has a `truncated` boolean field. The reference Python engine sets this to `true` when the recursive CTE reaches the configured depth limit, preventing an investigator from assuming the displayed graph is the full lineage.

**Behaviour after fix (expected):**  
An amber banner is shown when `truncated === true`, `max_depth_reached` is in `warnings`, or `max_edges_reached` is in `warnings`. The banner reads: "Trace graph truncated — the displayed lineage may be incomplete because the max depth or row limit was reached. Review with a deeper trace or Databricks validation before concluding exposure is complete."

**UAT verification:** Scenario 8 in `uat-acceptance-script.md`. Requires a live Databricks lineage query that reaches the depth or edge limit to confirm the banner appears.

---

### DEF-TRACE-003 — HIGH severity label refers to shelf-life only, not lineage depth

**Identified:** Code review against mb56 reference behaviour  
**Fixed in:** Current tranche — `InvestigationSummary.tsx` depth-aware severity (TRACE-P0-003)  
**Status:** Schema/code-ready — live data population pending

**Description:**  
In `InvestigationSummary.tsx`, the severity label "HIGH" (labelled "Near Expiry" in the UI) was triggered only when the batch was approaching or past its expiry date. The V1 reference engine assigns HIGH risk based on lineage depth (depth 2+ with shipped exposure). V2 did not implement depth-based recall tiering.

**Behaviour after fix (expected):**  
`maxExposureDepth` added to `CustomerExposureSummarySchema`. When populated: depth=1+shipped→CRITICAL, depth≥2+shipped→HIGH ("multi-hop indirect exposure"), depth≥2 no-ship→MEDIUM. When `maxExposureDepth` is absent (current mock mode), severity falls back to the conservative shipped/not-shipped binary logic — no change in mock behaviour.

**Blocker:** The `maxExposureDepth` field requires the customer-exposure Databricks slice to be implemented and validated against live lineage data. The field is intentionally absent from the mock fixture.

**UAT verification:** Requires a batch with known second-hop downstream exposure. Compare displayed severity to reference engine output for that batch.

---

### DEF-TRACE-004 — Batch header not-found / error state was invisible in the cockpit header

**Identified:** Code review — TRACE-P1-003  
**Fixed in:** Current tranche — `overview-view.tsx` `BatchHeaderErrorBanner`  
**Status:** Code-fixed — live validation pending

**Description:**  
When the batch-header adapter returned `{ ok: false }` (not-found, unauthorized, timeout, or other error), `overview-view.tsx` silently converted the error to `batchHeader = null`. The `InvestigationSummary` received null `batchHeader` and showed a generic "Loading material..." state with no error detail, regardless of whether the cause was loading, a bad batch ID, or an access-control failure.

**Behaviour after fix (expected):**  
`overview-view.tsx` now checks `batchHeaderResult !== undefined && !batchHeaderResult.ok`. When true, a `BatchHeaderErrorBanner` is rendered above the cockpit with the appropriate heading:
- "Batch not found" for `code: 'not-found'`
- "Not authorized or data not accessible" for `code: 'unauthorized'`
- "Data source timeout" for `code: 'timeout'`
- "Batch header unavailable" for other error codes

The loading state (result still `undefined`) does not trigger the banner, so normal load-in behaviour is unchanged.

**UAT verification:** Submit a batch ID that is known not to exist in the live system and confirm "Batch not found" renders in the cockpit header. Test with a user whose OAuth identity does not have `trace.read` grant to confirm "Not authorized" banner.

---

## How to add a defect

If a UAT session reveals a new defect, add an entry to the pre-validation (or post-validation) defects section above with:

- A sequential `DEF-TRACE-NNN` identifier.
- The run ID that surfaced the defect.
- A brief description of the incorrect behaviour and the expected behaviour.
- The scenario reference from `uat-acceptance-script.md`.
- Status: open / fixed / closed.

Cross-reference the defect in the run table row that found it.
