import { useEffect, useState } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { InvestigationTimeline, TimelineEvent } from '@connectio/data-contracts'
import { useInvestigationTimeline } from './trace-app-queries.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'
import { formatDateTime } from '../utils/format-date.js'

const registration: EvidencePanelRegistration = {
  panelId: 'investigation-timeline',
  displayName: 'Investigation Timeline',
  description:
    'Chronological log of production, QC, release, hold, dispatch, and approval events across SAP, LIMS, and TRACE source systems.',
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

export interface TimelinePanelProps {
  readonly request: Trace2AdapterRequest
}

const TONE_COLORS: Record<TimelineEvent['tone'], string> = {
  good: 'var(--status-good)',
  warn: 'var(--status-warn)',
  bad: 'var(--status-bad)',
  brand: 'var(--brand)',
  neutral: 'var(--status-neutral)',
}

const TYPE_LABELS: Record<TimelineEvent['type'], string> = {
  production: 'Production',
  consumption: 'Consumption',
  qc: 'QC',
  release: 'Release',
  approval: 'Approval',
  hold: 'Hold',
  dispatch: 'Dispatch',
  note: 'Note',
}

const PAGE_SIZE = 10

export function TimelinePanel({ request }: TimelinePanelProps) {
  const { data: result, isLoading } = useInvestigationTimeline(request)
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

  const data: InvestigationTimeline | null = result?.ok ? result.data : null

  const [page, setPage] = useState(0)
  const totalPages = data ? Math.ceil(data.events.length / PAGE_SIZE) : 0
  const pageEvents = data ? data.events.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) : []

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: 24, fontFamily: 'var(--font-sans)' }}>
          <div style={{ position: 'relative', paddingLeft: 28 }}>
            <div
              style={{
                position: 'absolute',
                top: 6,
                bottom: 6,
                left: 9,
                width: 2,
                background: 'var(--stroke-soft)',
              }}
            />
            {pageEvents.map((e, i) => (
              <TimelineRow key={`${e.ts}-${i}`} event={e} />
            ))}
          </div>

          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 16,
                paddingTop: 12,
                borderTop: '1px solid var(--stroke-soft)',
              }}
            >
              <button
                type="button"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                style={{
                  padding: '4px 12px',
                  fontSize: 'var(--fs-12)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--stroke)',
                  background: 'var(--white)',
                  color: page === 0 ? 'var(--fg-disabled)' : 'var(--forest)',
                  cursor: page === 0 ? 'default' : 'pointer',
                }}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 'var(--fs-12)', color: 'var(--fg-muted)' }}>
                Page {page + 1} of {totalPages} · {data.events.length} events
              </span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                style={{
                  padding: '4px 12px',
                  fontSize: 'var(--fs-12)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--stroke)',
                  background: 'var(--white)',
                  color: page === totalPages - 1 ? 'var(--fg-disabled)' : 'var(--forest)',
                  cursor: page === totalPages - 1 ? 'default' : 'pointer',
                }}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </EvidencePanel>
  )
}

function TimelineRow({ event }: { event: TimelineEvent }) {
  const dotColor = TONE_COLORS[event.tone]
  const dateLabel = formatDateTime(event.ts)

  return (
    <div style={{ position: 'relative', paddingBottom: 22 }}>
      <div
        style={{
          position: 'absolute',
          left: -24,
          top: 6,
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: dotColor,
          border: '2px solid var(--white)',
          boxShadow: 'var(--shadow-sm)',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 'var(--fs-12)',
            fontFamily: 'var(--font-mono)',
            color: 'var(--fg-muted)',
            minWidth: 140,
          }}
        >
          {dateLabel}
        </span>
        <span
          style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 10,
            fontWeight: 'var(--fw-bold)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            background: `color-mix(in srgb, ${dotColor} 12%, white)`,
            color: dotColor,
          }}
        >
          {TYPE_LABELS[event.type]}
        </span>
        <span style={{ fontSize: 'var(--fs-14)', fontWeight: 'var(--fw-semibold)', color: 'var(--forest)' }}>
          {event.label}
        </span>
        {event.sourceSystem && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 10,
              fontWeight: 'var(--fw-semibold)',
              color: 'var(--fg-muted)',
              padding: '2px 6px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--stroke-soft)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {event.sourceSystem}
          </span>
        )}
      </div>
      <div style={{ marginTop: 6, fontSize: 'var(--fs-13)', color: 'var(--fg-muted)', paddingLeft: 152 }}>
        {event.detail} · <span style={{ fontStyle: 'italic', color: 'var(--forest)' }}>{event.actor}</span>
      </div>
      {(event.plant || event.storageArea || event.storageType || event.documentNumber) && (
        <div
          style={{
            marginTop: 4,
            paddingLeft: 152,
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {event.plant && <MovementChip label="Plant" value={event.plant} />}
          {event.storageArea && <MovementChip label="Storage Area" value={event.storageArea} />}
          {event.storageType && <MovementChip label="Storage Type" value={event.storageType} />}
          {event.documentNumber && <MovementChip label="Document" value={event.documentNumber} />}
        </div>
      )}
    </div>
  )
}

function MovementChip({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ fontSize: 'var(--fs-12)', color: 'var(--fg-muted)' }}>
      <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 'var(--fw-semibold)', marginRight: 3 }}>{label}:</span>
      <span style={{ fontFamily: 'var(--font-mono)' }}>{value}</span>
    </span>
  )
}
