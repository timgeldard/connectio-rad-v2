import {
  VerificationStatusBanner,
  SourceConfidenceStrip,
  type ExtendedSourceMode,
  type EvidenceStatus,
} from '@connectio/design-system'
import type { CSSProperties } from 'react'
import { SPCSummaryPanel } from '../panels/spc-summary-panel.js'
import { ActiveSPCSignalsPanel } from '../panels/active-spc-signals-panel.js'
import { ControlChartPanel } from '../panels/control-chart-panel.js'
import { SPCEvidenceSummaryPanel } from '../panels/spc-evidence-summary-panel.js'
import { useMonitoredCharacteristics, useSPCSummary, useActiveSPCSignals } from '../adapters/spc-monitoring-queries.js'
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

function resolveEvidenceStatus(result: any): EvidenceStatus {
  if (!result) return 'pending-validation'
  if (!result.ok) {
    if (result.error?.code === '403') return 'permission-denied'
    if (result.error?.code === '504') return 'timed-out'
    return 'error'
  }
  
  if (result.source === 'mock') return 'mock-only'
  return 'loaded'
}

export function ChartOverviewView({ request }: ChartOverviewViewProps) {
  const { data: charsResult } = useMonitoredCharacteristics(request)
  const { data: summaryResult } = useSPCSummary(request)
  const { data: signalsResult } = useActiveSPCSignals(request)
  
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

      <SourceConfidenceStrip
        mode={(summaryResult?.source as ExtendedSourceMode) || 'mock'}
        status={summaryResult?.ok ? 'loaded' : 'partial'}
        fetchedAt={summaryResult?.fetchedAt}
        style={{ marginBottom: '16px' }}
      />

      <SPCEvidenceSummaryPanel 
        sections={[
          { 
            id: 'summary', 
            name: 'SPC Summary Overview', 
            status: resolveEvidenceStatus(summaryResult), 
            source: summaryResult?.source,
            count: summaryResult?.ok ? summaryResult.data.chartsMonitored : undefined,
            message: 'High-level aggregation of monitored characteristics.'
          },
          { 
            id: 'signals', 
            name: 'Active SPC Signals', 
            status: resolveEvidenceStatus(signalsResult), 
            source: signalsResult?.source,
            count: signalsResult?.ok ? signalsResult.data.length : undefined,
            message: 'Nelson and Western Electric rule violations.'
          },
          { 
            id: 'chars', 
            name: 'Monitored Characteristics', 
            status: resolveEvidenceStatus(charsResult), 
            source: charsResult?.source,
            count: characteristics.length,
            message: 'MIC-level characteristic registrations.'
          },
          { 
            id: 'charts', 
            name: 'Control Charts', 
            status: resolveEvidenceStatus(charsResult), 
            source: charsResult?.source,
            message: 'Time-series control charts with statistical limits.'
          }
        ]}
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
        background: 'linear-gradient(135deg, rgba(199, 130, 28, 0.1) 0%, rgba(199, 130, 28, 0.05) 100%)',
        border: '1px solid var(--shell-warn-border, rgba(199, 130, 28, 0.3))',
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
          background: 'rgba(199, 130, 28, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--shell-warn, #C7821C)',
          fontSize: '14px',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        !
      </div>
      <div>
        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--shell-warn, #C7821C)' }}>
          SPC Sandbox Mode — Simulated Data
        </h4>
        <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--shell-fg-2)', lineHeight: 1.4 }}>
          SPC sandbox mode — values are for workflow validation and are not production control evidence. Control limits and signals shown here must be validated against approved SPC rules before operational use. Native Databricks integration is pending catalog alignment of the <code style={{ background: 'var(--shell-surface-2)', padding: '1px 4px', borderRadius: '3px' }}>spc_quality_metrics</code> schema in UAT.
        </p>
      </div>
    </div>
  )
}
