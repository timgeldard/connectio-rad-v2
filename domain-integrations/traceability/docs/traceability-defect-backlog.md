# Traceability Defect Backlog

**Domain:** `domain-integrations/traceability`
**Last updated:** 2026-05-19
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
**Status:** Open
**Affected:** `InvestigationSummary.tsx` severity logic
**Evidence:** V2 assigns CRITICAL based on `shippedQuantity > 0` only. The reference engine (`fetch_recall_readiness()`) uses depth: depth=1 → CRITICAL, depth=2+ with shipments → HIGH, depth=2 no shipments → MEDIUM. A multi-hop indirect exposure at depth 2 with no direct shipments gets LOW in V2 but HIGH in the reference engine.
**Risk:** Under-escalation of multi-hop indirect exposure scenarios.
**Proposed fix:** Add `maxExposureDepth` to `CustomerExposureSummary` schema; update severity logic to factor in depth.
**Owner:** Claude
**Requires UAT:** Yes (requires live lineage data with known depth)

---

## P1 — Blocks Credible UAT Use

### TRACE-P1-001 — Truncation state not surfaced in trace graph UI
**Status:** Open
**Affected:** `trace-graph-panel.tsx`, `TraceGraph.truncated` schema field
**Evidence:** `TraceGraph.truncated` exists in the Zod schema but the mock always sets it to `false` and the panel has no truncation warning banner. An investigator viewing a depth-limited graph has no signal that upstream exposure may extend beyond what is shown.
**Risk:** Investigator concludes lineage is complete when the graph was cut at max depth.
**Proposed fix:** Render a dismissible amber banner in `trace-graph-panel.tsx` when `traceGraph.truncated === true`. Update mock to exercise this path.
**Owner:** Claude
**Requires UAT:** No — can be validated via mock fixture update

### TRACE-P1-002 — No README or entry-point documentation for the domain
**Status:** Fixed (PR #25 — `README.md` added to `domain-integrations/traceability/`)
**Affected:** `domain-integrations/traceability/`
**Evidence:** No `README.md` existed. A developer onboarding to this domain had no documented entry point, no explanation of the adapter pattern, and no pointers to the UAT docs.
**Risk:** Slows contributor onboarding; increases chance of bypassing the adapter contract.
**Fix applied:** README added covering purpose, architecture (adapter → queries → panels), mock vs. live mode, test commands, and docs index.
**Requires UAT:** No

### TRACE-P1-003 — Invalid batch input has no documented graceful error state
**Status:** Open (not verified)
**Affected:** All views — handling of `{ ok: false }` adapter results
**Evidence:** The adapter returns `{ ok: false, error, displayState }` for failed queries. Whether every panel surfaces a user-readable error state (vs. blank panel) has not been systematically verified.
**Risk:** An investigator querying a non-existent batch may see partial/blank panels with no guidance.
**Proposed fix:** Audit all panels for `displayState` handling; add a cross-panel "batch not found" guard in `overview-view.tsx` if header lookup fails.
**Owner:** Claude
**Requires UAT:** Partially — can partially verify via mock; requires live API for full error path testing

---

## P2 — Improves Trust or Usability

### TRACE-P2-001 — Plant ID absent from trace graph nodes
**Status:** Open
**Affected:** `TraceGraphNode` schema, `trace-graph-panel.tsx`
**Evidence:** `TraceGraphNode` has no `plantId` field. The reference engine anchors lineage walks to the production plant. Without per-node plant context, cross-plant investigations cannot distinguish which plant produced each upstream/downstream batch.
**Risk:** Investigator cannot determine which plant site is the source of a lineage path.
**Proposed fix:** Add `plantId?: string` to `TraceGraphNode` Zod schema; render plant as node tooltip or secondary label.
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
