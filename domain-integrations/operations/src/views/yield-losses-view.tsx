import type { CSSProperties } from 'react'
import { OrderProgressPanel } from '../panels/order-progress-panel.js'
import { ProcessOrderHeaderPanel } from '../panels/process-order-header-panel.js'
import type { ProcessOrderReviewAdapterRequest } from '../adapters/process-order-review-adapter.js'

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export interface YieldLossesViewProps {
  readonly request: ProcessOrderReviewAdapterRequest
}

export function YieldLossesView({ request }: YieldLossesViewProps) {
  return (
    <div style={GRID}>
      <OrderProgressPanel request={request} />
      <ProcessOrderHeaderPanel request={request} />
    </div>
  )
}
