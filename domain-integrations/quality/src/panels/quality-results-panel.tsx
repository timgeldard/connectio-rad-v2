import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { QualityResultsSummary } from '@connectio/data-contracts'
import { useQualityResults } from '../adapters/quality-release-queries.js'
import type { QualityReleaseAdapterRequest } from '../adapters/quality-release-adapter.js'

/** Static registration record for the Quality Results panel. */
const registration: EvidencePanelRegistration = {
  panelId: 'quality-results-summary',
  displayName: 'Quality Results',
  description: 'MIC, chemical, sensory, and physical test results for the batch inspection lot.',
  ownerDomain: 'quality',
  sourceOwnership: { domainId: 'quality', systemName: 'sap-qm', legacyAppId: 'connectedquality' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['quality-batch-release'],
  requiredContext: [{ contextKey: 'batchId', scopeLevel: 'batch', required: true }],
  freshnessPolicy: { staleAfterSeconds: 180, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.99, hidden: false },
  requiredPermissions: [{ permissionId: 'quality.read', displayName: 'Quality Read' }],
}

/** Props for QualityResultsPanel. */
export interface QualityResultsPanelProps {
  /** Adapter request context providing releaseCaseId and batchId. */
  readonly request: QualityReleaseAdapterRequest
}

/**
 * Evidence panel displaying quality test results (MIC, chemical, sensory, physical).
 *
 * @remarks
 * Shows status per test category with MIC failure details when present.
 */
export function QualityResultsPanel({ request }: QualityResultsPanelProps) {
  const { data: result, isLoading } = useQualityResults(request)
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

  const data: QualityResultsSummary | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
    >
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <TestStatusBadge label="Overall" status={data.overallStatus} />
            <TestResult label="MIC" status={data.micStatus} />
            <TestResult label="Chemical" status={data.chemicalStatus} />
            <TestResult label="Sensory" status={data.sensoryStatus} />
            <TestResult label="Physical" status={data.physicalStatus} />
            {data.openRetestCount > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#FF9800' }}>
                {data.openRetestCount} re-test open
              </span>
            )}
          </div>

          {data.inspectionLotId && (
            <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 8, fontSize: 12, color: 'var(--shell-fg-3)' }}>
              Inspection Lot: <span style={{ color: 'var(--shell-fg)', fontWeight: 500 }}>{data.inspectionLotId}</span>
              {data.inspectionCompletedAt && (
                <span style={{ marginLeft: 12 }}>
                  Completed: <span style={{ color: 'var(--shell-fg)' }}>{new Date(data.inspectionCompletedAt).toLocaleDateString()}</span>
                </span>
              )}
              {data.inspectionCompletedBy && (
                <span style={{ marginLeft: 12 }}>
                  By: <span style={{ color: 'var(--shell-fg)' }}>{data.inspectionCompletedBy}</span>
                </span>
              )}
            </div>
          )}

          {data.micFailures.length > 0 && (
            <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#D32F2F', marginBottom: 6 }}>
                MIC Failures ({data.micFailures.length})
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {data.micFailures.map((failure, i) => (
                  <div key={i} style={{ fontSize: 12, padding: '6px 8px', background: 'rgba(211,47,47,0.06)', borderRadius: 4, borderLeft: '3px solid #D32F2F' }}>
                    <div style={{ fontWeight: 600, color: 'var(--shell-fg)' }}>{failure.organism}</div>
                    <div style={{ color: 'var(--shell-fg-2)', marginTop: 2 }}>
                      Result: <strong style={{ color: '#D32F2F' }}>{failure.result} {failure.unit}</strong>
                      {' / Limit: '}{failure.limit} {failure.unit}
                      {' / Exceeded by: '}<strong>{failure.exceededBy} {failure.unit}</strong>
                    </div>
                    <div style={{ color: 'var(--shell-fg-3)', fontSize: 11, marginTop: 2 }}>
                      {failure.testMethod} · {new Date(failure.testedAt).toLocaleDateString()}
                      {failure.testedBy && ` · ${failure.testedBy}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </EvidencePanel>
  )
}

const STATUS_COLOUR: Record<string, string> = {
  pass: '#4CAF50',
  fail: '#D32F2F',
  pending: '#FF9800',
  conditional: '#FF9800',
  'not-required': '#9E9E9E',
  'not-applicable': '#9E9E9E',
}

function TestResult({ label, status }: { label: string; status: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: STATUS_COLOUR[status] ?? 'var(--shell-fg)', textTransform: 'capitalize' }}>
        {status === 'not-required' ? 'N/R' : status.charAt(0).toUpperCase()}
      </div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--shell-fg-3)' }}>
        {label}
      </div>
    </div>
  )
}

function TestStatusBadge({ label, status }: { label: string; status: string }) {
  const colour = STATUS_COLOUR[status] ?? 'var(--shell-fg)'
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: colour, textTransform: 'capitalize' }}>
        {status.replace(/-/g, ' ')}
      </div>
    </div>
  )
}
