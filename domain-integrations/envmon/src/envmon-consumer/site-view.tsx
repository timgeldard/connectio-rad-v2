/**
 * EnvMon Site view — all floors of one plant.
 *
 * Port of the Claude prototype's SiteView (assets/site-view.jsx) adapted for
 * v2 Databricks-backed data. Renders:
 *   - Plant header (code · name, product/country/staff, action buttons)
 *   - 5-card KPI strip from EnvMonSiteSummaryV2.kpis
 *   - Floor cards grid with mini SVG previews from sub-areas + locations
 *
 * Each floor card is a button that bubbles `onOpenFloor(floorId)` to the
 * workspace shell which switches the active tab.
 */
import { useMemo } from 'react'
import type {
  EnvMonFloor,
  EnvMonLocation,
  EnvMonStatus,
  EnvMonSubArea,
} from '@connectio/data-contracts'
import { useFloors, useLocationsV2, useSiteSummaryV2, useSubAreas } from '../adapters/envmon-v2-queries.js'

interface SiteViewProps {
  readonly plantId: string
  readonly onOpenFloor: (floorId: string) => void
}

export function SiteView({ plantId, onOpenFloor }: SiteViewProps) {
  const summary = useSiteSummaryV2(plantId)
  const floorsQuery = useFloors(plantId)
  const subAreasQuery = useSubAreas(plantId)
  const locationsQuery = useLocationsV2(plantId)

  const isLoading = summary.isLoading || floorsQuery.isLoading || subAreasQuery.isLoading || locationsQuery.isLoading
  const error =
    !summary.data?.ok ? summary.data?.error?.message :
    !floorsQuery.data?.ok ? floorsQuery.data?.error?.message :
    !subAreasQuery.data?.ok ? subAreasQuery.data?.error?.message :
    !locationsQuery.data?.ok ? locationsQuery.data?.error?.message :
    null

  const summaryData = summary.data?.ok ? summary.data.data : null
  const floors = floorsQuery.data?.ok ? floorsQuery.data.data.floors : []
  const subAreas = subAreasQuery.data?.ok ? subAreasQuery.data.data.subAreas : []
  const locations = locationsQuery.data?.ok ? locationsQuery.data.data.locations : []

  if (isLoading) {
    return (
      <div style={pageWrap}>
        <div style={{ color: 'var(--fg-muted, #6b7280)', padding: 40, textAlign: 'center' }}>
          Loading plant overview…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={pageWrap}>
        <div style={{ color: 'var(--sunset, #F24A00)', padding: 40, textAlign: 'center' }}>
          {error}
        </div>
      </div>
    )
  }

  if (!summaryData) {
    return (
      <div style={pageWrap}>
        <div style={{ color: 'var(--fg-muted, #6b7280)', padding: 40, textAlign: 'center' }}>
          No site summary data available for this plant.
        </div>
      </div>
    )
  }

  const totalLocs = summaryData.kpis.totalLocs
  const passRate = summaryData.kpis.passRate
  const planPct = summaryData.kpis.lotsPlanned
    ? Math.round((summaryData.kpis.lotsTested / summaryData.kpis.lotsPlanned) * 100)
    : 0

  return (
    <div style={pageWrap}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <div style={eyebrow}>Plant dashboard · 30 day window</div>
          <h1 style={hDisplay}>
            {summaryData.plantId} · {summaryData.plantName || '—'}
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-muted, #6b7280)', marginTop: 4 }}>
            {[
              summaryData.product,
              summaryData.country,
              `${floors.length} floors`,
              `${totalLocs} swab points`,
            ].filter(Boolean).join(' · ')}
          </div>
        </div>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <Kpi label="Active FAILs" value={summaryData.kpis.activeFails} accent="fail" delta="Require immediate action" />
        <Kpi label="WARNING (SPC)" value={summaryData.kpis.warnings} accent="warn" delta="3+ rising results" />
        <Kpi label="PENDING lots" value={summaryData.kpis.pending} accent="info" delta="Open in QM" />
        <Kpi label="Pass rate" value={passRate.toFixed(1)} unit="%" accent="ok" />
        <Kpi
          label="Plan completion"
          value={planPct}
          unit="%"
          accent="info"
          delta={`${summaryData.kpis.lotsTested}/${summaryData.kpis.lotsPlanned} lots`}
        />
      </section>

      <h3 style={{ margin: '8px 0 12px', fontSize: 15, fontWeight: 600, color: 'var(--forest, #143700)' }}>
        Floors
      </h3>

      {floors.length === 0 ? (
        <div
          style={{
            background: 'white',
            border: '1px dashed var(--stroke, rgba(20,55,0,0.18))',
            padding: 40,
            borderRadius: 8,
            color: 'var(--fg-muted, #6b7280)',
            textAlign: 'center',
          }}
        >
          No floors configured for this plant. Open Admin to create one.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))',
            gap: 14,
          }}
        >
          {floors.map(f => (
            <FloorCard
              key={f.floorId}
              floor={f}
              areas={subAreas.filter(a => a.floorId === f.floorId)}
              locations={locations.filter(l => l.floorId === f.floorId)}
              onOpen={() => onOpenFloor(f.floorId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Floor card ─────────────────────────────────────────────────────────────

interface FloorCardProps {
  readonly floor: EnvMonFloor
  readonly areas: readonly EnvMonSubArea[]
  readonly locations: readonly EnvMonLocation[]
  readonly onOpen: () => void
}

function FloorCard({ floor, areas, locations, onOpen }: FloorCardProps) {
  const counts = useMemo(() => locations.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1
    return acc
  }, { FAIL: 0, WARNING: 0, PENDING: 0, PASS: 0, NO_DATA: 0 } as Record<EnvMonStatus, number>), [locations])

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        background: 'white',
        borderRadius: 8,
        border: '1px solid var(--stroke-soft, rgba(20,55,0,0.10))',
        overflow: 'hidden',
        padding: 0,
        cursor: 'pointer',
        textAlign: 'left',
        display: 'block',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--stroke-soft, rgba(20,55,0,0.10))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={eyebrow}>Floor {floor.floorId}</div>
          <div style={{ fontWeight: 600, fontSize: 14, marginTop: 2, color: 'var(--forest, #143700)' }}>
            {floor.floorName}
          </div>
        </div>
        <div
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono, monospace)',
            color: 'var(--fg-muted, #6b7280)',
          }}
        >
          {areas.length} areas · {locations.length} points
        </div>
      </div>

      <div
        style={{
          background: '#FAFAF1',
          position: 'relative',
          aspectRatio: `${floor.svgWidth} / ${floor.svgHeight}`,
          maxHeight: 260,
          overflow: 'hidden',
        }}
      >
        <svg
          viewBox={`0 0 100 100`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          {areas.map(a => (
            <polygon
              key={a.areaId}
              points={a.polygonPts.map(p => `${p[0]},${p[1]}`).join(' ')}
              fill="white"
              stroke="rgba(20,55,0,0.2)"
              strokeWidth="0.3"
            />
          ))}
          {locations.map(l => (
            <circle
              key={l.funcLocId}
              cx={l.xPct}
              cy={l.yPct}
              r={1.2}
              fill={statusColor(l.status)}
              stroke="white"
              strokeWidth="0.25"
            />
          ))}
        </svg>
      </div>

      <div style={{ padding: '10px 16px', display: 'flex', gap: 10, fontSize: 11, fontFamily: 'var(--font-mono, monospace)' }}>
        <span style={{ color: counts.FAIL > 0 ? 'var(--sunset, #F24A00)' : 'var(--fg-muted, #6b7280)', fontWeight: 600 }}>
          ● {counts.FAIL} FAIL
        </span>
        <span style={{ color: counts.WARNING > 0 ? 'var(--sunrise, #F9C20A)' : 'var(--fg-muted, #6b7280)', fontWeight: 600 }}>
          ● {counts.WARNING} WARN
        </span>
        <span style={{ color: 'var(--fg-muted, #6b7280)' }}>● {counts.PENDING} PEND</span>
        <span style={{ color: 'var(--fg-muted, #6b7280)' }}>● {counts.PASS} PASS</span>
      </div>
    </button>
  )
}

// ─── KPI card ───────────────────────────────────────────────────────────────

interface KpiProps {
  readonly label: string
  readonly value: number | string
  readonly unit?: string
  readonly delta?: string
  readonly accent?: 'fail' | 'warn' | 'ok' | 'info'
}

function Kpi({ label, value, unit, delta, accent }: KpiProps) {
  const accentColor = accent === 'fail' ? 'var(--sunset, #F24A00)'
    : accent === 'warn' ? 'var(--sunrise, #F9C20A)'
    : accent === 'ok' ? 'var(--jade, #44CF93)'
    : accent === 'info' ? 'var(--sage, #289BA2)'
    : 'transparent'
  return (
    <div
      style={{
        background: 'white',
        borderRadius: 8,
        padding: '18px 20px',
        border: '1px solid var(--stroke-soft, rgba(20,55,0,0.10))',
        borderLeft: accent ? `4px solid ${accentColor}` : '1px solid var(--stroke-soft, rgba(20,55,0,0.10))',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 0,
      }}
    >
      <div style={kpiLabel}>{label}</div>
      <div style={kpiValue}>
        {value}
        {unit && <span style={kpiUnit}>{unit}</span>}
      </div>
      {delta && <div style={kpiDelta}>· {delta}</div>}
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function statusColor(status: EnvMonStatus): string {
  switch (status) {
    case 'FAIL':
      return '#F24A00'
    case 'WARNING':
      return '#F9C20A'
    case 'PENDING':
      return '#B7B7A8'
    case 'PASS':
      return '#44CF93'
    default:
      return '#D9D9CB'
  }
}

const pageWrap = {
  height: '100%',
  overflowY: 'auto',
  padding: '20px 28px 40px',
  background: 'var(--stone, #F1F1E5)',
  fontFamily: 'var(--font-sans, system-ui)',
} as const

const eyebrow = {
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: 10.5,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--valentia-slate, #005776)',
  fontWeight: 500,
} as const

const hDisplay = {
  fontFamily: 'var(--font-sans, system-ui)',
  fontWeight: 500,
  letterSpacing: '-0.015em',
  lineHeight: 1.1,
  color: 'var(--forest, #143700)',
  margin: '6px 0 0',
  fontSize: 32,
} as const

const kpiLabel = {
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: 10.5,
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  color: 'var(--fg-muted, #6b7280)',
  fontWeight: 500,
} as const

const kpiValue = {
  fontFamily: 'var(--font-sans, system-ui)',
  fontWeight: 500,
  fontSize: 36,
  lineHeight: 1,
  letterSpacing: '-0.02em',
  color: 'var(--forest, #143700)',
  display: 'flex',
  alignItems: 'baseline',
  gap: 6,
} as const

const kpiUnit = {
  fontSize: 14,
  color: 'var(--fg-muted, #6b7280)',
  fontWeight: 400,
} as const

const kpiDelta = {
  fontSize: 11.5,
  fontFamily: 'var(--font-mono, monospace)',
  color: 'var(--fg-muted, #6b7280)',
} as const
