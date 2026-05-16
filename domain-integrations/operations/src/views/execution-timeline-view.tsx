import type { CSSProperties } from 'react'
import { ExecutionTimelinePanel } from '../panels/execution-timeline-panel.js'
import { OrderProgressPanel } from '../panels/order-progress-panel.js'
import { OrderOperationsPanel } from '../panels/order-operations-panel.js'
import { OrderConfirmationsPanel } from '../panels/order-confirmations-panel.js'
import { ProcessOrderGoodsMovementsPanel } from '../panels/process-order-goods-movements-panel.js'
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
      <OrderOperationsPanel request={request} />
      <OrderConfirmationsPanel request={request} />
      <ProcessOrderGoodsMovementsPanel request={request} />
      <ExecutionTimelinePanel request={request} />
      <OrderProgressPanel request={request} />
    </div>
  )
}
