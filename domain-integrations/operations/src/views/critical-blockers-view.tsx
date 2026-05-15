import { PlanRiskSummaryPanel } from '../panels/plan-risk-summary-panel.js'
import { MaterialShortagePanel } from '../panels/material-shortage-panel.js'
import { OperationsActionQueuePanel } from '../panels/operations-action-queue-panel.js'
import { QualityBlockersPanel, ReleaseHoldImpactPanel } from '@connectio/di-quality'
import { MaintenanceConstraintPanel } from '@connectio/di-maintenance'
import type { OperationsPlanRiskAdapterRequest } from '../adapters/operations-plan-risk-adapter.js'
import type { QualityBlockersAdapterRequest } from '@connectio/di-quality'
import type { MaintenanceConstraintsAdapterRequest } from '@connectio/di-maintenance'

export interface CriticalBlockersViewProps {
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

export function CriticalBlockersView({ opsRequest, qualityRequest, maintenanceRequest }: CriticalBlockersViewProps) {
  return (
    <div style={GRID}>
      <PlanRiskSummaryPanel request={opsRequest} />
      <QualityBlockersPanel request={qualityRequest} />
      <ReleaseHoldImpactPanel request={qualityRequest} />
      <MaterialShortagePanel request={opsRequest} />
      <MaintenanceConstraintPanel request={maintenanceRequest} />
      <OperationsActionQueuePanel request={opsRequest} />
    </div>
  )
}
