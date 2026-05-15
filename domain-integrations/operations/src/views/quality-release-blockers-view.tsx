import { OperationsActionQueuePanel } from '../panels/operations-action-queue-panel.js'
import { QualityBlockersPanel, ReleaseHoldImpactPanel } from '@connectio/di-quality'
import type { OperationsPlanRiskAdapterRequest } from '../adapters/operations-plan-risk-adapter.js'
import type { QualityBlockersAdapterRequest } from '@connectio/di-quality'

export interface QualityReleaseBlockersViewProps {
  readonly opsRequest: OperationsPlanRiskAdapterRequest
  readonly qualityRequest: QualityBlockersAdapterRequest
}

const GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export function QualityReleaseBlockersView({ opsRequest, qualityRequest }: QualityReleaseBlockersViewProps) {
  return (
    <div style={GRID}>
      <QualityBlockersPanel request={qualityRequest} />
      <ReleaseHoldImpactPanel request={qualityRequest} />
      <OperationsActionQueuePanel request={opsRequest} />
    </div>
  )
}
