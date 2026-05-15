import type { CSSProperties } from 'react'
import { SPCProcessContextPanel } from '../panels/spc-process-context-panel.js'
import { CharacteristicCapabilityPanel } from '../panels/characteristic-capability-panel.js'
import type { SPCMonitoringAdapterRequest } from '../adapters/spc-monitoring-adapter.js'

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export interface ChartConfigurationReadonlyViewProps {
  readonly request: SPCMonitoringAdapterRequest
}

export function ChartConfigurationReadonlyView({ request }: ChartConfigurationReadonlyViewProps) {
  return (
    <div style={GRID}>
      <SPCProcessContextPanel request={request} />
      <CharacteristicCapabilityPanel request={request} />
    </div>
  )
}
