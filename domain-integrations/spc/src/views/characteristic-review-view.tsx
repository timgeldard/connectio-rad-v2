import type { CSSProperties } from 'react'
import { ControlChartPanel } from '../panels/control-chart-panel.js'
import { CharacteristicCapabilityPanel } from '../panels/characteristic-capability-panel.js'
import type { SPCMonitoringAdapterRequest } from '../adapters/spc-monitoring-adapter.js'

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export interface CharacteristicReviewViewProps {
  readonly request: SPCMonitoringAdapterRequest
}

export function CharacteristicReviewView({ request }: CharacteristicReviewViewProps) {
  return (
    <div style={GRID}>
      <ControlChartPanel request={request} />
      <CharacteristicCapabilityPanel request={request} />
    </div>
  )
}
