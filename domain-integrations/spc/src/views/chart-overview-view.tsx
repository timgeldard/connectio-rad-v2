import type { CSSProperties } from 'react'
import { SPCSummaryPanel } from '../panels/spc-summary-panel.js'
import { ActiveSPCSignalsPanel } from '../panels/active-spc-signals-panel.js'
import { ControlChartPanel } from '../panels/control-chart-panel.js'
import type { SPCMonitoringAdapterRequest } from '../adapters/spc-monitoring-adapter.js'

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export interface ChartOverviewViewProps {
  readonly request: SPCMonitoringAdapterRequest
}

export function ChartOverviewView({ request }: ChartOverviewViewProps) {
  return (
    <div style={GRID}>
      <SPCSummaryPanel request={request} />
      <ActiveSPCSignalsPanel request={request} />
      <ControlChartPanel request={request} />
    </div>
  )
}
