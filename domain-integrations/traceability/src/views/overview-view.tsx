import { BatchHeaderPanel } from '../panels/batch-header-panel.js'
import { RiskSignalsPanel } from '../panels/risk-signals-panel.js'
import { TraceGraphPanel } from '../panels/trace-graph-panel.js'
import { CustomerImpactPanel } from '../panels/customer-impact-panel.js'
import { CoAReleaseStatusPanel } from '../panels/coa-release-status-panel.js'
import { EventTimelinePanel } from '../panels/event-timeline-panel.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

/** Props for OverviewView. */
export interface OverviewViewProps {
  /** Adapter request context forwarded to all panels. */
  readonly request: Trace2AdapterRequest
}

/**
 * Overview view for the Trace Investigation workspace.
 *
 * @remarks
 * Renders six evidence panels giving a complete first-glance picture of the
 * investigation: batch identity, risk signals, trace graph, customer impact,
 * CoA status, and event timeline. Each panel manages its own loading/error state.
 */
export function OverviewView({ request }: OverviewViewProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 12,
        padding: 16,
        alignItems: 'start',
      }}
    >
      <BatchHeaderPanel request={request} />
      <RiskSignalsPanel request={request} />
      <TraceGraphPanel request={request} />
      <CustomerImpactPanel request={request} />
      <CoAReleaseStatusPanel request={request} />
      <EventTimelinePanel request={request} />
    </div>
  )
}
