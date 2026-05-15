import { MaterialShortagePanel } from '../panels/material-shortage-panel.js'
import { LateOrdersPanel } from '../panels/late-orders-panel.js'
import { OperationsActionQueuePanel } from '../panels/operations-action-queue-panel.js'
import { WarehouseStagingStatusPanel } from '@connectio/di-warehouse'
import type { OperationsPlanRiskAdapterRequest } from '../adapters/operations-plan-risk-adapter.js'
import type { WarehouseStagingAdapterRequest } from '@connectio/di-warehouse'

export interface MaterialStagingRiskViewProps {
  readonly opsRequest: OperationsPlanRiskAdapterRequest
  readonly warehouseRequest: WarehouseStagingAdapterRequest
}

const GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export function MaterialStagingRiskView({ opsRequest, warehouseRequest }: MaterialStagingRiskViewProps) {
  return (
    <div style={GRID}>
      <MaterialShortagePanel request={opsRequest} />
      <WarehouseStagingStatusPanel request={warehouseRequest} />
      <LateOrdersPanel request={opsRequest} />
      <OperationsActionQueuePanel request={opsRequest} />
    </div>
  )
}
