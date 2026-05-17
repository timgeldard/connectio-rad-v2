# Trace Lineage → Graph Contract Map

**Status:** Frontend wiring deferred (q.txt, 2026-05-18)  
**Backend:** `POST /api/trace2/trace-graph` — executable, awaiting BV  
**Frontend:** `getTraceGraph` in `trace2-adapter.ts` — mock-only, contract mismatch

---

## Why Frontend Wiring Is Deferred

The V2 backend route returns the q.txt response shape. The existing `TraceGraphSchema` in `packages/data-contracts/src/schemas/trace-investigation.ts` uses a different contract. The mismatch is too large to bridge without redesigning the frontend adapter and Zod schema.

---

## Contract Mismatch Detail

### Response envelope

| Field | Backend (q.txt) | Frontend schema (TraceGraphSchema) |
|---|---|---|
| `anchor` | `{ materialId, batchId, plantId, nodeKey }` | Not present — `rootBatch: string` instead |
| `depthReached` | `number` | `depth: number` (same concept, different name) |
| `truncated` | `boolean` | Not present |
| `warnings` | `string[]` | Not present |
| `upstreamCount` | Not present | `upstreamCount: number` |
| `downstreamCount` | Not present | `downstreamCount: number` |
| `unresolvedNodeCount` | Not present | `unresolvedNodeCount: number` |

### Direction values

| Backend | Frontend schema |
|---|---|
| `"upstream"` | `"reverse"` |
| `"downstream"` | `"forward"` |
| `"both"` | `"both"` |

### Node fields

| Field | Backend node | Frontend TraceNodeSchema |
|---|---|---|
| Key field | `nodeKey: string` | `id: string` |
| `materialId` | ✓ | ✓ |
| `batchId` | ✓ optional | ✓ optional |
| `plantId` | ✓ | ✓ optional |
| `depth` | ✓ | Not present |
| `directions` | `string[]` | Not present |
| `isAnchor` | `boolean` | Not present |
| `label` | `string` | Not present |
| `type` | Not present | Enum (raw-material, intermediate...) |
| `materialDescription` | Not present | `materialDescription: string` |
| `quantity` | Not present | `quantity?: number` |
| `uom` | Not present | `uom?: string` |
| `status` | Not present | Optional enum |
| `riskLevel` | Not present | Optional enum |

### Edge fields

| Field | Backend edge | Frontend TraceEdgeSchema |
|---|---|---|
| `id` | ✓ | ✓ |
| `source` | ✓ | ✓ |
| `target` | ✓ | ✓ |
| `linkType` | `string` (raw LINK_TYPE) | `relationshipType` (mapped enum) |
| `processOrderId` | ✓ | Not present (in `documentReference`) |
| `materialDocumentNumber` | ✓ | Not present (in `documentReference`) |
| `purchaseOrderId` | ✓ | Not present |
| `supplierId` | ✓ | Not present |
| `customerId` | ✓ | Not present |
| `deliveryId` | ✓ | Not present |
| `salesOrderId` | ✓ | Not present |
| `quantity` | ✓ | ✓ optional |
| `baseUnitOfMeasure` | ✓ | `uom` optional |
| `postingDate` | ✓ | Not present |
| `movementType` | ✓ | ✓ optional |
| `depth` | ✓ | Not present |
| `direction` | ✓ | Not present |

---

## What Is Needed to Wire Frontend

1. **Update `TraceGraphSchema`** in `packages/data-contracts` to match q.txt response shape.
   - New fields: `anchor`, `depthReached`, `truncated`, `warnings`
   - Node: rename `id` → `nodeKey`, add `depth`, `directions`, `isAnchor`, `label`; remove `type`, `materialDescription`, `status`, `riskLevel`
   - Edge: rename `relationshipType` → `linkType`; add all 18 DDL context fields; rename `uom` → `baseUnitOfMeasure`
   - Direction enum: `"forward"` → `"downstream"`, `"reverse"` → `"upstream"`

2. **Update `getTraceGraph` in `trace2-adapter.ts`** from mock to `POST /api/trace2/trace-graph`.

3. **Update `TraceGraphPanel`** to consume the new node/edge shape.

4. **Verify with `TraceGraphPanel`** that `nodeKey` can substitute for `id` in graph layout library.

The frontend redesign is a separate tranche. The backend route is executable and returns real multi-hop data; the frontend continues to show mock data until wired.

---

## Recommended Wiring Order

1. Browser-verify `POST /api/trace2/trace-graph` (BV checklist in `docs/deployment/trace-native-browser-verification.md`)
2. Update data-contracts Zod schemas (requires design review)
3. Update `trace2-adapter.ts`
4. Update `TraceGraphPanel` component
5. Test end-to-end in browser
