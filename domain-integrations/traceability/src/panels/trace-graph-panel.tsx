import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { TraceGraph, TraceNode } from '@connectio/data-contracts'
import { useTraceGraph } from '../adapters/trace2-queries.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

/** Static registration record for the Trace Graph panel. */
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

/** Risk level to colour mapping for node badges. */
const riskColour: Record<string, string> = {
  critical: 'var(--sunset, #F24A00)',
  high: '#D97706',
  medium: '#D4A017',
  low: 'var(--sage, #289BA2)',
  none: 'var(--shell-fg-3)',
}

/** Props for TraceGraphPanel. */
export interface TraceGraphPanelProps {
  /** Adapter request context providing investigationId and batchId. */
  readonly request: Trace2AdapterRequest
}

/**
 * Evidence panel displaying the batch trace graph summary.
 *
 * @remarks
 * Phase 1 renders a structured placeholder with summary statistics and
 * a node list. React Flow integration is deferred to a future phase — the
 * panel architecture ensures a seamless upgrade when the graph library is added.
 */
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

  const data: TraceGraph | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: '12px 16px' }}>
          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
            <GraphStat label="Upstream" value={data.upstreamCount} />
            <GraphStat label="Downstream" value={data.downstreamCount} />
            <GraphStat label="Depth" value={data.depth} />
            <GraphStat label="Unresolved" value={data.unresolvedNodeCount} highlight={data.unresolvedNodeCount > 0} />
          </div>

          {/* Direction badge */}
          <div style={{ marginBottom: 12, fontSize: 11, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Direction: <strong style={{ color: 'var(--shell-fg)' }}>{data.direction}</strong>
            {' · '}Root: <strong style={{ color: 'var(--shell-fg)' }}>{data.rootBatch}</strong>
          </div>

          {/* Node list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {data.nodes.map((node: TraceNode) => (
              <div
                key={node.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  background: 'var(--shell-surface)',
                  border: '1px solid var(--shell-line)',
                  borderRadius: 4,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: riskColour[node.riskLevel ?? 'none'] ?? 'var(--shell-fg-3)',
                    flexShrink: 0,
                    display: 'inline-block',
                  }}
                  aria-label={`Risk: ${node.riskLevel ?? 'none'}`}
                />
                <span style={{ fontSize: 12, color: 'var(--shell-fg)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {node.materialDescription}
                  {node.batchId && (
                    <span style={{ color: 'var(--shell-fg-2)', marginLeft: 6 }}>{node.batchId}</span>
                  )}
                </span>
                <span style={{ fontSize: 11, color: 'var(--shell-fg-3)', textTransform: 'capitalize', flexShrink: 0 }}>
                  {node.type.replace(/-/g, ' ')}
                </span>
              </div>
            ))}
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--shell-fg-3)' }}>
            Graph visualisation (React Flow) will be added in Phase 2.
          </p>
        </div>
      )}
    </EvidencePanel>
  )
}

/** Small numeric stat within the graph summary header. */
function GraphStat({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--shell-surface)', borderRadius: 4, border: '1px solid var(--shell-line)' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: highlight ? 'var(--sunset, #F24A00)' : 'var(--shell-fg)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
    </div>
  )
}
