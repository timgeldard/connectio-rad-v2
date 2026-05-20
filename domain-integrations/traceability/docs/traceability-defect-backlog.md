# Traceability Defect Backlog

**Domain:** `domain-integrations/traceability`
**Last updated:** 2026-05-20
**Classification:** P0 = could mislead recall/exposure decisions · P1 = blocks credible UAT · P2 = improves trust/usability · P3 = future enhancement

---

## P0 — Could Mislead Recall or Exposure Decisions

### TRACE-P0-001 — Null customerExposure silently shows Low Risk severity
**Status:** Fixed (PR #24, commits 74f4b5c + 1612703)
**Affected:** `InvestigationSummary.tsx`, overview view
**Evidence:** When the delivery data source fails or is unavailable, `customerExposure === null` fell through to the LOW severity branch, displaying "Low Risk" and implying the batch was contained. An investigator could conclude no recall action was needed when exposure was simply unknown.
**Risk:** False containment signal during an active recall investigation.
**Fix applied:** `customerExposure === null` now branches to `UNKNOWN` severity with explicit "do not assume containment" guidance. Metric cells show "data unavailable" rather than "0".
**Requires UAT:** Yes — confirm UNKNOWN banner renders correctly in deployed app when delivery API is down.

### TRACE-P0-002 — No link-type discrimination on trace graph edges
**Status:** Code fixed by PR #26 (linkType passthrough added to `TraceEdgeSchema`, expanded `relationshipType` enum with `vendor-receipt` and `consumed-by`, VENDOR_RECEIPT/CONSUMPTION discrimination added in graph mapper). Live Databricks `LINK_TYPE` value validation required before UAT sign-off.
**Affected:** `trace-graph-panel.tsx`, `trace2-graph-mapper.ts`, `TraceGraphEdge` schema
**Evidence:** `TraceGraphEdge` had no `linkType` field. The reference SQL engine distinguishes PRODUCTION / BATCH_TRANSFER / STO_TRANSFER / VENDOR_RECEIPT — without this, V2 could not separate internal batch moves from vendor receipts, making supplier exposure analysis unreliable.
**Risk:** An investigator may not identify the vendor receipt path responsible for introducing a non-conforming input batch.
**Fix applied:** `linkType: z.string().optional()` passthrough added to `TraceEdgeSchema`; `relationshipType` enum expanded; graph mapper updated to emit `vendor-receipt` and `consumed-by`. Mock fixture exercises both new types.
**Requires UAT:** Yes — live Databricks `LINK_TYPE` column values must be verified against mock fixture assumptions before UAT sign-off.

### TRACE-P0-003 — Severity tiering is binary, not depth-based
**Status:** Partially addressed (2026-05-20) — lineage-only first slice populates `maxExposureDepth` from gold_batch_lineage; DELIVERY-edge population and LINK_TYPE='DELIVERY' live value require UAT validation before depth-aware severity is trustworthy
**Affected:** `InvestigationSummary.tsx` severity logic, `CustomerExposureSummarySchema`
**Evidence:** V2 assigns CRITICAL based on `shippedQuantity > 0` only. The reference engine (`fetch_recall_readiness()`) uses depth: depth=1 → CRITICAL, depth=2+ with shipments → HIGH, depth=2 no shipments → MEDIUM. A multi-hop indirect exposure at depth 2 with no direct shipments gets LOW in V2 but HIGH in the reference engine.
**Risk:** Under-escalation of multi-hop indirect exposure scenarios.
**Fix applied:** `maxExposureDepth?: number` added to `CustomerExposureSummarySchema`. `InvestigationSummary.tsx` severity logic updated: depth=1+shipped→CRITICAL, depth≥2+shipped→HIGH, depth≥2 no-ship→MEDIUM, depth undefined→CRITICAL (conservative fallback). Lineage-only first slice implemented 2026-05-20: `get_customer_exposure_spec` populates `maxExposureDepth` as minimum hop_depth across DELIVERY-type edges. `highestSeverity` is preliminary 'medium' pending business rule definition.
**Requires UAT:** Yes — confirm LINK_TYPE='DELIVERY' edges exist with CUSTOMER_ID populated for a known shipped batch; confirm maxExposureDepth values are plausible.

---

## P1 — Blocks Credible UAT Use

### TRACE-P1-004 — Individual stock bucket quantities not surfaced in batch header
**Status:** Fixed (2026-05-20, `feature/traceability-functional-parity-plan`)
**Affected:** `BatchHeaderSummarySchema`, `map_batch_header_rows`, `BatchHeaderPanel`
**Evidence:** V1 showed UNRESTRICTED, BLOCKED, QUALITY_INSPECTION, RESTRICTED, TRANSIT as separate KPIs on the batch header. V2 fetched all 6 columns from `gold_batch_stock_v` (confirmed live 2026-05-19) but surfaced only `total_stock` as the single `quantity` field. An investigator could not determine whether stock was blocked, in QI hold, or unrestricted without drill-through.
**Risk:** Investigator cannot assess the significance of a non-zero stock figure (blocked vs. unrestricted are materially different recall signals).
**Fix applied:** Added `unrestricted`, `blocked`, `qualityInspection`, `restricted`, `transit` as optional number fields to `BatchHeaderSummarySchema`. Python mapper now surfaces all 5 fields (null row value → field absent, not zero). `BatchHeaderPanel` shows a stock bucket row beneath the quantity row; QI Hold and Blocked fields are highlighted amber/sunset when non-zero.
**Requires UAT:** Yes — confirm bucket values are populated from live `gold_batch_stock_v` and match values shown in V1 batch header.

### TRACE-P1-008 — Batch header multi-plant ambiguity when plant_id absent
**Status:** Fixed (2026-05-20, `feature/traceability-functional-parity-plan`)
**Affected:** `Trace2BatchHeaderRequest`, `get_batch_header_summary_spec`, `BatchRequest`, `trace2-legacy-api-adapter.ts`
**Evidence:** `gold_batch_stock_v` returns one row per plant for a given material/batch combination. Without plant filtering, the mapper silently returned data for whichever plant sorts first alphabetically by PLANT_ID. UAT inputs include `plantId`, making the ambiguity avoidable.
**Fix applied:** `plant_id` added to `Trace2BatchHeaderRequest` (default `""`), to the SQL WHERE clause as `AND (:plant_id = '' OR s.PLANT_ID = :plant_id)`, to `BatchRequest` in the FastAPI route, and to the frontend POST body in `trace2-legacy-api-adapter.ts`. When plant is absent behaviour is unchanged (all plants returned, mapper takes first).
**Requires UAT:** Yes — confirm single-plant result when `plant_id = C061` is passed for the reference candidate.

### TRACE-P1-009 — gold_batch_delivery_v WHERE key column names unverified (DEF-TRACE-006)
**Status:** Code-implemented — DESCRIBE TABLE and live query not yet executed
**Affected:** `get_customer_delivery_spec()`, `POST /api/trace2/customer-deliveries`
**Evidence:** The V1-parity delivery slice queries `gold_batch_delivery_v` with `WHERE MATERIAL_ID = :material_id AND BATCH_ID = :batch_id`. Column name is consistent with all gold views (High confidence) but was not confirmed via DESCRIBE TABLE before code-write. Until confirmed, a column-not-found error will cause HTTP 500 for all customer-deliveries requests.
**Risk:** If column names differ, the customer delivery panel shows an error state for all batches; investigators will not have V1-parity delivery evidence.
**Proposed fix:** Run `DESCRIBE TABLE connected_plant_uat.gold.gold_batch_delivery_v`. If column names differ, update SQL in `get_customer_delivery_spec()`. Remove TODO comments after verification. See `customer-delivery-movement-type-validation.md` §1 for the full validation SQL.
**Requires UAT:** Yes — CD-1 through CD-6 scenarios in DEF-TRACE-006 (uat-validation-ledger.md)

### TRACE-P1-005 — Mass balance not wired to a live Databricks route
**Status:** Open — adapter+mapper done, live route and WHERE filter verification pending
**Affected:** `mass-balance-view.tsx`, `get_mass_balance_spec`, `apps/api/routes/trace2.py`
**Evidence:** V1 provided a full per-day movement timeline (daily delta + running cumulative balance chart) via `POST /api/mass-balance`. V2 has a complete mass balance QuerySpec and row mapper, but: (a) the WHERE filter column names in `gold_batch_mass_balance_v` are unverified (TODO markers present in SQL), and (b) no FastAPI route exists. The frontend shows input/output/variance totals only.
**Risk:** Investigators cannot see individual goods movement events for a batch; mass balance chart is absent.
**Proposed fix:** Verify WHERE filter column names in `gold_batch_mass_balance_v` against live catalog; wire `POST /trace2/mass-balance` FastAPI route; add daily timeline rendering to `MassBalancePanel`.
**Requires UAT:** Yes

### TRACE-P1-006 — Supplier exposure panel has no live Databricks slice
**Status:** Open — schema + mock panel exists; `gold_supplier` not in catalog resolver
**Affected:** `MaterialSupplierExposurePanel`, catalog resolver
**Evidence:** V1 `/api/supplier-risk` provided a per-supplier table (supplier ID, name, country, received quantity, batch count, quality failure rate) via upstream walk through `gold_batch_lineage` + `gold_supplier` join. V2 `MaterialSupplierExposurePanel` exists with mock data; `gold_supplier` is not in the domain object resolver so no Databricks query can be formed.
**Risk:** Investigators cannot identify which suppliers contributed input batches to a recalled product without this panel being live.
**Proposed fix:** Add `gold_supplier` to catalog resolver; implement QuerySpec for upstream VENDOR_RECEIPT aggregation; add quality summary join.
**Requires UAT:** Yes

### TRACE-P1-007 — Production history panel missing
**Status:** Open — no panel implemented
**Affected:** Investigation cockpit (no panel exists)
**Evidence:** V1 provided a production history page showing the most recent 24 batches for the same material (process order, plant, manufacture date, quantity, UOM, quality status, yield%). Used to identify whether a quality issue is isolated to one batch or systemic across recent production. V2 has no equivalent panel.
**Risk:** Investigators cannot assess whether a quality issue is isolated or spans multiple recent batches.
**Proposed fix:** Build `ProductionHistoryPanel` using `gold_batch_production_history_v` when columns are verified.
**Requires UAT:** Yes

### TRACE-P1-001 — Truncation state not surfaced in trace graph UI
**Status:** Code-fixed — live validation pending
**Affected:** `trace-graph-panel.tsx`, `TraceGraph.truncated` schema field
**Evidence:** `TraceGraph.truncated` exists in the Zod schema but the mock always sets it to `false` and the panel had no truncation warning banner. An investigator viewing a depth-limited graph has no signal that upstream exposure may extend beyond what is shown.
**Risk:** Investigator concludes lineage is complete when the graph was cut at max depth.
**Fix applied:** Amber truncation banner rendered in `trace-graph-panel.tsx` when `truncated === true`, `max_depth_reached` is in warnings, or `max_edges_reached` is in warnings. Copy updated: "Trace graph truncated — the displayed lineage may be incomplete because the max depth or row limit was reached. Review with a deeper trace or Databricks validation before concluding exposure is complete." Tests cover all three trigger conditions.
**Requires UAT:** Yes — confirm banner renders on a live Databricks graph that reaches depth/edge limit.

### TRACE-P1-002 — No README or entry-point documentation for the domain
**Status:** Fixed (PR #25 — `README.md` added to `domain-integrations/traceability/`)
**Affected:** `domain-integrations/traceability/`
**Evidence:** No `README.md` existed. A developer onboarding to this domain had no documented entry point, no explanation of the adapter pattern, and no pointers to the UAT docs.
**Risk:** Slows contributor onboarding; increases chance of bypassing the adapter contract.
**Fix applied:** README added covering purpose, architecture (adapter → queries → panels), mock vs. live mode, test commands, and docs index.
**Requires UAT:** No

### TRACE-P1-003 — Invalid batch input has no documented graceful error state
**Status:** Code-fixed — live validation pending
**Affected:** `overview-view.tsx` cockpit header; individual panel error states are handled by EvidencePanel runtime
**Evidence:** The adapter returns `{ ok: false, error, displayState }` for failed queries. Without a cockpit-level guard, a not-found or unauthorized batch header response produced a silent null `batchHeader` and the InvestigationSummary showed "Loading material..." indefinitely.
**Risk:** An investigator querying a non-existent or inaccessible batch may see no error guidance.
**Fix applied:** `BatchHeaderErrorBanner` added to `overview-view.tsx`. Distinguishes `batchHeaderResult === undefined` (loading) from `batchHeaderResult.ok === false` (adapter error). Shows user-facing headings: "Batch not found" (not-found), "Not authorized or data not accessible" (unauthorized), "Data source timeout" (timeout), "Batch header unavailable" (other). All six evidence panels continue to render; only the cockpit header shows the banner. Unit tests in `overview-view.test.tsx` cover each error code, the loading (undefined) non-banner case, and the six-panel render-on-error case.
**Owner:** Claude
**Requires UAT:** Yes — confirm banner renders correctly in live deployed app for a non-existent batch and for an unauthorized access scenario.

---

## P2 — Improves Trust or Usability

### TRACE-P2-001 — Plant ID not displayed on trace graph nodes
**Status:** Schema fixed — UI display pending
**Affected:** `trace-graph-panel.tsx`
**Evidence:** `TraceNodeSchema` already has `plantId?: z.string().optional()` (confirmed in codebase review 2026-05-20). The Databricks graph mapper populates `plantId` on each node from `gold_batch_lineage` PARENT/CHILD_PLANT_ID. However, `trace-graph-panel.tsx` does not display `plantId` in node labels, tooltips, or detail panels. Cross-plant investigations cannot distinguish which plant produced each upstream/downstream batch from the graph view alone.
**Risk:** Investigator cannot determine which plant site is the source of a lineage path from the graph.
**Proposed fix:** Render `plantId` as a secondary label or tooltip on graph nodes.
**Owner:** Claude
**Requires UAT:** Yes

### TRACE-P2-002 — Data freshness metadata absent
**Status:** Open
**Affected:** All adapter results
**Evidence:** The reference engine attaches `data_freshness_seconds` from Databricks gold view materialisation timestamps. V2 has no equivalent. An investigator cannot tell if the data shown reflects movements from today or last week.
**Risk:** Stale data presented as current; may affect containment decisions.
**Proposed fix:** Add `dataFreshnessSeconds?: number` to `AdapterResult` or per-summary type. Surface as a tooltip or footer note.
**Owner:** Claude
**Requires UAT:** Yes (requires live Databricks metadata)

### TRACE-P2-003 — "across 0 countries" shown for confirmed zero-shipment batches
**Status:** Fixed (PR #24, commit 74f4b5c) for the `InvestigationSummary` cockpit header
**Affected:** `InvestigationSummary.tsx` — fixed; `customer-impact-panel.tsx` — not affected (uses `{data.countries.length > 0 && ...}` guard)
**Notes:** No further action required.

### TRACE-P2-004 — Evidence confidence grade thresholds not documented for users
**Status:** Open
**Affected:** `EvidenceConfidenceBadge`, `EvidencePackReadiness`
**Evidence:** Grade thresholds (COMPLETE = 100pts and 0 gaps, PARTIAL ≥ 50, etc.) are not explained to the user. An investigator seeing "Partial (78%)" does not know what 78 means or why it is not COMPLETE.
**Proposed fix:** Add a tooltip or info-row to `EvidenceConfidenceBadge` explaining the scoring sectors and thresholds.
**Owner:** Gemini / Claude
**Requires UAT:** No

---

## P3 — Future Enhancement

### TRACE-P3-001 — Cycle detection metadata not exposed
**Affects:** `TraceGraph.unresolvedNodeCount` — schema exists, never set from a real cycle-detection walk
**Notes:** Deferred until recursive CTE results are wired from live Databricks.

### TRACE-P3-002 — No mass-balance drill-down to individual movement lines
**Affects:** `mass-balance-view.tsx`
**Notes:** Summary variance is shown; line-level movement table (MB51-style) not in scope for Phase 1.

### TRACE-P3-003 — No cross-link from investigation cockpit to related SAP transactions
**Affects:** Quick-links row in `InvestigationSummary.tsx`
**Notes:** Currently links to internal views only. Links to SAP GUI / Fiori transactions are a Phase 2 / deep-link requirement.
