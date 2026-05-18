# Trace Graph Frontend — Contract Resolution

**Date:** 2026-05-18 (u.txt)  
**Domain:** `di-traceability`  
**Status:** Complete — 113 tests passing, TypeScript typecheck clean, UI BV pending

---

## Problem

The native Databricks `POST /api/trace2/trace-graph` route was browser-verified on 2026-05-18 but the frontend could not consume it. Two mismatches blocked wiring:

1. **`TraceGraphSchema` required fields were incompatible with the backend response:**
   - `TraceNode.type` was required (`z.enum([...])`) but the backend `gold_batch_lineage` view has no material-type column.
   - `TraceEdge.relationshipType` was required but is derived from `linkType` — unknown/null `linkType` values would fail the schema.
   - `TraceGraphSchema` had no `warnings` or `truncated` fields, which the backend always returns.

2. **Two TypeScript crash sites in `trace-graph-panel.tsx`:**
   - `NODE_TYPE_LABEL[node.type]` — after making `type` optional, `node.type` could be `undefined`, which is not a valid `Record<string, string>` key.
   - Same pattern in `SelectedNodeDetail` at line 137.

---

## Resolution

### 1. Schema changes — `packages/data-contracts/src/schemas/trace-investigation.ts`

| Field | Before | After |
|---|---|---|
| `TraceNode.type` | `z.enum([...])` — required | `.optional()` — removed from required |
| `TraceEdge.relationshipType` | `z.enum([...])` — required | `.optional()` — removed from required |
| `TraceGraphSchema.warnings` | absent | `z.array(z.string()).optional()` added |
| `TraceGraphSchema.truncated` | absent | `z.boolean().optional()` added |

These are additive/relaxing changes. No existing panel or test was broken (all 113 tests pass with no mock data changes required).

### 2. TypeScript fix — `trace-graph-panel.tsx`

**Line 74 (TraceNodeCard):**
```tsx
// Before
{NODE_TYPE_LABEL[node.type] ?? node.type}

// After
{node.type ? (NODE_TYPE_LABEL[node.type] ?? node.type) : undefined}
```

**Line 137 (SelectedNodeDetail):**
```tsx
// Before
<Detail label="Type" value={NODE_TYPE_LABEL[node.type] ?? node.type} />

// After
<Detail label="Type" value={node.type ? (NODE_TYPE_LABEL[node.type] ?? node.type) : '—'} />
```

### 3. TypeScript mapper — `trace2-graph-mapper.ts` (new file)

Maps `BackendTraceGraphResponse` (from `POST /api/trace2/trace-graph`) to the `TraceGraph` frontend contract.

**Node mapping:**
- `id ← nodeKey` (`materialId:batchId:plantId`)
- `type ← undefined` (not available from `gold_batch_lineage`)
- `materialDescription ← ''` (empty string — no material master join in lineage table)
- `materialId`, `batchId`, `plantId` ← direct

**Edge mapping:**
- `relationshipType ← LINK_TYPE_MAP[linkType]` or `undefined` for unknown/null `linkType`
- `documentReference ← materialDocumentNumber ?? processOrderId ?? undefined`
- `uom ← baseUnitOfMeasure`
- `movementType ← movementType`

**`LINK_TYPE_MAP` (mirrors Python `_LINK_TYPE_MAP` in `trace2_databricks_adapter.py`):**

| linkType | relationshipType |
|---|---|
| `PRODUCTION` | `produced-from` |
| `BATCH_TRANSFER` | `transferred-to` |
| `STO_TRANSFER` | `transferred-to` |
| `VENDOR_RECEIPT` | `component-of` |
| `CONSUMPTION` | `component-of` |
| `DELIVERY` | `delivered-to` |
| `SPLIT` | `split-from` |
| `MERGE` | `merged-into` |
| unknown / null | `undefined` |

**Graph-level mapping:**
- `rootBatch ← anchor.batchId`
- `direction ← 'both'` (hardcoded — backend always returns both directions)
- `depth ← depthReached`
- `upstreamCount ← non-anchor nodes with 'upstream' in directions`
- `downstreamCount ← non-anchor nodes with 'downstream' in directions`
- `unresolvedNodeCount ← 0` (node resolution not available from lineage table)
- `warnings ← raw.warnings`
- `truncated ← raw.truncated`

### 4. Adapter override — `Trace2LegacyApiAdapter.getTraceGraph`

Overrides the base `Trace2Adapter.getTraceGraph` mock. No mock fallback. No legacy-api fallback.

**Guard (missing params → early error, no fetch call):**
```typescript
if (!request.batchId || !request.materialId || !request.plantId) {
  return { ok: false, error: { code: 'not-found', ... }, source: 'databricks-api' }
}
```

**Request shape:**
```json
{ "material_id": "...", "batch_id": "...", "plant_id": "...", "direction": "both", "max_depth": 6, "max_edges": 1000 }
```

**Error mapping:**
- 401 → `code: 'unauthorized'`, `retryable: false`
- 404 → `code: 'not-found'`, `retryable: false`
- 5xx → `code: 'network'`, `retryable: true`
- TypeError (network) → `code: 'unknown'`, `retryable: true`
- All errors: `source: 'databricks-api'`

**Activation:** Already active when `VITE_ADAPTER_MODE=legacy-api` (default build configuration).

---

## What Was NOT Changed

- Graph library (ReactFlow / `@xyflow/react`) — not replaced
- Panel layout or component structure — not redesigned
- Mock data in `Trace2Adapter` — not removed
- `getBatchHeaderSummary` — not touched
- Any other domain adapter or factory — not touched
- `VITE_ADAPTER_MODE` build default (`'legacy-api'`) — not changed

---

## Test Coverage

| File | Tests | What is covered |
|---|---|---|
| `trace2-graph-mapper.test.ts` | 31 | All LINK_TYPE_MAP variants, leading zeros, null handling, counts, direction, empty graph, optional fields |
| `trace2-legacy-api-adapter.test.ts` | 42 (11 new) | Full `getTraceGraph` path: body shape, success mapping, 401/503/TypeError error handling, missing plantId guard, warnings/truncated propagation |
| `trace-graph-panel.test.tsx` | 40 (3 new) | Empty-state message, truncation banner, max-depth warning banner |

---

## Remaining Steps

1. **Deploy** u.txt changes to UAT
2. **Browser-verify UI** per `docs/deployment/trace-native-browser-verification.md` (Check T2-UI) and `docs/deployment/uat-smoke-test-checklist.md` (C13)
3. Mark C13 and T2-UI as PASSED once confirmed
