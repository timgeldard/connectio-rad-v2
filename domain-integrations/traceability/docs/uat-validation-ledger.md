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
**Fixed in:** Not yet fixed  
**Status:** Open — known gap, not scheduled in current tranche

**Description:**  
The `TraceGraph` data-contract schema has a `truncated` boolean field. The reference Python engine sets this to `true` when the recursive CTE reaches the configured depth limit, preventing an investigator from assuming the displayed graph is the full lineage. In the current V2 mock, `truncated` is never set to `true` and no UI element surfaces a truncation indicator.

An investigator viewing a large batch lineage graph in V2 currently cannot know whether the graph they see is complete or a subset.

**UAT verification:** Scenario 8 in `uat-acceptance-script.md`. Expected to fail until this gap is addressed.

---

### DEF-TRACE-003 — HIGH severity label refers to shelf-life only, not lineage depth

**Identified:** Code review against mb56 reference behaviour  
**Fixed in:** Not applicable — this is a behavioural gap, not a regression  
**Status:** Open — documented in `mb56-parity-review.md`

**Description:**  
In `InvestigationSummary.tsx`, the severity label "HIGH" (labelled "Near Expiry" in the UI) is triggered only when the batch is approaching or past its expiry date. The V1 reference engine assigns HIGH risk based on lineage depth (depth 2+ with shipped exposure). V2 does not implement depth-based recall tiering. An investigator assessing a batch with second-hop indirect customer exposure may see a lower severity than the risk warrants.

**UAT verification:** No current test scenario covers this gap directly. Requires a batch with known second-hop downstream exposure and confirmed behaviour in V1 for comparison.

---

## How to add a defect

If a UAT session reveals a new defect, add an entry to the pre-validation (or post-validation) defects section above with:

- A sequential `DEF-TRACE-NNN` identifier.
- The run ID that surfaced the defect.
- A brief description of the incorrect behaviour and the expected behaviour.
- The scenario reference from `uat-acceptance-script.md`.
- Status: open / fixed / closed.

Cross-reference the defect in the run table row that found it.
