import { TraceGraphSchema } from '@connectio/data-contracts'
import type { TraceGraph } from '@connectio/data-contracts'

// ---------------------------------------------------------------------------
// Backend response shapes (POST /api/trace2/trace-graph)
// ---------------------------------------------------------------------------

interface BackendNode {
  nodeKey: string
  materialId: string
  batchId: string
  plantId: string
  label: string
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
  baseUnitOfMeasure: string | null
  postingDate: string | null
  movementType: string | null
  depth: number
  direction: string
}

export interface BackendTraceGraphResponse {
  anchor: {
    materialId: string
    batchId: string
    plantId: string
    nodeKey: string
  }
  nodes: BackendNode[]
  edges: BackendEdge[]
  depthReached: number
  truncated: boolean
  warnings: string[]
}

// ---------------------------------------------------------------------------
// linkType → relationshipType (mirrors Python _LINK_TYPE_MAP in trace2_databricks_adapter.py)
// ---------------------------------------------------------------------------

type RelationshipType =
  | 'component-of'
  | 'produced-from'
  | 'split-from'
  | 'merged-into'
  | 'transferred-to'
  | 'delivered-to'

const LINK_TYPE_MAP: Record<string, RelationshipType> = {
  PRODUCTION: 'produced-from',
  BATCH_TRANSFER: 'transferred-to',
  STO_TRANSFER: 'transferred-to',
  VENDOR_RECEIPT: 'component-of',
  CONSUMPTION: 'component-of',
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
 * Mapping rules (u.txt):
 * - node.id ← nodeKey (materialId:batchId:plantId)
 * - node.type ← undefined (not available from gold_batch_lineage)
 * - node.materialDescription ← '' (empty string — no material master join in lineage table)
 * - node.materialId/batchId/plantId ← direct
 * - edge.relationshipType ← mapped from linkType via LINK_TYPE_MAP; undefined if unknown
 * - edge.documentReference ← materialDocumentNumber ?? processOrderId
 * - edge.uom ← baseUnitOfMeasure
 * - graph.rootBatch ← anchor.batchId
 * - graph.upstreamCount ← non-anchor nodes with 'upstream' in directions
 * - graph.downstreamCount ← non-anchor nodes with 'downstream' in directions
 * - graph.unresolvedNodeCount ← 0 (not available from lineage table)
 */
export function mapBackendTraceGraph(raw: BackendTraceGraphResponse): TraceGraph {
  const nodes = raw.nodes.map(n => ({
    id: n.nodeKey,
    materialId: n.materialId,
    materialDescription: '',
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
      ...(relationshipType !== undefined ? { relationshipType } : {}),
      ...(e.quantity !== null ? { quantity: e.quantity } : {}),
      ...(e.baseUnitOfMeasure ? { uom: e.baseUnitOfMeasure } : {}),
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

  const upstreamCount = raw.nodes.filter(n => !n.isAnchor && n.directions.includes('upstream')).length
  const downstreamCount = raw.nodes.filter(n => !n.isAnchor && n.directions.includes('downstream')).length

  return TraceGraphSchema.parse({
    nodes,
    edges,
    direction: 'both',
    depth: raw.depthReached,
    rootBatch: raw.anchor.batchId,
    upstreamCount,
    downstreamCount,
    unresolvedNodeCount: 0,
    warnings: raw.warnings,
    truncated: raw.truncated,
  })
}
