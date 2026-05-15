import type { CSSProperties } from 'react'
import { StagingReadinessSummaryPanel } from '../panels/staging-readiness-summary-panel.js'
import { StagingOrderListPanel } from '../panels/staging-order-list-panel.js'
import { StagingAlertsPanel } from '../panels/staging-alerts-panel.js'
import type { ProductionStagingAdapterRequest } from '../adapters/production-staging-adapter.js'

export interface StagingOverviewViewProps {
  readonly request: ProductionStagingAdapterRequest
}

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export function StagingOverviewView({ request }: StagingOverviewViewProps) {
  return (
    <div style={GRID}>
      <StagingReadinessSummaryPanel request={request} />
      <StagingOrderListPanel request={request} />
      <StagingAlertsPanel request={request} />
    </div>
  )
}
