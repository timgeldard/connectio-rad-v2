import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { RecallReadiness } from '@connectio/data-contracts'
import { useRecallReadiness } from './trace-app-queries.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'recall-readiness',
  displayName: 'Recall & Exposure',
  description:
    'Cross-plant customer exposure with delivery-level detail, geographic spread, and recall recommendation. Plant context is intentionally ignored.',
  ownerDomain: 'traceability',
  sourceOwnership: { domainId: 'traceability', systemName: 'trace2', legacyAppId: 'trace2' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['trace'],
  requiredContext: [{ contextKey: 'batchId', scopeLevel: 'batch', required: true }],
  freshnessPolicy: {
    staleAfterSeconds: 300,
    errorAfterSeconds: 900,
    refreshOnFocus: true,
    pollIntervalSeconds: null,
  },
  confidencePolicy: { level: 0.95, hidden: false },
  requiredPermissions: [{ permissionId: 'trace.read', displayName: 'Trace Read' }],
}

export interface RecallPanelProps {
  readonly request: Trace2AdapterRequest
}

const STATUS_TONES = {
  delivered: { bg: 'var(--jade, #44CF93)20', fg: '#1a8454' },
  'in-transit': { bg: 'var(--valentia-slate, #005776)20', fg: 'var(--valentia-slate, #005776)' },
  recalled: { bg: 'var(--sunset, #F24A00)20', fg: 'var(--sunset, #F24A00)' },
  blocked: { bg: 'var(--sunrise, #F9C20A)20', fg: '#8a6b00' },
} as const

export function RecallPanel({ request }: RecallPanelProps) {
  const { data: result, isLoading } = useRecallReadiness(request)
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

  const data: RecallReadiness | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: 20 }}>
          {data.recallRecommended && (
            <div
              role="alert"
              style={{
                marginBottom: 16,
                padding: 12,
                background: 'var(--sunset, #F24A00)15',
                border: '1px solid var(--sunset, #F24A00)',
                borderRadius: 8,
                color: 'var(--sunset, #F24A00)',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              ⚠ Recall recommended for this batch — escalate to the Quality team.
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 0,
              marginBottom: 18,
              border: '1px solid var(--shell-line, #E5E3D7)',
              borderRadius: 8,
              overflow: 'hidden',
              background: 'var(--shell-surface-2, #F8F7F0)',
            }}
          >
            <Kpi label="Customers" value={data.totals.customers} />
            <Kpi label="Countries" value={data.totals.countries} />
            <Kpi label="Deliveries" value={data.totals.deliveries} />
            <Kpi label="Shipped" value={data.totals.shipped.toLocaleString()} sub={data.totals.uom} />
          </div>

          <SectionTitle label="Geographic spread" extra={`${data.countries.length} countries`} />
          <div
            style={{
              padding: 14,
              background: 'var(--shell-surface-2, #F8F7F0)',
              border: '1px solid var(--shell-line, #E5E3D7)',
              borderRadius: 8,
              marginBottom: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {data.countries.map((c) => (
              <div key={c.code}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--forest, #143700)' }}>
                    {c.code} · {c.name}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {c.qty.toLocaleString()}{' '}
                    <span style={{ color: 'var(--shell-fg-2)' }}>· {(c.pct * 100).toFixed(0)}%</span>
                  </span>
                </div>
                <div style={{ height: 6, background: 'white', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--shell-line, #E5E3D7)' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${c.pct * 100}%`,
                      background: 'var(--valentia-slate, #005776)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <SectionTitle label="Deliveries" extra={`${data.deliveries.length} of ${data.totals.deliveries}`} />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: 'var(--shell-surface-2, #F8F7F0)' }}>
                  {['Delivery', 'Customer', 'Country', 'Date', 'Qty', 'Status', 'Doc'].map((h) => (
                    <Th key={h} align={h === 'Qty' ? 'right' : 'left'}>
                      {h}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.deliveries.map((d) => {
                  const tone = STATUS_TONES[d.status]
                  return (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--shell-line, #E5E3D7)' }}>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: 'var(--valentia-slate, #005776)', fontWeight: 600 }}>{d.id}</td>
                      <td style={{ padding: '9px 12px' }}>{d.customer}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{d.country}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: 'var(--shell-fg-2)' }}>{d.date}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {d.qty.toLocaleString()}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            padding: '2px 8px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: 'capitalize',
                            background: tone.bg,
                            color: tone.fg,
                          }}
                        >
                          {d.status.replace('-', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: 'var(--shell-fg-2)' }}>{d.doc}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}

function Kpi({
  label,
  value,
  sub,
}: {
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <div style={{ padding: 14, borderRight: '1px solid var(--shell-line, #E5E3D7)' }}>
      <div style={{ fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 700, color: 'var(--shell-fg-2)', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--forest, #143700)', lineHeight: 1 }}>
        {value}
        {sub && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-2)', marginLeft: 4 }}>{sub}</span>}
      </div>
    </div>
  )
}

function SectionTitle({ label, extra }: { label: string; extra?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        paddingBottom: 8,
        marginBottom: 12,
        borderBottom: '1px solid var(--shell-line, #E5E3D7)',
      }}
    >
      <span style={{ fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 700, color: 'var(--valentia-slate, #005776)' }}>
        {label}
      </span>
      {extra && (
        <span style={{ fontSize: 11, color: 'var(--shell-fg-2)', fontFamily: 'monospace', marginLeft: 'auto' }}>
          {extra}
        </span>
      )}
    </div>
  )
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      style={{
        textAlign: align,
        padding: '8px 12px',
        fontSize: 10.5,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: 'var(--shell-fg-2)',
        fontWeight: 600,
      }}
    >
      {children}
    </th>
  )
}
