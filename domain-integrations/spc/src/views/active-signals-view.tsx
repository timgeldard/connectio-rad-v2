import type { CSSProperties } from 'react'
import { ActiveSPCSignalsPanel } from '../panels/active-spc-signals-panel.js'
import { SPCProcessContextPanel } from '../panels/spc-process-context-panel.js'
import type { SPCMonitoringAdapterRequest } from '../adapters/spc-monitoring-adapter.js'

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export interface ActiveSignalsViewProps {
  readonly request: SPCMonitoringAdapterRequest
}

export function ActiveSignalsView({ request }: ActiveSignalsViewProps) {
  return (
    <div style={GRID}>
      <ActiveSPCSignalsPanel request={request} />
      <SPCProcessContextPanel request={request} />
    </div>
  )
}
