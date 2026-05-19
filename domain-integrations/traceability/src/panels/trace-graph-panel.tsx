import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type NodeProps,
  type Node,
  type Edge,
} from '@xyflow/react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { TraceNode, TraceEdge } from '@connectio/data-contracts'
import { useTraceGraph } from '../adapters/trace2-queries.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'
import {
  RISK_BORDER,
  RISK_BG,
  RISK_TEXT,
  NODE_TYPE_LABEL,
  NODE_WIDTH,
  NODE_HEIGHT,
  mapToFlowNodes,
  mapToFlowEdges,
  filterGraphByDirection,
  type TraceNodeData,
} from './trace-graph-utils.js'

const registration: EvidencePanelRegistration = {
  panelId: 'trace-graph',
  displayName: 'Trace Graph',
  description: 'Upstream and downstream batch traceability network showing nodes, edges, and risk levels.',
  ownerDomain: 'traceability',
  sourceOwnership: { domainId: 'traceability', systemName: 'trace2', legacyAppId: 'trace2' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['trace-investigation', 'traceability-workspace'],
  requiredContext: [{ contextKey: 'batchId', scopeLevel: 'batch', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.95, hidden: false },
  drillThrough: { label: 'Open full trace tree', targetWorkspaceId: 'trace-investigation', targetViewId: 'trace-tree', contextScopes: ['batch'] },
  requiredPermissions: [{ permissionId: 'trace.read', displayName: 'Trace Read' }],
}

// ---------------------------------------------------------------------------
// Custom node renderer
// ---------------------------------------------------------------------------

function TraceNodeCard({ data }: NodeProps<Node<TraceNodeData>>) {
  const { node, isRoot, isSelected } = data
  const risk = node.riskLevel ?? 'none'
  const border = isSelected ? '#2563EB' : RISK_BORDER[risk] ?? '#6B7280'
  const bg = RISK_BG[risk] ?? '#F9FAFB'
  const textColor = RISK_TEXT[risk] ?? '#374151'

  return (
    <div
      style={{
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
        background: bg,
        border: `2px solid ${border}`,
        borderRadius: 6,
        padding: '6px 8px',
        boxSizing: 'border-box',
        boxShadow: isRoot ? `0 0 0 3px ${border}40` : undefined,
        cursor: 'pointer',
      }}
      aria-label={`${node.materialDescription}${node.type ? ` — ${node.type}` : ''}`}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
        <span style={{ fontSize: 9, fontWeight: 600, color: textColor, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
          {node.type ? (NODE_TYPE_LABEL[node.type] ?? node.type) : undefined}
        </span>
        {isRoot && (
          <span style={{ fontSize: 8, background: '#2563EB', color: '#fff', borderRadius: 3, padding: '1px 4px', flexShrink: 0 }}>
            ROOT
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#111827', marginTop: 2, lineHeight: 1.3, wordBreak: 'break-word' }}>
        {node.materialDescription}
      </div>
      {node.batchId && (
        <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2, fontFamily: 'monospace' }}>
          {node.batchId}
        </div>
      )}
      <div style={{ display: 'flex', gap: 4, marginTop: 4, alignItems: 'center' }}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: border,
            flexShrink: 0,
            display: 'inline-block',
          }}
          aria-label={`Risk: ${risk}`}
        />
        <span style={{ fontSize: 9, color: textColor, textTransform: 'capitalize' }}>{risk}</span>
        {node.status === 'unresolved' && (
          <span style={{ fontSize: 9, color: '#F24A00', marginLeft: 'auto', fontWeight: 600 }}>Unresolved</span>
        )}
      </div>
    </div>
  )
}

const nodeTypes = { traceNode: TraceNodeCard }

// ---------------------------------------------------------------------------
// Selected node detail panel
// ---------------------------------------------------------------------------

function SelectedNodeDetail({ node, graphEdges }: { node: TraceNode; graphEdges: TraceEdge[] }) {
  const risk = node.riskLevel ?? 'none'
  const borderColor = RISK_BORDER[risk] ?? '#6B7280'
  const inboundEdges = graphEdges.filter(e => e.target === node.id)
  const outboundEdges = graphEdges.filter(e => e.source === node.id)

  return (
    <div
      style={{
        padding: '10px 12px',
        background: RISK_BG[risk] ?? '#F9FAFB',
        border: `1px solid ${borderColor}`,
        borderRadius: 6,
        marginTop: 8,
      }}
      aria-label="Selected node details"
    >
      <div style={{ fontSize: 10, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
        Selected node
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
        <Detail label="Material" value={node.materialId} />
        {node.batchId && <Detail label="Batch" value={node.batchId} />}
        {node.plantId && <Detail label="Plant" value={node.plantId} />}
        {node.depth != null && <Detail label="Depth" value={String(node.depth)} />}
        <Detail label="Anchor" value={node.isAnchor ? 'Yes' : 'No'} />
        {node.directions && node.directions.length > 0 && (
          <Detail label="Direction" value={node.directions.join(', ')} />
        )}
        <Detail label="Inbound edges" value={String(inboundEdges.length)} />
        <Detail label="Outbound edges" value={String(outboundEdges.length)} />
        {node.quantity != null && <Detail label="Quantity" value={`${node.quantity}${node.uom ? ` ${node.uom}` : ''}`} />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Selected edge detail panel
// ---------------------------------------------------------------------------

function SelectedEdgeDetail({ edge, nodes }: { edge: TraceEdge; nodes: TraceNode[] }) {
  const sourceNode = nodes.find(n => n.id === edge.source)
  const targetNode = nodes.find(n => n.id === edge.target)

  return (
    <div
      style={{
        padding: '10px 12px',
        background: 'var(--shell-surface)',
        border: '1px solid #9CA3AF',
        borderRadius: 6,
        marginTop: 8,
      }}
      aria-label="Selected relationship details"
    >
      <div style={{ fontSize: 10, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
        Selected relationship
      </div>
      <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 6 }}>Available evidence from gold_batch_lineage</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
        <Detail label="Link type" value={edge.relationshipType?.replace(/-/g, ' ') ?? '—'} />
        {edge.movementType && <Detail label="Movement type" value={edge.movementType} />}
        {edge.postingDate && <Detail label="Posting date" value={edge.postingDate} />}
        {edge.quantity != null && (
          <Detail label="Quantity" value={`${edge.quantity}${edge.uom ? ` ${edge.uom}` : ''}`} />
        )}
        {sourceNode && <Detail label="Source batch" value={sourceNode.batchId ?? edge.source} />}
        {targetNode && <Detail label="Target batch" value={targetNode.batchId ?? edge.target} />}
        {edge.processOrderId && <Detail label="Process order" value={edge.processOrderId} />}
        {edge.materialDocumentNumber && <Detail label="Material document" value={edge.materialDocumentNumber} />}
        {edge.purchaseOrderId && <Detail label="Purchase order" value={edge.purchaseOrderId} />}
        {edge.deliveryId && <Detail label="Delivery" value={edge.deliveryId} />}
        {edge.salesOrderId && <Detail label="Sales order" value={edge.salesOrderId} />}
        {edge.supplierId && <Detail label="Supplier" value={edge.supplierId} />}
        {edge.customerId && <Detail label="Customer" value={edge.customerId} />}
      </div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <span style={{ fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>{label}</span>
      <span style={{ fontSize: 11, color: '#111827', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

function HeaderChip({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 8, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: alert ? '#92400E' : '#111827', fontFamily: 'monospace' }}>{value}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Timeline derived from graph edges (c.txt §6)
// ---------------------------------------------------------------------------

function EdgeTimeline({ edges }: { edges: TraceEdge[] }) {
  const dated = edges
    .filter(e => !!e.postingDate)
    .sort((a, b) => (a.postingDate! < b.postingDate! ? -1 : 1))
  const undated = edges.filter(e => !e.postingDate)

  return (
    <div
      style={{
        marginTop: 16,
        padding: '10px 12px',
        background: 'var(--shell-surface)',
        border: '1px solid var(--shell-line)',
        borderRadius: 6,
      }}
      aria-label="Timeline from lineage edges"
    >
      <div style={{ fontSize: 10, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        Timeline from lineage edges
      </div>
      {dated.length === 0 && undated.length === 0 && (
        <p style={{ fontSize: 11, color: 'var(--shell-fg-3)', margin: 0 }}>No lineage edges to display.</p>
      )}
      {dated.length === 0 && undated.length > 0 && (
        <p style={{ fontSize: 11, color: 'var(--shell-fg-3)', margin: 0 }}>No dated events available — {undated.length} undated edge{undated.length !== 1 ? 's' : ''}.</p>
      )}
      {dated.map(e => (
        <div
          key={e.id}
          style={{ display: 'flex', gap: 10, padding: '4px 0', borderBottom: '1px solid var(--shell-line)', fontSize: 11 }}
        >
          <span style={{ color: '#6B7280', fontFamily: 'monospace', minWidth: 90, flexShrink: 0 }}>{e.postingDate}</span>
          <span style={{ color: '#374151', fontWeight: 500 }}>{e.relationshipType?.replace(/-/g, ' ') ?? '—'}</span>
          {e.movementType && <span style={{ color: '#6B7280' }}>MT:{e.movementType}</span>}
          {e.processOrderId && <span style={{ color: '#6B7280', fontFamily: 'monospace' }}>PO:{e.processOrderId}</span>}
          {e.materialDocumentNumber && <span style={{ color: '#6B7280', fontFamily: 'monospace' }}>Doc:{e.materialDocumentNumber}</span>}
          {e.deliveryId && <span style={{ color: '#6B7280', fontFamily: 'monospace' }}>Del:{e.deliveryId}</span>}
          {e.quantity != null && <span style={{ color: '#374151' }}>{e.quantity}{e.uom ? ` ${e.uom}` : ''}</span>}
        </div>
      ))}
      {undated.length > 0 && dated.length > 0 && (
        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>+ {undated.length} undated edge{undated.length !== 1 ? 's' : ''} not shown above.</div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Exposure indicators from graph edges (c.txt §7)
// ---------------------------------------------------------------------------

function ExposureSummary({ edges }: { edges: TraceEdge[] }) {
  const customers = new Set(edges.map(e => e.customerId).filter(Boolean))
  const suppliers = new Set(edges.map(e => e.supplierId).filter(Boolean))
  const deliveries = new Set(edges.map(e => e.deliveryId).filter(Boolean))
  const purchaseOrders = new Set(edges.map(e => e.purchaseOrderId).filter(Boolean))
  const processOrders = new Set(edges.map(e => e.processOrderId).filter(Boolean))

  const linkTypeCounts: Record<string, number> = {}
  for (const e of edges) {
    const lt = e.relationshipType ?? 'unknown'
    linkTypeCounts[lt] = (linkTypeCounts[lt] ?? 0) + 1
  }

  const uoms = new Set(edges.map(e => e.uom).filter(Boolean))
  const mixedUom = uoms.size > 1

  return (
    <div
      style={{
        marginTop: 12,
        padding: '10px 12px',
        background: 'var(--shell-surface)',
        border: '1px solid var(--shell-line)',
        borderRadius: 6,
      }}
      aria-label="Lineage exposure indicators"
    >
      <div style={{ fontSize: 10, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        Lineage exposure indicators
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px 8px', marginBottom: 8 }}>
        <ExposureStat label="Customers" value={customers.size} />
        <ExposureStat label="Suppliers" value={suppliers.size} />
        <ExposureStat label="Deliveries" value={deliveries.size} />
        <ExposureStat label="Purch. orders" value={purchaseOrders.size} />
        <ExposureStat label="Process orders" value={processOrders.size} />
      </div>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Edges by link type</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px' }}>
          {Object.entries(linkTypeCounts).map(([lt, count]) => (
            <span key={lt} style={{ fontSize: 10, color: '#374151' }}>
              {lt.replace(/-/g, ' ')}: {count}
            </span>
          ))}
        </div>
      </div>
      {mixedUom && (
        <div style={{ fontSize: 10, color: '#92400E', background: '#FFFBEB', padding: '3px 6px', borderRadius: 3 }}>
          Mixed UoM — quantity totals would be misleading across units: {Array.from(uoms).join(', ')}
        </div>
      )}
      <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 8, lineHeight: 1.5 }}>
        Customer/supplier exposure is based only on references present in gold_batch_lineage.
        This does not replace full delivery/customer recall analysis.
      </div>
    </div>
  )
}

function ExposureStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ textAlign: 'center', padding: '6px 4px', background: value > 0 ? '#EFF6FF' : 'var(--shell-surface)', border: '1px solid var(--shell-line)', borderRadius: 4 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: value > 0 ? '#1D4ED8' : '#9CA3AF' }}>{value}</div>
      <div style={{ fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Source / limitation banner (c.txt §9)
// ---------------------------------------------------------------------------

function SourceBanner({ source, depthReached, truncated }: { source: string; depthReached: number; truncated: boolean }) {
  return (
    <div
      style={{
        marginTop: 12,
        padding: '8px 12px',
        background: '#F9FAFB',
        border: '1px solid #E5E7EB',
        borderRadius: 4,
        fontSize: 10,
        color: '#6B7280',
        lineHeight: 1.6,
      }}
      aria-label="Data source information"
    >
      <div style={{ fontWeight: 600, marginBottom: 2, color: '#374151' }}>Data source</div>
      <div>Source: <span style={{ fontFamily: 'monospace' }}>gold_batch_lineage</span></div>
      <div>Execution: <span style={{ fontFamily: 'monospace' }}>{source}</span></div>
      <div>Query: <span style={{ fontFamily: 'monospace' }}>trace2.get_trace_graph</span></div>
      <div>Depth reached: {depthReached} | Truncated: {truncated ? 'Yes' : 'No'} | API verified: Yes</div>
      <div style={{ marginTop: 4, color: '#9CA3AF' }}>
        Material IDs use stored gold format (no SAP ALPHA leading zeros). Batch IDs preserve leading zeros.
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Summary stats bar
// ---------------------------------------------------------------------------

function GraphStat({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--shell-surface)', borderRadius: 4, border: '1px solid var(--shell-line)' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: highlight ? 'var(--sunset, #F24A00)' : 'var(--shell-fg)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Direction toggle
// ---------------------------------------------------------------------------

type DirectionOption = 'both' | 'forward' | 'reverse'

const DIRECTION_LABELS: Record<DirectionOption, string> = {
  both: 'Both',
  forward: 'Downstream ↓',
  reverse: 'Upstream ↑',
}

function DirectionToggle({
  active,
  onChange,
}: {
  active: DirectionOption
  onChange: (d: DirectionOption) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 10 }} role="group" aria-label="Trace direction">
      {(['reverse', 'both', 'forward'] as DirectionOption[]).map(dir => (
        <button
          key={dir}
          onClick={() => onChange(dir)}
          style={{
            padding: '3px 10px',
            fontSize: 11,
            borderRadius: 4,
            border: '1px solid var(--shell-line)',
            background: active === dir ? '#2563EB' : 'var(--shell-surface)',
            color: active === dir ? '#fff' : 'var(--shell-fg)',
            cursor: 'pointer',
            fontWeight: active === dir ? 600 : 400,
          }}
          aria-pressed={active === dir}
        >
          {DIRECTION_LABELS[dir]}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Link type legend
// ---------------------------------------------------------------------------

const LINK_TYPE_COLORS: Record<string, string> = {
  'goods-movement': '#2563EB',
  'production-order': '#7C3AED',
  'purchase-order': '#D97706',
  'sales-order': '#059669',
  transfer: '#0891B2',
}

function LinkTypeLegend({ edges }: { edges: TraceEdge[] }) {
  const types = [...new Set(edges.flatMap(e => e.relationshipType != null ? [e.relationshipType] : []))]
  if (types.length === 0) return null
  return (
    <div
      style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginBottom: 8 }}
      aria-label="Link type legend"
      data-testid="link-type-legend"
    >
      {types.map(lt => (
        <span key={lt} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#374151' }}>
          <span
            style={{
              display: 'inline-block',
              width: 16,
              height: 2,
              background: LINK_TYPE_COLORS[lt] ?? '#6B7280',
              borderRadius: 1,
              flexShrink: 0,
            }}
          />
          {lt.replace(/-/g, ' ')}
        </span>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export interface TraceGraphPanelProps {
  readonly request: Trace2AdapterRequest
}

export function TraceGraphPanel({ request }: TraceGraphPanelProps) {
  const { data: result, isLoading } = useTraceGraph(request)
  const lastRefreshedAt = result?.ok ? result.fetchedAt : null
  const { displayState, markReady, markError } = useEvidencePanel({
    panelId: registration.panelId,
    staleAfterSeconds: registration.freshnessPolicy.staleAfterSeconds,
    lastRefreshedAt,
  })

  useEffect(() => {
    if (isLoading) return
    if (result?.ok) markReady()
    else if (result && !result.ok) markError()
  }, [isLoading, result, markReady, markError])

  const graph = result?.ok ? result.data : null

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [activeDirection, setActiveDirection] = useState<DirectionOption>('both')

  const directedGraph = useMemo(
    () => (graph ? filterGraphByDirection(graph, activeDirection) : null),
    [graph, activeDirection],
  )

  const initialNodes = useMemo(
    () => (directedGraph ? mapToFlowNodes(directedGraph, selectedId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [directedGraph],
  )
  const initialEdges = useMemo(() => (directedGraph ? mapToFlowEdges(directedGraph) : []), [directedGraph])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Sync when graph data or direction changes
  useEffect(() => {
    if (!directedGraph) return
    setNodes(mapToFlowNodes(directedGraph, selectedId))
    setEdges(mapToFlowEdges(directedGraph))
  // Deliberately omit selectedId to avoid clearing selection on data refresh
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directedGraph, setNodes, setEdges])

  // Update node selected state without triggering a full graph re-layout
  useEffect(() => {
    setNodes(prev =>
      prev.map(n => ({
        ...n,
        data: { ...n.data, isSelected: n.id === selectedId },
      })),
    )
  }, [selectedId, setNodes])

  // Clear selections when direction changes
  useEffect(() => {
    setSelectedId(null)
    setSelectedEdgeId(null)
  }, [activeDirection])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedId(prev => (prev === node.id ? null : node.id))
    setSelectedEdgeId(null)
  }, [])

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(prev => (prev === edge.id ? null : edge.id))
    setSelectedId(null)
  }, [])

  const selectedNode = selectedId
    ? directedGraph?.nodes.find(n => n.id === selectedId) ?? null
    : null

  const selectedEdge = selectedEdgeId
    ? directedGraph?.edges.find(e => e.id === selectedEdgeId) ?? null
    : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {graph && (
        <div style={{ padding: '12px 16px' }}>
          {/* Investigation header */}
          <div
            style={{
              background: 'var(--shell-surface)',
              border: '1px solid var(--shell-line)',
              borderRadius: 6,
              padding: '8px 12px',
              marginBottom: 10,
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px 16px',
              alignItems: 'center',
            }}
            aria-label="Investigation context"
          >
            <HeaderChip label="Material" value={request.materialId ?? '—'} />
            <HeaderChip label="Batch" value={request.batchId ?? '—'} />
            <HeaderChip label="Plant" value={request.plantId ?? '—'} />
            <HeaderChip label="Nodes" value={String(graph.nodes.length)} />
            <HeaderChip label="Edges" value={String(graph.edges.length)} />
            <HeaderChip label="Depth reached" value={String(graph.depth)} />
            <HeaderChip label="Truncated" value={graph.truncated ? 'Yes' : 'No'} alert={!!graph.truncated} />
            {graph.warnings && graph.warnings.length > 0 && (
              <HeaderChip label="Warnings" value={String(graph.warnings.length)} alert />
            )}
            <HeaderChip label="Source" value={result?.source ?? 'databricks-api'} />
          </div>

          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
            <GraphStat label="Upstream" value={graph.upstreamCount} />
            <GraphStat label="Downstream" value={graph.downstreamCount} />
            <GraphStat label="Depth" value={graph.depth} />
            <GraphStat label="Unresolved" value={graph.unresolvedNodeCount} highlight={graph.unresolvedNodeCount > 0} />
          </div>

          {/* Warnings / truncation banner */}
          {(graph.truncated ||
            graph.warnings?.includes('max_depth_reached') ||
            graph.warnings?.includes('max_edges_reached')) && (
            <div
              role="status"
              style={{
                fontSize: 11,
                color: '#92400E',
                background: '#FFFBEB',
                border: '1px solid #D97706',
                borderRadius: 4,
                padding: '4px 8px',
                marginBottom: 10,
              }}
            >
              <span>
                Trace graph truncated — the displayed lineage may be incomplete because the max depth or
                row limit was reached. Review with a deeper trace or Databricks validation before
                concluding exposure is complete.
              </span>
            </div>
          )}

          {/* Direction toggle + root metadata */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <DirectionToggle active={activeDirection} onChange={setActiveDirection} />
            <span style={{ fontSize: 11, color: 'var(--shell-fg-3)', fontFamily: 'monospace' }}>
              {graph.rootBatch}
            </span>
          </div>

          {/* Link type legend — derived from current directed graph */}
          {directedGraph && <LinkTypeLegend edges={directedGraph.edges} />}

          {/* React Flow graph or empty state */}
          {directedGraph && directedGraph.nodes.length === 0 ? (
            <div
              style={{
                height: 120,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px dashed var(--shell-line)',
                borderRadius: 6,
                color: 'var(--shell-fg-3)',
                fontSize: 13,
              }}
            >
              No lineage edges found for this material/batch/plant.
            </div>
          ) : (
            <div
              style={{ height: 360, borderRadius: 6, border: '1px solid var(--shell-line)', overflow: 'hidden' }}
              aria-label="Trace graph visualisation"
            >
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                onEdgeClick={onEdgeClick}
                fitView
                fitViewOptions={{ padding: 0.3 }}
                minZoom={0.3}
                maxZoom={2}
                attributionPosition="bottom-right"
              >
                <Background gap={16} size={1} color="#E5E7EB" />
                <Controls showInteractive={false} />
              </ReactFlow>
            </div>
          )}

          {/* Selection detail panels */}
          {selectedNode && (
            <SelectedNodeDetail node={selectedNode} graphEdges={directedGraph?.edges ?? []} />
          )}
          {selectedEdge && directedGraph && (
            <SelectedEdgeDetail edge={selectedEdge} nodes={directedGraph.nodes} />
          )}
          {!selectedNode && !selectedEdge && (
            <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--shell-fg-3)' }}>
              Click a node or edge to see details. Pan and zoom to explore the graph.
            </p>
          )}

          {/* Timeline from lineage edges */}
          <EdgeTimeline edges={graph.edges} />

          {/* Exposure indicators from lineage edges */}
          <ExposureSummary edges={graph.edges} />

          {/* Source / limitation banner */}
          <SourceBanner
            source={result?.source ?? 'databricks-api'}
            depthReached={graph.depth}
            truncated={!!graph.truncated}
          />
        </div>
      )}
    </EvidencePanel>
  )
}
