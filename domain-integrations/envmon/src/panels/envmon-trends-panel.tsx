import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { EnvMonTrend } from '@connectio/data-contracts'
import { useEnvMonTrends } from '../adapters/envmon-queries.js'
import type { EnvMonAdapterRequest } from '../adapters/envmon-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'envmon-trends',
  displayName: 'Environmental Trends',
  description: 'Daily trend of environmental monitoring — positive rate, open alerts, and compliance rate over the monitoring period.',
  ownerDomain: 'envmon',
  sourceOwnership: { domainId: 'envmon', systemName: 'lims', legacyAppId: 'lims' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['envmon-monitoring'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 600, errorAfterSeconds: 1800, refreshOnFocus: false, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.9, hidden: false },
  requiredPermissions: [{ permissionId: 'envmon.monitoring.read', displayName: 'Environmental Monitoring Read' }],
}

export interface EnvMonTrendsPanelProps {
  readonly request: EnvMonAdapterRequest
}

function formatShortDate(date: string): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function complianceColor(rate: number): string {
  if (rate >= 95) return '#2E7D32'
  if (rate >= 85) return '#D97706'
  return '#D32F2F'
}

export function EnvMonTrendsPanel({ request }: EnvMonTrendsPanelProps) {
  const { data: result, isLoading } = useEnvMonTrends(request)
  const lastRefreshedAt = result?.ok ? result.fetchedAt : null
  const { displayState, markReady, markError } = useEvidencePanel({
    panelId: registration.panelId,
    staleAfterSeconds: registration.freshnessPolicy.staleAfterSeconds,
    lastRefreshedAt,
  })

  useEffect(() => {
    if (isLoading) return
    if (result?.ok) markReady()
    else if (result && !result.ok) markError()
  }, [isLoading, result, markReady, markError])

  const trends: EnvMonTrend[] | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
    >
      {trends && (
        <div style={{ padding: '8px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr 1fr', gap: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--shell-fg-3)', padding: '4px 16px 8px' }}>
            <span>Date</span>
            <span style={{ textAlign: 'right' }}>Samples</span>
            <span style={{ textAlign: 'right' }}>Positives</span>
            <span style={{ textAlign: 'right' }}>Pos. Rate</span>
            <span style={{ textAlign: 'right' }}>Compliance</span>
          </div>
          {trends.map((row) => (
            <div key={row.date} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr 1fr', gap: 0, padding: '6px 16px', borderBottom: '1px solid var(--shell-line)', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>{formatShortDate(row.date)}</span>
              <span style={{ fontSize: 12, textAlign: 'right', color: 'var(--shell-fg)' }}>{row.samplesCollected}</span>
              <span style={{ fontSize: 12, textAlign: 'right', color: row.positiveCount > 0 ? '#D32F2F' : 'var(--shell-fg)' }}>
                {row.positiveCount}
              </span>
              <span style={{ fontSize: 12, textAlign: 'right', color: row.positiveRate > 5 ? '#D32F2F' : 'var(--shell-fg)' }}>
                {Number(row.positiveRate.toFixed(1))}%
              </span>
              <span style={{ fontSize: 12, textAlign: 'right', fontWeight: 600, color: complianceColor(row.complianceRate) }}>
                {Number(row.complianceRate.toFixed(1))}%
              </span>
            </div>
          ))}
        </div>
      )}
    </EvidencePanel>
  )
}
