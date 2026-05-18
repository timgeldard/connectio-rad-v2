import { VerificationStatusBanner } from '@connectio/design-system'
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
      <SPCSandboxBanner />
      
      <VerificationStatusBanner
        title="Statistical Process Control (SPC) Quality Metrics"
        status="mock-demo"
        sourceLabel="In-Memory Mock Simulation"
        routes={[
          'GET /api/spc/summary',
          'GET /api/spc/active-signals',
          'GET /api/spc/monitored-characteristics',
          'GET /api/spc/control-chart'
        ]}
        sourceObjects={[
          'spc_quality_metrics_v'
        ]}
        limitations={[
          'Demo-Only sandbox environment',
          'Not linked to live production data',
          'Native Databricks integration pending catalog alignment'
        ]}
        lastVerified="Pending UAT Catalog Alignment"
      />

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

export function SPCSandboxBanner() {
  return (
    <div
      style={{
        padding: '12px 16px',
        background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)',
        border: '1px solid rgba(217, 119, 6, 0.3)',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: 'var(--shell-fg)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      role="status"
    >
      <div
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: 'rgba(217, 119, 6, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#D97706',
          fontSize: '14px',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        !
      </div>
      <div>
        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#D97706' }}>
          Demo Data — Not Linked to Production
        </h4>
        <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--shell-fg-2)', lineHeight: 1.4 }}>
          Source: <code style={{ background: 'var(--shell-surface-2)', padding: '1px 4px', borderRadius: '3px' }}>mock</code> (In-memory Simulation). Native Databricks integration is pending catalog alignment of the <code style={{ background: 'var(--shell-surface-2)', padding: '1px 4px', borderRadius: '3px' }}>spc_quality_metrics</code> schema in UAT.
        </p>
      </div>
    </div>
  )
}
