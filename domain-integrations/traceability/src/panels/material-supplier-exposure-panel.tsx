import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { SupplierExposureSummary } from '@connectio/data-contracts'
import { useSupplierExposureSummary } from '../adapters/trace2-queries.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

/** Static registration record for the Material / Supplier Exposure panel. */
const registration: EvidencePanelRegistration = {
  panelId: 'material-supplier-exposure',
  displayName: 'Supplier Exposure',
  description: 'Upstream supplier lots, materials, and open supplier quality actions.',
  ownerDomain: 'traceability',
  sourceOwnership: { domainId: 'traceability', systemName: 'trace2', legacyAppId: 'trace2' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['trace-investigation'],
  requiredContext: [{ contextKey: 'batchId', scopeLevel: 'batch', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.90, hidden: false },
  requiredPermissions: [{ permissionId: 'trace.read', displayName: 'Trace Read' }],
}

/** Props for MaterialSupplierExposurePanel. */
export interface MaterialSupplierExposurePanelProps {
  /** Adapter request context providing investigationId and batchId. */
  readonly request: Trace2AdapterRequest
}

/**
 * Evidence panel showing upstream supplier and material exposure summary.
 *
 * @remarks
 * Data is sourced from the Trace2 adapter. `openSupplierActions > 0` is
 * highlighted in amber to draw attention to outstanding supplier quality tasks.
 */
export function MaterialSupplierExposurePanel({ request }: MaterialSupplierExposurePanelProps) {
  const { data: result, isLoading } = useSupplierExposureSummary(request)
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

  const data: SupplierExposureSummary | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
    >
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <SupplierStat label="Suppliers" value={data.supplierCount} />
            <SupplierStat label="Supplier Lots" value={data.supplierLots} />
            <SupplierStat label="Upstream Materials" value={data.upstreamMaterials} />
          </div>
          {data.highestRiskSupplier && (
            <div style={{ padding: '8px 10px', background: 'var(--shell-surface)', border: '1px solid var(--shell-line)', borderRadius: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)' }}>
                Highest Risk Supplier
              </span>
              <div style={{ fontSize: 13, color: 'var(--shell-fg)', fontWeight: 500, marginTop: 2 }}>
                {data.highestRiskSupplier}
              </div>
            </div>
          )}
          {data.openSupplierActions > 0 && (
            <div
              style={{
                padding: '8px 10px',
                background: '#FFF7E6',
                border: '1px solid #D97706',
                borderRadius: 4,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
              role="status"
              aria-label={`${data.openSupplierActions} open supplier action(s) require attention`}
            >
              <span style={{ fontSize: 12, color: '#92400E', fontWeight: 600 }}>
                Open Supplier Actions
              </span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#D97706' }}>
                {data.openSupplierActions}
              </span>
            </div>
          )}
        </div>
      )}
    </EvidencePanel>
  )
}

/** Small numeric stat within the supplier exposure summary. */
function SupplierStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--shell-surface)', borderRadius: 4, border: '1px solid var(--shell-line)' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--shell-fg)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
    </div>
  )
}
