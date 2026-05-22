import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type {
  BatchQualityPassport,
  PassportProduction,
  PassportUsageDecisionEvidence,
  PassportStock,
  QualityCharacteristic,
} from '@connectio/data-contracts'
import { useBatchQualityPassport } from './trace-app-queries.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'quality-passport',
  displayName: 'Batch Quality Passport',
  description:
    'Consolidated identity, CoA results, stock, production context, lot history, mass-balance variance, and sign-off for the active batch.',
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
  confidencePolicy: { level: 0.99, hidden: false },
  drillThrough: {
    label: 'Open in Trace Investigation',
    targetWorkspaceId: 'trace-investigation',
    targetViewId: 'overview',
    contextScopes: ['batch'],
  },
  requiredPermissions: [{ permissionId: 'trace.read', displayName: 'Trace Read' }],
}

export type PassportAudienceMode = 'internal' | 'external'

export interface QualityPassportPanelProps {
  readonly request: Trace2AdapterRequest
  readonly audienceMode?: PassportAudienceMode
  /** Optional callback when the user clicks "Open Mass Balance →". */
  readonly onNavigateTab?: (tabId: 'mass-balance') => void
}

export function QualityPassportPanel({
  request,
  audienceMode = 'internal',
  onNavigateTab,
}: QualityPassportPanelProps) {
  const { data: result, isLoading } = useBatchQualityPassport(request)
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

  const data: BatchQualityPassport | null = result?.ok ? result.data : null
  const isExternal = audienceMode === 'external'

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: 20 }}>
          <HeroBand data={data} />
          <Section num="01" label="Identity & production order">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              <KV label="Material" value={data.identity.materialDescription} />
              <KV label="Batch" value={data.identity.batchId} mono />
              <KV
                label="Plant"
                value={isExternal ? 'EU-IE-01' : `${data.identity.plantName} · ${data.identity.plantId}`}
              />
              <KV
                label="Process order"
                value={isExternal ? '[masked]' : data.identity.processOrderId}
                mono={!isExternal}
              />
              <KV
                label="Manufacture"
                value={new Date(data.identity.manufactureDate).toLocaleDateString()}
                mono
              />
              <KV
                label="Expiry"
                value={`${new Date(data.identity.expiryDate).toLocaleDateString()} · ${data.identity.daysToExpiry}d`}
                mono
              />
              <KV label="UoM" value={data.identity.uom} mono />
              <KV label="Audience" value={isExternal ? 'Customer-safe' : 'Internal'} />
            </div>
          </Section>

          <Section num="02" label="Certificate of analysis" extra={`${data.quality.coa.length} characteristics`}>
            <CoATable rows={data.quality.coa} />
          </Section>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, marginBottom: 22 }}>
            <div>
              <SectionTitle num="03" label="Stock by category" />
              <StockBreakdown stock={data.stock} />
            </div>
            <div>
              <SectionTitle num="04" label="Production context" />
              <ProductionContext production={data.production} isExternal={isExternal} />
            </div>
          </div>

          <Section num="05" label="Lot history" extra="Last 4 lots">
            <LotHistoryTable rows={data.lotHistory} isExternal={isExternal} />
          </Section>

          {!isExternal && (
            <Section num="06" label="Mass balance variance" extra="Internal only">
              <MassBalanceBanner
                variance={data.massBalance.variance}
                uom={data.stock.uom}
                note={data.massBalance.note}
                onOpenDetail={onNavigateTab ? () => onNavigateTab('mass-balance') : undefined}
              />
            </Section>
          )}

          <Section
            num={isExternal ? '06' : '07'}
            label="Usage-decision evidence"
            extra="Not governed sign-off"
          >
            <UsageDecisionEvidenceList rows={data.usageDecisionEvidence} isExternal={isExternal} />
          </Section>
        </div>
      )}
    </EvidencePanel>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HeroBand({ data }: { data: BatchQualityPassport }) {
  const confidence = data.quality.heuristicQualityConfidence
  const confColor =
    confidence >= 90 ? '#1a8454' : confidence >= 75 ? '#8a6b00' : '#c63b00'
  const failedMics = data.quality.coa.filter((c) => c.status === 'fail').length
  const warnMics = data.quality.coa.filter((c) => c.status === 'warn').length
  const acceptLots = data.lotHistory.filter((l) => l.result === 'accept').length
  const rejectLots = data.lotHistory.filter((l) => l.result === 'reject').length

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.6fr 1fr 1fr 1fr',
        marginBottom: 22,
        border: '1px solid var(--shell-line, #E5E3D7)',
        borderRadius: 8,
        overflow: 'hidden',
        background: 'var(--shell-surface-2, #F8F7F0)',
      }}
    >
      <div style={{ padding: 16, borderRight: '1px solid var(--shell-line, #E5E3D7)' }}>
        <div style={{ fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 700, color: 'var(--shell-fg-2)', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span>Quality confidence</span>
          <span
            title="This score is application-derived from MIC pass/fail and warning counts. It is not a governed SAP/QM field."
            style={{
              fontSize: 9,
              padding: '1px 5px',
              borderRadius: 4,
              background: 'var(--sunrise, #F9C20A)20',
              color: '#8a6b00',
              fontWeight: 700,
              letterSpacing: 0.4,
            }}
          >
            HEURISTIC
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: confColor, lineHeight: 1 }}>
            {confidence}
            <span style={{ fontSize: 14, color: 'var(--shell-fg-2)', fontWeight: 600 }}>/100</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--shell-fg-2)' }}>
            {data.quality.notes.map((n) => (
              <div key={n}>· {n}</div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 10, color: 'var(--shell-fg-2)', marginTop: 6, fontStyle: 'italic' }}>
          Source: {data.quality.confidenceSource === 'application-heuristic' ? 'application-heuristic — not governed' : 'governed'}
        </div>
      </div>
      <KpiTile label="Lots produced" value={data.lotHistory.length} sub="over 4 days" />
      <KpiTile
        label="Results · accepted"
        value={acceptLots}
        sub={`${rejectLots} rejected`}
        tone="good"
      />
      <KpiTile
        label="Failed MICs"
        value={failedMics}
        sub={`${warnMics} near limit`}
        tone={failedMics > 0 ? 'bad' : warnMics > 0 ? 'warn' : 'good'}
      />
    </div>
  )
}

function KpiTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string | number
  sub?: string
  tone?: 'good' | 'warn' | 'bad'
}) {
  const color =
    tone === 'good' ? '#1a8454' : tone === 'warn' ? '#8a6b00' : tone === 'bad' ? '#c63b00' : 'var(--forest, #143700)'
  return (
    <div style={{ padding: 16, borderRight: '1px solid var(--shell-line, #E5E3D7)' }}>
      <div style={{ fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 700, color: 'var(--shell-fg-2)' }}>
        {label}
      </div>
      <div style={{ marginTop: 4, fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--shell-fg-2)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function Section({
  num,
  label,
  extra,
  children,
}: {
  num: string
  label: string
  extra?: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      <SectionTitle num={num} label={label} extra={extra} />
      {children}
    </div>
  )
}

function SectionTitle({ num, label, extra }: { num?: string; label: string; extra?: string }) {
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
      {num && (
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--valentia-slate, #005776)', fontWeight: 700 }}>
          {num}
        </span>
      )}
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

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--shell-fg-2)', fontWeight: 600, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--forest, #143700)', fontFamily: mono ? 'monospace' : 'inherit' }}>
        {value}
      </div>
    </div>
  )
}

function CoATable({ rows }: { rows: readonly QualityCharacteristic[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: 'var(--shell-surface-2, #F8F7F0)' }}>
            <Th>Characteristic</Th>
            <Th>Spec</Th>
            <Th style={{ minWidth: 240 }}>Result</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => (
            <tr key={`${c.mic}-${i}`} style={{ borderBottom: '1px solid var(--shell-line, #E5E3D7)' }}>
              <td style={{ padding: '11px 12px', verticalAlign: 'top' }}>
                <div style={{ fontWeight: 500 }}>{c.param}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 10.5, color: 'var(--shell-fg-2)', marginTop: 2 }}>
                  {c.mic} · target {c.target}
                  {c.uom}
                </div>
              </td>
              <td style={{ padding: '11px 12px', fontFamily: 'monospace', color: 'var(--shell-fg-2)', fontSize: 11.5, verticalAlign: 'top' }}>
                {c.binary ? `${c.binary} ${c.uom}` : `${c.low} – ${c.high} ${c.uom}`}
              </td>
              <td style={{ padding: '11px 12px', verticalAlign: 'middle' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    style={{
                      minWidth: 70,
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      color: c.status === 'fail' ? '#c63b00' : c.status === 'warn' ? '#8a6b00' : 'var(--forest, #143700)',
                    }}
                  >
                    {c.binary || c.actual}
                    <span style={{ color: 'var(--shell-fg-2)', fontWeight: 400, fontSize: 11, marginLeft: 2 }}>
                      {c.uom}
                    </span>
                  </span>
                  {!c.binary && (
                    <div style={{ flex: 1 }}>
                      <SpecBar low={c.low} high={c.high} target={c.target} actual={c.actual} status={c.status} />
                    </div>
                  )}
                </div>
              </td>
              <td style={{ padding: '11px 12px', verticalAlign: 'top' }}>
                <StatusPill
                  status={c.status}
                  label={c.status === 'ok' ? 'In spec' : c.status === 'warn' ? 'Near limit' : 'Out of spec'}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SpecBar({
  low,
  high,
  target,
  actual,
  status,
}: {
  low: number
  high: number
  target: number
  actual: number
  status: 'ok' | 'warn' | 'fail'
}) {
  const span = high - low || 1
  const pad = span * 0.18
  const min = low - pad
  const max = high + pad
  const range = max - min
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - min) / range) * 100))

  const tolLeft = pct(low)
  const tolWidth = pct(high) - pct(low)
  const tgtLeft = pct(target)
  const actLeft = pct(actual)

  const actColor = status === 'fail' ? 'var(--sunset, #F24A00)' : status === 'warn' ? 'var(--sunrise, #F9C20A)' : 'var(--forest, #143700)'

  return (
    <div style={{ position: 'relative', height: 14, width: '100%' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 5, height: 4, background: 'var(--shell-surface-2, #F8F7F0)', borderRadius: 2, border: '1px solid var(--shell-line, #E5E3D7)' }} />
      <div
        style={{
          position: 'absolute',
          top: 4,
          height: 6,
          left: `${tolLeft}%`,
          width: `${tolWidth}%`,
          background: 'color-mix(in srgb, var(--sage, #289BA2) 28%, white)',
          borderLeft: '1px solid var(--sage, #289BA2)',
          borderRight: '1px solid var(--sage, #289BA2)',
          borderRadius: 2,
        }}
      />
      <div style={{ position: 'absolute', top: 1, bottom: 1, left: `${tgtLeft}%`, width: 2, background: 'var(--forest, #143700)' }} />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          left: `${actLeft}%`,
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: actColor,
          boxShadow: `0 0 0 2px white, 0 0 0 3px ${actColor}`,
        }}
      />
    </div>
  )
}

function StockBreakdown({ stock }: { stock: PassportStock }) {
  const buckets: { key: keyof PassportStock; label: string; color: string }[] = [
    { key: 'unrestricted', label: 'Unrestricted', color: 'var(--jade, #44CF93)' },
    { key: 'qualityInspection', label: 'Quality inspection', color: 'var(--sage, #289BA2)' },
    { key: 'blocked', label: 'Blocked', color: 'var(--sunset, #F24A00)' },
    { key: 'restricted', label: 'Restricted', color: 'var(--sunrise, #F9C20A)' },
    { key: 'transit', label: 'In transit', color: 'var(--valentia-slate, #005776)' },
  ]
  const total = buckets.reduce((s, b) => s + (Number(stock[b.key]) || 0), 0)

  return (
    <div style={{ padding: 16, background: 'var(--shell-surface-2, #F8F7F0)', borderRadius: 8, border: '1px solid var(--shell-line, #E5E3D7)' }}>
      <div style={{ display: 'grid', gap: 12 }}>
        {buckets.map((b) => {
          const val = Number(stock[b.key]) || 0
          const pct = total > 0 ? (val / total) * 100 : 0
          return (
            <div key={b.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--forest, #143700)' }}>{b.label}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {val.toLocaleString()} <span style={{ color: 'var(--shell-fg-2)' }}>· {pct.toFixed(1)}%</span>
                </span>
              </div>
              <div style={{ height: 6, background: 'white', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--shell-line, #E5E3D7)' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: b.color, opacity: val === 0 ? 0.3 : 1 }} />
              </div>
            </div>
          )
        })}
      </div>
      <div
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: '1px dashed var(--shell-line, #E5E3D7)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--shell-fg-2)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>
          Total on hand
        </span>
        <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--forest, #143700)' }}>
          {total.toLocaleString()}
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--shell-fg-2)', marginLeft: 4 }}>{stock.uom}</span>
        </span>
      </div>
    </div>
  )
}

function ProductionContext({ production, isExternal }: { production: PassportProduction; isExternal: boolean }) {
  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: 'Order', value: isExternal ? '[masked]' : production.orderId, mono: !isExternal },
    { label: 'Line', value: isExternal ? '[masked]' : production.line },
    { label: 'Operator', value: isExternal ? '[masked]' : production.operator },
    { label: 'Started', value: new Date(production.startedAt).toLocaleString(), mono: true },
    { label: 'Confirmed', value: new Date(production.confirmedAt).toLocaleString(), mono: true },
    {
      label: 'Planned · Actual',
      value: `${production.plannedQty.toLocaleString()} · ${production.actualQty.toLocaleString()} KG`,
      mono: true,
    },
    { label: 'Yield', value: `${(production.yield * 100).toFixed(1)}%` },
    { label: 'Originating customer', value: production.originatingCustomer },
  ]
  return (
    <div style={{ padding: 16, background: 'var(--shell-surface-2, #F8F7F0)', borderRadius: 8, border: '1px solid var(--shell-line, #E5E3D7)' }}>
      <div style={{ display: 'grid', gap: 8 }}>
        {rows.map((r, i) => (
          <div
            key={r.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              paddingBottom: 6,
              borderBottom: i === rows.length - 1 ? 'none' : '1px dotted var(--shell-line, #E5E3D7)',
            }}
          >
            <span style={{ fontSize: 11.5, color: 'var(--shell-fg-2)' }}>{r.label}</span>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 500,
                textAlign: 'right',
                fontFamily: r.mono ? 'monospace' : 'inherit',
              }}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
      {!isExternal && (
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--shell-fg-2)', fontStyle: 'italic' }}>
          {production.notes}
        </div>
      )}
    </div>
  )
}

function LotHistoryTable({
  rows,
  isExternal,
}: {
  rows: readonly BatchQualityPassport['lotHistory'][number][]
  isExternal: boolean
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: 'var(--shell-surface-2, #F8F7F0)' }}>
            {['Lot', 'Date', 'Inspection', 'Decision', 'MICs', 'Decided by'].map((h) => (
              <Th key={h} align={h === 'MICs' ? 'right' : 'left'}>
                {h}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id} style={{ borderBottom: '1px solid var(--shell-line, #E5E3D7)' }}>
              <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--valentia-slate, #005776)' }}>{l.id}</td>
              <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: 'var(--shell-fg-2)' }}>{l.date}</td>
              <td style={{ padding: '9px 12px' }}>{l.inspection}</td>
              <td style={{ padding: '9px 12px' }}>
                <StatusPill
                  status={l.result === 'reject' ? 'fail' : l.result === 'conditional' ? 'warn' : 'ok'}
                  label={l.result === 'accept' ? 'Released' : l.result === 'conditional' ? 'Conditional' : 'Rejected'}
                />
              </td>
              <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                <span style={{ color: l.failed > 0 ? '#8a6b00' : 'var(--shell-fg-2)', fontWeight: l.failed > 0 ? 600 : 400 }}>
                  {l.failed}
                </span>
                <span style={{ color: 'var(--shell-fg-2)' }}> / {l.mics}</span>
              </td>
              <td style={{ padding: '9px 12px', color: isExternal ? 'var(--shell-fg-2)' : 'inherit' }}>
                {isExternal ? '[masked]' : l.decisionBy}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MassBalanceBanner({
  variance,
  uom,
  note,
  onOpenDetail,
}: {
  variance: number
  uom: string
  note: string
  onOpenDetail?: () => void
}) {
  const reconciled = variance === 0
  const tone = reconciled ? 'var(--jade, #44CF93)' : 'var(--sunrise, #F9C20A)'
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 16,
        alignItems: 'center',
        padding: '14px 18px',
        background: `color-mix(in srgb, ${tone} 8%, white)`,
        border: `1px solid color-mix(in srgb, ${tone} 38%, white)`,
        borderRadius: 8,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'white',
          display: 'grid',
          placeItems: 'center',
          border: `2px solid ${tone}`,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 800, color: reconciled ? '#1a8454' : '#8a6b00' }}>
          {variance > 0 ? '+' : ''}
          {variance}
        </span>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--forest, #143700)', marginBottom: 2 }}>
          Variance {reconciled ? 'reconciled' : `${Math.abs(variance)} ${uom} unexplained`}
        </div>
        <div style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>{note}</div>
      </div>
      {onOpenDetail && (
        <button
          type="button"
          onClick={onOpenDetail}
          style={{
            padding: '8px 14px',
            fontSize: 12,
            fontWeight: 600,
            border: '1px solid var(--shell-line, #E5E3D7)',
            borderRadius: 6,
            background: 'white',
            color: 'var(--valentia-slate, #005776)',
            cursor: 'pointer',
          }}
        >
          Open Mass Balance →
        </button>
      )}
    </div>
  )
}

function UsageDecisionEvidenceList({
  rows,
  isExternal,
}: {
  rows: readonly PassportUsageDecisionEvidence[]
  isExternal: boolean
}) {
  return (
    <>
      <div
        style={{
          fontSize: 11,
          color: 'var(--shell-fg-2)',
          fontStyle: 'italic',
          marginBottom: 8,
          padding: '6px 10px',
          background: 'var(--sunrise, #F9C20A)15',
          borderLeft: '3px solid var(--sunrise, #F9C20A)',
          borderRadius: 4,
        }}
      >
        These rows show the SAP usage-decision audit trail. They are NOT governed e-signatures,
        release approvals, or QA sign-offs.
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {rows.map((s) => (
          <div
            key={`${s.role}-${s.recordedAt}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '10px 14px',
              background: 'var(--shell-surface-2, #F8F7F0)',
              borderRadius: 6,
            }}
          >
            <div style={{ minWidth: 160 }}>
              <div
                style={{
                  fontSize: 10.5,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  color: 'var(--shell-fg-2)',
                  marginBottom: 2,
                }}
              >
                {s.role}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>
                {isExternal && s.decisionBy !== '—' ? '[masked]' : s.decisionBy}
              </div>
            </div>
            <div style={{ flex: 1, fontFamily: 'monospace', fontSize: 11, color: 'var(--shell-fg-2)' }}>
              {s.recordedAt || '—'}
            </div>
            <StatusPill
              status={s.decisionType === 'usage-decision-recorded' ? 'ok' : s.decisionType === 'inspection-completed' ? 'warn' : 'neutral'}
              label={
                s.decisionType === 'usage-decision-recorded'
                  ? 'Decision recorded'
                  : s.decisionType === 'inspection-completed'
                    ? 'Inspection done'
                    : 'No evidence'
              }
            />
          </div>
        ))}
      </div>
    </>
  )
}

function Th({ children, align = 'left', style }: { children: React.ReactNode; align?: 'left' | 'right'; style?: React.CSSProperties }) {
  return (
    <th
      style={{
        textAlign: align,
        padding: '8px 12px',
        fontSize: 10.5,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: 'var(--shell-fg-2)',
        ...style,
      }}
    >
      {children}
    </th>
  )
}

function StatusPill({ status, label }: { status: 'ok' | 'warn' | 'fail' | 'neutral'; label: string }) {
  const tone =
    status === 'fail'
      ? { bg: 'var(--sunset, #F24A00)20', fg: 'var(--sunset, #F24A00)' }
      : status === 'warn'
        ? { bg: 'var(--sunrise, #F9C20A)20', fg: '#8a6b00' }
        : status === 'ok'
          ? { bg: 'var(--jade, #44CF93)20', fg: '#1a8454' }
          : { bg: 'var(--shell-line, #E5E3D7)', fg: 'var(--shell-fg-2)' }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'capitalize',
        background: tone.bg,
        color: tone.fg,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}
