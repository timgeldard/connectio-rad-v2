import { PlanRiskSummaryPanel } from '../panels/plan-risk-summary-panel.js'
import { LateOrdersPanel } from '../panels/late-orders-panel.js'
import { MaterialShortagePanel } from '../panels/material-shortage-panel.js'
import { LineStatusPanel } from '../panels/line-status-panel.js'
import { OperationsActionQueuePanel } from '../panels/operations-action-queue-panel.js'
import { QualityBlockersPanel } from '@connectio/di-quality'
import { WarehouseStagingStatusPanel } from '@connectio/di-warehouse'
import type { OperationsPlanRiskAdapterRequest } from '../adapters/operations-plan-risk-adapter.js'
import type { QualityBlockersAdapterRequest } from '@connectio/di-quality'
import type { WarehouseStagingAdapterRequest } from '@connectio/di-warehouse'

export interface PlanOverviewViewProps {
  readonly opsRequest: OperationsPlanRiskAdapterRequest
  readonly qualityRequest: QualityBlockersAdapterRequest
  readonly warehouseRequest: WarehouseStagingAdapterRequest
}

const GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export function PlanOverviewView({ opsRequest, qualityRequest, warehouseRequest }: PlanOverviewViewProps) {
  return (
    <div style={GRID}>
      <PlanRiskSummaryPanel request={opsRequest} />
      <LateOrdersPanel request={opsRequest} />
      <MaterialShortagePanel request={opsRequest} />
      <QualityBlockersPanel request={qualityRequest} />
      <WarehouseStagingStatusPanel request={warehouseRequest} />
      <LineStatusPanel request={opsRequest} />
      <OperationsActionQueuePanel request={opsRequest} />
    </div>
  )
}
