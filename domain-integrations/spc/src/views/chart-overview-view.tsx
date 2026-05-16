import type { CSSProperties } from 'react'
import { SPCSummaryPanel } from '../panels/spc-summary-panel.js'
import { ActiveSPCSignalsPanel } from '../panels/active-spc-signals-panel.js'
import { ControlChartPanel } from '../panels/control-chart-panel.js'
import { useMonitoredCharacteristics } from '../adapters/spc-monitoring-queries.js'
import type { SPCMonitoringAdapterRequest } from '../adapters/spc-monitoring-adapter.js'

const HEADER_GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
}

const CHART_GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  alignItems: 'start',
}

export interface ChartOverviewViewProps {
  readonly request: SPCMonitoringAdapterRequest
}

export function ChartOverviewView({ request }: ChartOverviewViewProps) {
  const { data: charsResult } = useMonitoredCharacteristics(request)
  const characteristics = charsResult?.ok ? charsResult.data : []

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div style={HEADER_GRID}>
        <SPCSummaryPanel request={request} />
        <ActiveSPCSignalsPanel request={request} />
      </div>
      {characteristics.length > 0 ? (
        <div style={CHART_GRID}>
          {characteristics.map(char => (
            <ControlChartPanel
              key={char.characteristicId}
              request={{ ...request, characteristicId: char.characteristicId }}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: 40,
            textAlign: 'center',
            color: 'var(--shell-fg-3)',
            fontSize: 13,
            border: '1px dashed var(--shell-line)',
            borderRadius: 6,
          }}
        >
          No monitored characteristics found for this scope.
        </div>
      )}
    </div>
  )
}
