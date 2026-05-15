import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { CharacteristicCapability } from '@connectio/data-contracts'
import { useCharacteristicCapability } from '../adapters/spc-monitoring-queries.js'
import type { SPCMonitoringAdapterRequest } from '../adapters/spc-monitoring-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'characteristic-capability',
  displayName: 'Characteristic Capability',
  description: 'Cp, Cpk, Pp, Ppk indices with mean, standard deviation, and capability interpretation.',
  ownerDomain: 'spc',
  sourceOwnership: { domainId: 'spc', systemName: 'spc', legacyAppId: 'spc' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['spc-monitoring'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: false, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [{ permissionId: 'spc.read', displayName: 'SPC Read' }],
}

export interface CharacteristicCapabilityPanelProps {
  readonly request: SPCMonitoringAdapterRequest
}

const INTERPRETATION_COLOR: Record<string, string> = {
  capable: '#388E3C',
  marginal: '#D97706',
  'not-capable': '#D32F2F',
  'insufficient-data': 'var(--shell-fg-3)',
}

export function CharacteristicCapabilityPanel({ request }: CharacteristicCapabilityPanelProps) {
  const { data: result, isLoading } = useCharacteristicCapability(request)
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

  const data: CharacteristicCapability | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
    >
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)' }}>{data.characteristicName}</span>
            <span style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
              color: INTERPRETATION_COLOR[data.interpretation] ?? 'var(--shell-fg)',
              padding: '2px 6px', border: `1px solid ${INTERPRETATION_COLOR[data.interpretation] ?? 'var(--shell-line)'}`, borderRadius: 3,
            }}>
              {data.interpretation.replace(/-/g, ' ')}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <CapabilityIndex label="Cp" value={data.cp} threshold={1.33} />
            <CapabilityIndex label="Cpk" value={data.cpk} threshold={1.33} />
            <CapabilityIndex label="Pp" value={data.pp} threshold={1.33} />
            <CapabilityIndex label="Ppk" value={data.ppk} threshold={1.33} />
          </div>

          <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <StatRow label="Mean" value={data.mean.toFixed(3)} />
            <StatRow label="Std Dev" value={data.standardDeviation.toFixed(4)} />
            <StatRow label="n" value={String(data.sampleCount)} />
            <StatRow label="Confidence" value={`${Math.round(data.confidence * 100)}%`} />
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}

function CapabilityIndex({ label, value, threshold }: { label: string; value: number; threshold: number }) {
  const color = value >= threshold ? '#388E3C' : value >= 1.0 ? '#D97706' : '#D32F2F'
  return (
    <div style={{ background: 'var(--shell-surface-2)', borderRadius: 4, padding: '6px 10px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value.toFixed(2)}</div>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--shell-fg)' }}>{value}</div>
    </div>
  )
}
