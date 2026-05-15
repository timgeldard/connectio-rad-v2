import type { CSSProperties } from 'react'
import { ExecutionTimelinePanel } from '../panels/execution-timeline-panel.js'
import { OrderProgressPanel } from '../panels/order-progress-panel.js'
import type { ProcessOrderReviewAdapterRequest } from '../adapters/process-order-review-adapter.js'

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export interface ExecutionTimelineViewProps {
  readonly request: ProcessOrderReviewAdapterRequest
}

export function ExecutionTimelineView({ request }: ExecutionTimelineViewProps) {
  return (
    <div style={GRID}>
      <ExecutionTimelinePanel request={request} />
      <OrderProgressPanel request={request} />
    </div>
  )
}
