import { ShiftHandoverPanel } from '../panels/shift-handover-panel.js'
import { OperationsActionQueuePanel } from '../panels/operations-action-queue-panel.js'
import { QualityBlockersPanel } from '@connectio/di-quality'
import { MaintenanceConstraintPanel } from '@connectio/di-maintenance'
import type { OperationsPlanRiskAdapterRequest } from '../adapters/operations-plan-risk-adapter.js'
import type { QualityBlockersAdapterRequest } from '@connectio/di-quality'
import type { MaintenanceConstraintsAdapterRequest } from '@connectio/di-maintenance'

export interface HandoverActionsViewProps {
  readonly opsRequest: OperationsPlanRiskAdapterRequest
  readonly qualityRequest: QualityBlockersAdapterRequest
  readonly maintenanceRequest: MaintenanceConstraintsAdapterRequest
}

const GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export function HandoverActionsView({ opsRequest, qualityRequest, maintenanceRequest }: HandoverActionsViewProps) {
  return (
    <div style={GRID}>
      <ShiftHandoverPanel request={opsRequest} />
      <OperationsActionQueuePanel request={opsRequest} />
      <QualityBlockersPanel request={qualityRequest} />
      <MaintenanceConstraintPanel request={maintenanceRequest} />
    </div>
  )
}
