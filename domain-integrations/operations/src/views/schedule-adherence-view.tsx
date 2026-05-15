import { ScheduleAdherencePanel } from '../panels/schedule-adherence-panel.js'
import { LateOrdersPanel } from '../panels/late-orders-panel.js'
import { YieldVariancePanel } from '../panels/yield-variance-panel.js'
import { MaterialShortagePanel } from '../panels/material-shortage-panel.js'
import { QualityBlockersPanel } from '@connectio/di-quality'
import type { OperationsPlanRiskAdapterRequest } from '../adapters/operations-plan-risk-adapter.js'
import type { QualityBlockersAdapterRequest } from '@connectio/di-quality'

export interface ScheduleAdherenceViewProps {
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

export function ScheduleAdherenceView({ opsRequest, qualityRequest }: ScheduleAdherenceViewProps) {
  return (
    <div style={GRID}>
      <ScheduleAdherencePanel request={opsRequest} />
      <LateOrdersPanel request={opsRequest} />
      <YieldVariancePanel request={opsRequest} />
      <MaterialShortagePanel request={opsRequest} />
      <QualityBlockersPanel request={qualityRequest} />
    </div>
  )
}
