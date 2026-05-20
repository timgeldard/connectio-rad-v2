import { TraceGraphSchema } from '@connectio/data-contracts'
import type { TraceGraph } from '@connectio/data-contracts'

// ---------------------------------------------------------------------------
// Backend response shapes (POST /api/trace2/trace-graph)
// Matches the Python map_trace_graph() output in trace2_databricks_adapter.py
// ---------------------------------------------------------------------------

interface BackendNode {
  id: string
  materialId: string
  materialDescription?: string
  batchId: string
  plantId: string
  depth: number
  directions: string[]
  isAnchor: boolean
}

interface BackendEdge {
  id: string
  source: string
  target: string
  linkType: string | null
  processOrderId: string | null
  materialDocumentNumber: string | null
  purchaseOrderId: string | null
  supplierId: string | null
  customerId: string | null
  deliveryId: string | null
  salesOrderId: string | null
  quantity: number | null
  uom: string | null
  postingDate: string | null
  movementType: string | null
}

export interface BackendTraceGraphResponse {
  nodes: BackendNode[]
  edges: BackendEdge[]
  depth: number
  rootBatch: string
  truncated: boolean
  warnings: string[]
}

// ---------------------------------------------------------------------------
// linkType → relationshipType
// The Python adapter passes raw LINK_TYPE strings from gold_batch_lineage.
// Semantic mapping is owned here (frontend contract layer).
// ---------------------------------------------------------------------------

type RelationshipType =
  | 'component-of'      // legacy/generic — keep for backward compatibility
  | 'produced-from'
  | 'split-from'
  | 'merged-into'
  | 'transferred-to'
  | 'delivered-to'
  | 'vendor-receipt'    // inbound goods receipt from external supplier
  | 'consumed-by'       // component consumed into a production order

const LINK_TYPE_MAP: Record<string, RelationshipType> = {
  PRODUCTION: 'produced-from',
  BATCH_TRANSFER: 'transferred-to',
  STO_TRANSFER: 'transferred-to',
  VENDOR_RECEIPT: 'vendor-receipt',  // P0-3: distinct from internal consumption
  CONSUMPTION: 'consumed-by',        // P0-3: distinct from vendor receipt
  DELIVERY: 'delivered-to',
  SPLIT: 'split-from',
  MERGE: 'merged-into',
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

/**
 * Maps a POST /api/trace2/trace-graph response to the TraceGraph frontend contract.
 *
 * Mapping rules:
 * - node.id ← id (materialId:batchId)
 * - node.materialDescription ← '' when absent (gold_material JOIN populates this)
 * - edge.relationshipType ← mapped from linkType via LINK_TYPE_MAP; omitted if unknown
 * - edge.documentReference ← materialDocumentNumber ?? processOrderId
 * - edge.uom ← uom
 * - graph.rootBatch ← anchor node's batchId (node with isAnchor=true)
 * - graph.upstreamCount ← non-anchor nodes with 'upstream' in directions
 * - graph.downstreamCount ← non-anchor nodes with 'downstream' in directions
 * - graph.unresolvedNodeCount ← 0 (not available from lineage table)
 */
export function mapBackendTraceGraph(raw: BackendTraceGraphResponse): TraceGraph {
  const nodes = raw.nodes.map(n => ({
    id: n.id,
    materialId: n.materialId,
    materialDescription: n.materialDescription ?? '',
    batchId: n.batchId || undefined,
    plantId: n.plantId || undefined,
    depth: n.depth,
    directions: n.directions,
    isAnchor: n.isAnchor,
  }))

  const edges = raw.edges.map(e => {
    const linkTypeKey = (e.linkType ?? '').toUpperCase().trim()
    const relationshipType: RelationshipType | undefined = LINK_TYPE_MAP[linkTypeKey]
    const documentReference = e.materialDocumentNumber ?? e.processOrderId ?? undefined

    return {
      id: e.id,
      source: e.source,
      target: e.target,
      ...(e.linkType ? { linkType: e.linkType } : {}),
      ...(relationshipType !== undefined ? { relationshipType } : {}),
      ...(e.quantity !== null ? { quantity: e.quantity } : {}),
      ...(e.uom ? { uom: e.uom } : {}),
      ...(e.movementType ? { movementType: e.movementType } : {}),
      ...(documentReference ? { documentReference } : {}),
      ...(e.postingDate ? { postingDate: e.postingDate } : {}),
      ...(e.processOrderId ? { processOrderId: e.processOrderId } : {}),
      ...(e.materialDocumentNumber ? { materialDocumentNumber: e.materialDocumentNumber } : {}),
      ...(e.purchaseOrderId ? { purchaseOrderId: e.purchaseOrderId } : {}),
      ...(e.supplierId ? { supplierId: e.supplierId } : {}),
      ...(e.customerId ? { customerId: e.customerId } : {}),
      ...(e.deliveryId ? { deliveryId: e.deliveryId } : {}),
      ...(e.salesOrderId ? { salesOrderId: e.salesOrderId } : {}),
    }
  })

  const anchorNode = raw.nodes.find(n => n.isAnchor)
  const upstreamCount = raw.nodes.filter(n => !n.isAnchor && n.directions.includes('upstream')).length
  const downstreamCount = raw.nodes.filter(n => !n.isAnchor && n.directions.includes('downstream')).length

  return TraceGraphSchema.parse({
    nodes,
    edges,
    direction: 'both',
    depth: raw.depth,
    rootBatch: anchorNode?.batchId ?? '',
    upstreamCount,
    downstreamCount,
    unresolvedNodeCount: 0,
    warnings: raw.warnings,
    truncated: raw.truncated,
  })
}
