import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { QualityEvidenceResponse } from '@connectio/data-contracts'
import { useQualityReadOnlyEvidence } from '../adapters/quality-readonly-evidence-queries.js'
import type { QualityReadOnlyEvidenceAdapterRequest } from '../adapters/quality-readonly-evidence-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'quality-readonly-evidence',
  displayName: 'Read-Only Quality Evidence',
  description: 'Inspection lot, MIC result, usage-decision, and CoA-like evidence readiness for future native Quality UAT.',
  ownerDomain: 'quality',
  sourceOwnership: { domainId: 'quality', systemName: 'sap-qm', legacyAppId: 'connectedquality' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['quality-batch-release'],
  requiredContext: [{ contextKey: 'batchId', scopeLevel: 'batch', required: false }],
  freshnessPolicy: { staleAfterSeconds: 180, errorAfterSeconds: 600, refreshOnFocus: false, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.2, hidden: false },
  requiredPermissions: [{ permissionId: 'quality.read', displayName: 'Quality Read' }],
}

export interface QualityReadOnlyEvidencePanelProps {
  readonly request: QualityReadOnlyEvidenceAdapterRequest
}

function formatStatusLabel(value: string) {
  return value.replace(/-/g, ' ')
}

function statusColor(state: string) {
  return state === 'loaded' || state === 'source-present'
    ? 'var(--shell-good)'
    : 'var(--shell-warn)'
}

export function QualityReadOnlyEvidencePanel({ request }: QualityReadOnlyEvidencePanelProps) {
  const { data: result, isLoading } = useQualityReadOnlyEvidence(request)
  const lastRefreshedAt = result?.ok ? result.fetchedAt : null
  const { displayState, markReady, markError } = useEvidencePanel({
    panelId: registration.panelId,
    staleAfterSeconds: registration.freshnessPolicy.staleAfterSeconds,
    lastRefreshedAt,
  })

  useEffect(() => {
    if (isLoading) return
    if (result?.ok) {
      markReady()
    } else if (result && !result.ok) {
      markError()
    }
  }, [isLoading, result, markReady, markError])

  const data: QualityEvidenceResponse | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 12 }}>
          <div style={{ padding: 10, border: '1px solid #D97706', borderRadius: 6, background: 'rgba(217,119,6,0.08)', color: 'var(--shell-fg)', fontSize: 12, lineHeight: 1.45 }}>
            <strong>Read-only Quality evidence is not yet source-verified in V2.</strong>
            <div style={{ marginTop: 4 }}>
              Missing usage-decision, CoA, or deviation evidence must not be interpreted as accepted, released, or no issue.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
            <Metric label="Inspection lots" value={data.summary.inspectionLotCount} />
            <Metric label="MIC results" value={data.summary.micResultCount} />
            <Metric label="CoA-like rows" value={data.summary.coaResultCount} />
            <Metric label="UD status" value={formatStatusLabel(data.summary.usageDecisionStatus)} />
          </div>

          <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 10, display: 'grid', gap: 8 }}>
            <SectionStatus title="Inspection lot evidence" state={sectionState(data.inspectionLots.length, data.summary.status)} />
            <SectionStatus title="MIC result evidence" state={sectionState(data.micResults.length, data.summary.status)} />
            <SectionStatus title="Usage decision evidence" state={data.usageDecision ? 'source-present' : data.summary.usageDecisionStatus} />
            <SectionStatus title="CoA result evidence" state={sectionState(data.coaResults.length, data.summary.status)} />
          </div>

          {data.summary.unavailableEvidence.length > 0 && (
            <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 10 }}>
              <div style={eyebrowStyle}>Unavailable evidence</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {data.summary.unavailableEvidence.map((item) => (
                  <span key={item} style={chipStyle}>{formatStatusLabel(item)}</span>
                ))}
              </div>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 10 }}>
            <div style={eyebrowStyle}>Source boundaries</div>
            <ul style={{ margin: '6px 0 0 18px', padding: 0, color: 'var(--shell-fg-2)', fontSize: 12, lineHeight: 1.5 }}>
              {data.summary.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
              <li>Specification limits are not SPC control limits.</li>
              <li>MIC result valuation is not a release decision.</li>
            </ul>
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}

function sectionState(rowCount: number, status: string) {
  if (rowCount > 0) return 'loaded'
  return status
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ border: '1px solid var(--shell-line)', borderRadius: 6, padding: 8, minHeight: 52 }}>
      <div style={eyebrowStyle}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 16, fontWeight: 700, color: 'var(--shell-fg)' }}>{value}</div>
    </div>
  )
}

function SectionStatus({ title, state }: { title: string; state: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', fontSize: 12 }}>
      <span style={{ color: 'var(--shell-fg)' }}>{title}</span>
      <span style={{ color: statusColor(state), fontWeight: 700, textTransform: 'capitalize' }}>{formatStatusLabel(state)}</span>
    </div>
  )
}

const eyebrowStyle = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--shell-fg-3)',
} as const

const chipStyle = {
  border: '1px solid var(--shell-line)',
  borderRadius: 999,
  padding: '3px 8px',
  fontSize: 11,
  color: 'var(--shell-fg-2)',
  textTransform: 'capitalize',
} as const
