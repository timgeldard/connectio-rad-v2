import { TraceGraphPanel } from '../panels/trace-graph-panel.js'
import { BatchHeaderPanel } from '../panels/batch-header-panel.js'
import { RiskSignalsPanel } from '../panels/risk-signals-panel.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

/** Props for TraceTreeView. */
export interface TraceTreeViewProps {
  /** Adapter request context forwarded to all panels. */
  readonly request: Trace2AdapterRequest
}

/**
 * Trace Tree view for the Trace Investigation workspace.
 *
 * @remarks
 * Emphasises the trace graph as the dominant panel in a two-column layout.
 * The graph panel spans full width at the top; batch header and risk signals
 * sit below for quick reference context.
 */
export function TraceTreeView({ request }: TraceTreeViewProps) {
  return (
    <div style={{ display: 'grid', gap: 12, padding: 16 }}>
      {/* Full-width dominant trace graph */}
      <div>
        <TraceGraphPanel request={request} />
      </div>
      {/* Supporting context panels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        <BatchHeaderPanel request={request} />
        <RiskSignalsPanel request={request} />
      </div>
    </div>
  )
}
