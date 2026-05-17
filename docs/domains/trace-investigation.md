# Trace Investigation — Domain Reference

**Domain:** traceability  
**Workspace:** trace-investigation  
**Lifecycle:** active — V1 proxy wired for batch-header; `POST /api/trace2/trace-graph` native Databricks route wired (q.txt, 2026-05-18, iterative multi-hop over gold_batch_lineage)

---

## Overview

The Trace Investigation workspace provides end-to-end batch traceability for quality investigations. It replaces the original Trace2 application (9-page React app, 14 POST endpoints) within the V2 workspace shell.

Given a `batchId` and `investigationId`, the workspace surfaces:
- Full upstream/downstream batch lineage as an interactive graph
- Mass balance with per-day movement history
- Customer and supplier exposure summaries
- Quality/CoA release status
- Risk signals, event timeline, and related investigations

---

## Views

| View ID | Description |
|---------|-------------|
| `overview` | Batch header + trace graph + risk signals |
| `trace-tree` | Full-screen trace graph with direction controls |
| `mass-balance` | Mass balance totals + movements table + trace graph |
| `recall-readiness` | Customer impact + supplier exposure |
| `quality` | CoA release status |
| `event-timeline` | Chronological event log |
| `related-investigations` | Cross-investigation context |

---

## Data source

| Layer | Detail |
|-------|--------|
| Origin | SAP ECC / WH360 / EnvMon → Databricks gold views → V1 Trace2 backend |
| V1 endpoints (11) | POST-based: `/api/summary`, `/api/top-down`, `/api/bottom-up`, `/api/mass-balance`, `/api/recall-readiness`, `/api/supplier-risk`, `/api/quality`, `/api/coa`, `/api/production-history`, `/api/batch-compare`, `/api/impact` |
| V2 adapter | `trace2-adapter.ts` (mock) · `trace2-legacy-api-adapter.ts` (legacy-api) |
| Batch-header proxy | `GET /api/trace/batch-header` (verified) |
| Other methods | Mock only (Phase 1) |

---

## Adapter modes

`VITE_ADAPTER_MODE` selects the adapter at build time:

| Mode | Behaviour |
|------|-----------|
| `mock` (default) | Returns `trace2-mock-data.ts` fixtures with `source: 'mock'` |
| `legacy-api` | Calls V1 Trace2 proxy; batch-header verified, others return mock fallback |

---

## Panels

### TraceGraphPanel (`panels/trace-graph-panel.tsx`)

Interactive batch lineage graph powered by `@xyflow/react`.

**Direction controls** — toggle between Upstream ↑ / Both / Downstream ↓. Client-side filter via `filterGraphByDirection()` in `trace-graph-utils.ts`. No adapter re-fetch required.

**Node selection** — click a node to see: type, risk level, material ID, batch ID, plant, quantity, status, and connected relationship list.

**Edge selection** — click an edge to see: relationship type, quantity/UOM, source material, target material, movement type, document reference.

**Layout** — BFS from root batch; upstream nodes at negative Y levels, downstream at positive. Disconnected nodes placed at `min_level - 2` row.

**Empty state** — "No batch lineage found." rendered when the filtered graph contains no nodes.

### MassBalancePanel (`views/mass-balance-view.tsx`)

Inline panel (view-local, not in shared panels directory).

Shows: input qty, output qty, variance %, confidence score, unresolved movement count, and a per-day movements table (date, category, delta, running balance, reference).

Movement categories: `production` (blue) · `shipment` (amber) · `consumption` (purple) · `adjustment` (grey).

---

## Data contracts

Defined in `packages/data-contracts/src/schemas/trace-investigation.ts`.

Key types:

| Type | Purpose |
|------|---------|
| `TraceGraph` | Root type: nodes, edges, direction, depth, rootBatch, counts |
| `TraceNode` | Graph node: type, material, batch, plant, qty, status, riskLevel |
| `TraceEdge` | Graph edge: source, target, relationshipType, qty, movementType, documentRef |
| `MassBalanceSummary` | Totals + optional `movements: MassBalanceMovement[]` |
| `MassBalanceMovement` | Per-day: date, category, delta, runningBalance, uom, reference |
| `CustomerExposureSummary` | Affected customers, deliveries, countries, shipped qty |
| `SupplierExposureSummary` | Supplier count, lots, highest-risk supplier |
| `CoAReleaseStatus` | Release status, usage decision, open lots, pending results |
| `TraceRiskSignal` | Signal: severity, confidence, source, recommended action |
| `RelatedInvestigation` | Cross-investigation link: relatedBy, status, severity |

---

## Original Trace2 parity status

See `docs/migration/trace2-functional-parity-matrix.md` for the full 40-capability matrix.

**Implemented in this pass (Phase d):**

| Item | Fix |
|------|-----|
| A1 — Direction controls | Direction toggle (Upstream ↑ / Both / Downstream ↓) added to TraceGraphPanel |
| A2 — Mass balance movements | `MassBalanceMovement` schema added; movements table rendered in MassBalanceView |
| A3 — Edge detail | `onEdgeClick` + `SelectedEdgeDetail` panel added to TraceGraphPanel |
| A4 — Graph robustness | Disconnected node handling + empty graph state added to `bfsLayout` and panel |
| A5 — Richer node detail | Connected relationships list shown in `SelectedNodeDetail` |

**Still missing (Phase 2+):**

- Direction-aware adapter calls (currently client-side filter only)
- Depth control slider
- Customer delivery detail table
- Supplier detail table
- Quality inspection lot and MIC result tables
- Production history panel
- Batch comparison panel
- Cross-batch exposure panel
- Recall readiness exposure table
- Export / recall dossier

---

## Utilities (`panels/trace-graph-utils.ts`)

| Export | Purpose |
|--------|---------|
| `bfsLayout(graph)` | Returns `Map<id, {x,y}>` positions; disconnected nodes at min_level − 2 |
| `filterGraphByDirection(graph, direction)` | Client-side direction filter returning a new `TraceGraph` |
| `mapToFlowNodes(graph, selectedId)` | Maps `TraceNode[]` to React Flow `Node<TraceNodeData>[]` |
| `mapToFlowEdges(graph)` | Maps `TraceEdge[]` to React Flow `Edge[]` |
| `RISK_BORDER / RISK_BG / RISK_TEXT` | Risk-level colour palettes |
| `NODE_TYPE_LABEL` | Human-readable labels for node type enum values |

---

## Test coverage

| File | Tests |
|------|-------|
| `trace-graph-utils.test.ts` | 23 tests: bfsLayout (incl. disconnected), filterGraphByDirection, mapToFlowNodes, mapToFlowEdges |
| `trace-graph-panel.test.tsx` | 25 tests: rendering, node selection, edge selection, direction toggle |
| `trace2-adapter.test.ts` | 11 tests: mock adapter methods |
| `trace2-legacy-api-adapter.test.ts` | 13 tests: legacy API adapter |
