import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { InvestigationTimeline, TimelineEvent } from '@connectio/data-contracts'
import { useInvestigationTimeline } from './trace-app-queries.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

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
  good: '#1a8454',
  warn: '#8a6b00',
  bad: '#c63b00',
  brand: 'var(--valentia-slate, #005776)',
  neutral: 'var(--shell-fg-2)',
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

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: 20 }}>
          <div style={{ position: 'relative', paddingLeft: 28 }}>
            <div
              style={{
                position: 'absolute',
                top: 6,
                bottom: 6,
                left: 9,
                width: 2,
                background: 'var(--shell-line, #E5E3D7)',
              }}
            />
            {data.events.map((e, i) => (
              <TimelineRow key={`${e.ts}-${i}`} event={e} />
            ))}
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}

function TimelineRow({ event }: { event: TimelineEvent }) {
  const dotColor = TONE_COLORS[event.tone]
  const date = new Date(event.ts)
  const dateLabel = isNaN(date.getTime()) ? event.ts : date.toLocaleString()

  return (
    <div style={{ position: 'relative', paddingBottom: 18 }}>
      <div
        style={{
          position: 'absolute',
          left: -22,
          top: 6,
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: dotColor,
          border: '2px solid white',
          boxShadow: '0 0 0 1px var(--shell-line, #E5E3D7)',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 11,
            fontFamily: 'monospace',
            color: 'var(--shell-fg-2)',
            minWidth: 130,
          }}
        >
          {dateLabel}
        </span>
        <span
          style={{
            display: 'inline-block',
            padding: '1px 6px',
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            background: `${dotColor}1A`,
            color: dotColor,
          }}
        >
          {TYPE_LABELS[event.type]}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--forest, #143700)' }}>
          {event.label}
        </span>
        {event.sourceSystem && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--shell-fg-2)',
              padding: '1px 6px',
              borderRadius: 999,
              border: '1px solid var(--shell-line, #E5E3D7)',
            }}
          >
            {event.sourceSystem}
          </span>
        )}
      </div>
      <div style={{ marginTop: 4, fontSize: 12, color: 'var(--shell-fg-2)' }}>
        {event.detail} · <span style={{ fontStyle: 'italic' }}>{event.actor}</span>
      </div>
    </div>
  )
}
