import type { CSSProperties } from 'react'
import { CharacteristicCapabilityPanel } from '../panels/characteristic-capability-panel.js'
import { SPCSummaryPanel } from '../panels/spc-summary-panel.js'
import type { SPCMonitoringAdapterRequest } from '../adapters/spc-monitoring-adapter.js'

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export interface CapabilityViewProps {
  readonly request: SPCMonitoringAdapterRequest
}

export function CapabilityView({ request }: CapabilityViewProps) {
  return (
    <div style={GRID}>
      <CharacteristicCapabilityPanel request={request} />
      <SPCSummaryPanel request={request} />
    </div>
  )
}
