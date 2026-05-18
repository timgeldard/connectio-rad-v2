import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { SPCSignal } from '@connectio/data-contracts'
import { useActiveSPCSignals } from '../adapters/spc-monitoring-queries.js'
import type { SPCMonitoringAdapterRequest } from '../adapters/spc-monitoring-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'active-spc-signals',
  displayName: 'Active SPC Signals',
  description: 'Active out-of-control and warning signals with rule violated, severity, and recommended action.',
  ownerDomain: 'spc',
  sourceOwnership: { domainId: 'spc', systemName: 'spc', legacyAppId: 'spc' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['spc-monitoring'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 60, errorAfterSeconds: 300, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [{ permissionId: 'spc.read', displayName: 'SPC Read' }],
}

export interface ActiveSPCSignalsPanelProps {
  readonly request: SPCMonitoringAdapterRequest
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#D32F2F',
  high: 'var(--sunset, #F24A00)',
  medium: '#D97706',
  low: '#388E3C',
}

export function ActiveSPCSignalsPanel({ request }: ActiveSPCSignalsPanelProps) {
  const { data: result, isLoading } = useActiveSPCSignals(request)
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

  const signals: SPCSignal[] = result?.ok ? result.data : []

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
    >
      {result?.ok && (
        <div style={{ padding: '12px 16px' }}>
          {signals.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--shell-fg-3)', margin: 0 }}>No active signals — all characteristics in control.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {signals.map(signal => (
                <div
                  key={signal.signalId}
                  style={{
                    padding: '8px 10px',
                    background: 'var(--shell-surface-2)',
                    borderRadius: 4,
                    borderLeft: `3px solid ${SEVERITY_COLOR[signal.severity] ?? 'var(--shell-line)'}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)' }}>{signal.characteristicName}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: SEVERITY_COLOR[signal.severity], textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {signal.severity}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--shell-fg-2)', marginBottom: 2 }}>
                    {signal.ruleCode && (
                      <span style={{ fontWeight: 700, marginRight: 6, color: 'var(--sunset, #F24A00)' }}>
                        [{signal.ruleCode}]
                      </span>
                    )}
                    {signal.rule}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>
                    Value: <strong style={{ color: 'var(--shell-fg)' }}>{signal.resultValue}</strong>
                    {' · '}Chart: {signal.chartType.toUpperCase()}
                    {' · '}Batch: {signal.batchId}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', marginTop: 2 }}>
                    Detected: {new Date(signal.detectedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {' · '}Plant: {signal.plantId}
                  </div>
                  {signal.recommendedAction && (
                    <div style={{ fontSize: 11, color: 'var(--shell-fg-2)', marginTop: 4, fontStyle: 'italic' }}>{signal.recommendedAction}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </EvidencePanel>
  )
}
