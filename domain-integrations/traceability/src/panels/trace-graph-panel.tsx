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
      aria-label={`${node.materialDescription} — ${node.type}`}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
        <span style={{ fontSize: 9, fontWeight: 600, color: textColor, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
          {NODE_TYPE_LABEL[node.type] ?? node.type}
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
  const connectedEdges = graphEdges.filter(e => e.source === node.id || e.target === node.id)

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
        <Detail label="Type" value={NODE_TYPE_LABEL[node.type] ?? node.type} />
        <Detail label="Risk" value={risk} />
        <Detail label="Material" value={node.materialId ?? '—'} />
        {node.batchId && <Detail label="Batch" value={node.batchId} />}
        {node.plantId && <Detail label="Plant" value={node.plantId} />}
        {node.quantity != null && <Detail label="Quantity" value={`${node.quantity}${node.uom ? ` ${node.uom}` : ''}`} />}
        <Detail label="Status" value={node.status ?? '—'} />
      </div>
      {connectedEdges.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Relationships ({connectedEdges.length})
          </div>
          {connectedEdges.map(e => (
            <div key={e.id} style={{ fontSize: 10, color: '#374151', padding: '2px 0', display: 'flex', gap: 4 }}>
              <span style={{ color: '#9CA3AF' }}>{e.source === node.id ? '→' : '←'}</span>
              <span>{e.relationshipType.replace(/-/g, ' ')}</span>
              {e.documentReference && (
                <span style={{ color: '#6B7280', fontFamily: 'monospace' }}>({e.documentReference})</span>
              )}
            </div>
          ))}
        </div>
      )}
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
      <div style={{ fontSize: 10, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
        Selected relationship
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
        <Detail label="Type" value={edge.relationshipType.replace(/-/g, ' ')} />
        {edge.quantity != null && (
          <Detail label="Quantity" value={`${edge.quantity}${edge.uom ? ` ${edge.uom}` : ''}`} />
        )}
        {sourceNode && <Detail label="From" value={sourceNode.materialDescription} />}
        {targetNode && <Detail label="To" value={targetNode.materialDescription} />}
        {edge.movementType && <Detail label="Movement type" value={edge.movementType} />}
        {edge.documentReference && <Detail label="Reference" value={edge.documentReference} />}
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
          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
            <GraphStat label="Upstream" value={graph.upstreamCount} />
            <GraphStat label="Downstream" value={graph.downstreamCount} />
            <GraphStat label="Depth" value={graph.depth} />
            <GraphStat label="Unresolved" value={graph.unresolvedNodeCount} highlight={graph.unresolvedNodeCount > 0} />
          </div>

          {/* Direction toggle + root metadata */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <DirectionToggle active={activeDirection} onChange={setActiveDirection} />
            <span style={{ fontSize: 11, color: 'var(--shell-fg-3)', fontFamily: 'monospace' }}>
              {graph.rootBatch}
            </span>
          </div>

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
              No batch lineage found.
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
        </div>
      )}
    </EvidencePanel>
  )
}
