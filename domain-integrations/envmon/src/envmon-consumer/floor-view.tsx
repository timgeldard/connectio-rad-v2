/**
 * EnvMon Floor view — drill-through detail for a single floor.
 *
 * Port of the prototype's FloorView (assets/floor-view.jsx) wired to
 * Databricks via the V2 hooks. Renders:
 *   - Breadcrumb back to Site
 *   - FilterBar (time window, MIC filter chips, mode toggle)
 *   - FloorPlan SVG with L4 polygons + L5 status pins + tooltip
 *   - Side LocationPanel with Trend / Lots / Spatial tabs
 *
 * The continuous-mode lambda slider + sanitation halos from the prototype are
 * intentionally deferred — the visual primitives are here but the SPC/decay
 * computation belongs server-side in a later slice.
 */
import { useMemo, useState } from 'react'
import type {
  EnvMonFloor,
  EnvMonLocation,
  EnvMonStatus,
  EnvMonSubArea,
} from '@connectio/data-contracts'
import {
  floorSvgUrl,
  useFloors,
  useLocationsV2,
  useLotsV2,
  useMicsV2,
  useSubAreas,
  useTrendsV2,
} from '../adapters/envmon-v2-queries.js'

interface FloorViewProps {
  readonly plantId: string
  readonly floorId: string
  readonly onBackToSite: () => void
  readonly onSelectFloor: (floorId: string) => void
}

export function FloorView({ plantId, floorId, onBackToSite, onSelectFloor }: FloorViewProps) {
  const [timeWindow, setTimeWindow] = useState(90)
  const [selectedFL, setSelectedFL] = useState<string | null>(null)
  const [activeMics, setActiveMics] = useState<readonly string[]>([])

  const floorsQuery = useFloors(plantId)
  const subAreasQuery = useSubAreas(plantId, floorId)
  const locationsQuery = useLocationsV2(plantId, floorId, timeWindow)
  const micsQuery = useMicsV2(undefined, plantId, 180)

  const floors = floorsQuery.data?.ok ? floorsQuery.data.data.floors : []
  const floor = floors.find(f => f.floorId === floorId) ?? null
  const subAreas = subAreasQuery.data?.ok ? subAreasQuery.data.data.subAreas : []
  const locations = locationsQuery.data?.ok ? locationsQuery.data.data.locations : []
  const mics = micsQuery.data?.ok ? micsQuery.data.data.mics : []

  const filtered = useMemo(() => {
    if (activeMics.length === 0) return locations
    return locations.filter(l => l.mics.some(m => activeMics.includes(m)))
  }, [locations, activeMics])

  const selectedLocation = filtered.find(l => l.funcLocId === selectedFL) ?? null

  const isLoading = floorsQuery.isLoading || subAreasQuery.isLoading || locationsQuery.isLoading
  const error =
    !floorsQuery.data?.ok ? floorsQuery.data?.error?.message :
    !subAreasQuery.data?.ok ? subAreasQuery.data?.error?.message :
    !locationsQuery.data?.ok ? locationsQuery.data?.error?.message :
    null

  if (isLoading) {
    return (
      <div style={pageWrap}>
        <div style={emptyMessage}>Loading floor…</div>
      </div>
    )
  }
  if (error) {
    return (
      <div style={pageWrap}>
        <div style={{ ...emptyMessage, color: 'var(--sunset, #F24A00)' }}>{error}</div>
      </div>
    )
  }
  if (!floor) {
    return (
      <div style={pageWrap}>
        <div style={emptyMessage}>Floor {floorId} not found for plant {plantId}.</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 24px',
          background: 'white',
          borderBottom: '1px solid var(--stroke-soft, rgba(20,55,0,0.10))',
        }}
      >
        <button type="button" onClick={onBackToSite} style={btnGhost}>← Site</button>
        <span style={{ color: 'var(--stroke, rgba(20,55,0,0.2))' }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--forest, #143700)' }}>{floor.floorName}</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 4 }}>
          {floors.map(f => (
            <button
              type="button"
              key={f.floorId}
              onClick={() => onSelectFloor(f.floorId)}
              style={{
                ...chip,
                background: f.floorId === floor.floorId ? 'var(--forest, #143700)' : 'white',
                color: f.floorId === floor.floorId ? 'white' : 'var(--forest, #143700)',
                borderColor: f.floorId === floor.floorId ? 'var(--forest, #143700)' : 'var(--stroke, rgba(20,55,0,0.18))',
              }}
            >
              {f.floorId}
            </button>
          ))}
        </div>
      </header>

      <FilterBar
        timeWindow={timeWindow}
        setTimeWindow={setTimeWindow}
        mics={mics.map(m => m.micId)}
        activeMics={activeMics}
        setActiveMics={setActiveMics}
      />

      <div
        style={{
          flex: 1,
          position: 'relative',
          padding: 16,
          background: '#FAFAF1',
          minHeight: 0,
        }}
      >
        <FloorPlan
          plantId={plantId}
          floor={floor}
          subAreas={subAreas}
          locations={filtered}
          selectedFL={selectedFL}
          onSelect={l => setSelectedFL(l.funcLocId)}
        />
        {selectedLocation && (
          <LocationPanel
            plantId={plantId}
            floor={floor}
            location={selectedLocation}
            onClose={() => setSelectedFL(null)}
          />
        )}
      </div>
    </div>
  )
}

// ─── FilterBar ──────────────────────────────────────────────────────────────

interface FilterBarProps {
  readonly timeWindow: number
  readonly setTimeWindow: (n: number) => void
  readonly mics: readonly string[]
  readonly activeMics: readonly string[]
  readonly setActiveMics: (m: readonly string[]) => void
}

function FilterBar({ timeWindow, setTimeWindow, mics, activeMics, setActiveMics }: FilterBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 24px',
        background: 'white',
        borderBottom: '1px solid var(--stroke-soft, rgba(20,55,0,0.10))',
        flexWrap: 'wrap',
      }}
    >
      <div>
        <div style={eyebrow}>Time window</div>
        <select
          value={timeWindow}
          onChange={e => setTimeWindow(Number(e.target.value))}
          style={selectInput}
        >
          {[30, 60, 90, 180, 365].map(v => (
            <option key={v} value={v}>{v} days</option>
          ))}
        </select>
      </div>

      <div style={{ minWidth: 200 }}>
        <div style={eyebrow}>MIC filter</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {mics.slice(0, 6).map(m => {
            const active = activeMics.includes(m)
            return (
              <button
                key={m}
                type="button"
                onClick={() => setActiveMics(active ? activeMics.filter(x => x !== m) : [...activeMics, m])}
                style={{
                  ...chip,
                  fontSize: 11,
                  padding: '2px 8px',
                  background: active ? 'var(--forest, #143700)' : 'white',
                  color: active ? 'white' : 'var(--forest, #143700)',
                  borderColor: active ? 'var(--forest, #143700)' : 'var(--stroke, rgba(20,55,0,0.18))',
                }}
              >
                {m}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── FloorPlan SVG ──────────────────────────────────────────────────────────

interface FloorPlanProps {
  readonly plantId: string
  readonly floor: EnvMonFloor
  readonly subAreas: readonly EnvMonSubArea[]
  readonly locations: readonly EnvMonLocation[]
  readonly selectedFL: string | null
  readonly onSelect: (l: EnvMonLocation) => void
}

function FloorPlan({ plantId, floor, subAreas, locations, selectedFL, onSelect }: FloorPlanProps) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: 'white',
        borderRadius: 8,
        border: '1px solid var(--stroke-soft, rgba(20,55,0,0.10))',
        overflow: 'hidden',
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        {floor.svgPath && (
          <image
            href={floorSvgUrl(plantId, floor.floorId)}
            x="0"
            y="0"
            width="100"
            height="100"
            preserveAspectRatio="xMidYMid meet"
            opacity={0.55}
          />
        )}
        {subAreas.map(a => (
          <g key={a.areaId}>
            <polygon
              points={a.polygonPts.map(p => `${p[0]},${p[1]}`).join(' ')}
              fill="white"
              stroke="rgba(20,55,0,0.22)"
              strokeWidth="0.15"
              fillOpacity="0.9"
            />
            {a.polygonPts.length > 0 && (
              <text
                x={a.polygonPts.reduce((s, p) => s + p[0], 0) / a.polygonPts.length}
                y={a.polygonPts.reduce((s, p) => s + p[1], 0) / a.polygonPts.length}
                fontSize="2"
                textAnchor="middle"
                fill="rgba(20,55,0,0.5)"
                fontFamily="var(--font-mono, monospace)"
                style={{ textTransform: 'uppercase', letterSpacing: '0.08em', pointerEvents: 'none' }}
              >
                {a.l4Code}
              </text>
            )}
          </g>
        ))}

        {locations.map(l => {
          const isSelected = selectedFL === l.funcLocId
          return (
            <g key={l.funcLocId} style={{ cursor: 'pointer' }} onClick={() => onSelect(l)}>
              {isSelected && (
                <circle
                  cx={l.xPct}
                  cy={l.yPct}
                  r={2.4}
                  fill="none"
                  stroke="var(--valentia-slate, #005776)"
                  strokeWidth="0.3"
                  strokeDasharray="0.6 0.4"
                />
              )}
              <circle
                cx={l.xPct}
                cy={l.yPct}
                r={l.status === 'FAIL' ? 1.5 : l.status === 'WARNING' ? 1.25 : 1.0}
                fill={statusColor(l.status)}
                stroke="white"
                strokeWidth="0.25"
              />
            </g>
          )
        })}
      </svg>

      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          background: 'white',
          padding: '8px 12px',
          borderRadius: 6,
          border: '1px solid var(--stroke, rgba(20,55,0,0.18))',
          boxShadow: '0 1px 2px rgba(20,55,0,0.06), 0 2px 8px rgba(20,55,0,0.04)',
          display: 'flex',
          gap: 14,
          alignItems: 'center',
          fontSize: 11.5,
          color: 'var(--fg-muted, #6b7280)',
          fontFamily: 'var(--font-mono, monospace)',
          letterSpacing: '0.04em',
        }}
      >
        {(['FAIL', 'WARNING', 'PENDING', 'PASS'] as const).map(s => (
          <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor(s) }} />
            {s}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── LocationPanel ──────────────────────────────────────────────────────────

interface LocationPanelProps {
  readonly plantId: string
  readonly floor: EnvMonFloor
  readonly location: EnvMonLocation
  readonly onClose: () => void
}

function LocationPanel({ plantId, floor, location, onClose }: LocationPanelProps) {
  const [tab, setTab] = useState<'trend' | 'lots' | 'spatial'>('trend')
  const trendMic = location.mics[0] ?? null
  const trendQuery = useTrendsV2(location.funcLocId, trendMic ?? undefined)
  const lotsQuery = useLotsV2(location.funcLocId)

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 420,
        height: '100%',
        background: 'white',
        borderLeft: '1px solid var(--stroke, rgba(20,55,0,0.18))',
        boxShadow: '-8px 0 24px rgba(20,55,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
      }}
    >
      <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--stroke-soft, rgba(20,55,0,0.10))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={eyebrow}>Functional location</div>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 13, fontWeight: 600, color: 'var(--valentia-slate, #005776)', marginTop: 2 }}>
              {location.funcLocId}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6, color: 'var(--forest, #143700)' }}>
              {location.name ?? location.funcLocId}
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-muted, #6b7280)', marginTop: 2 }}>
              {plantId} · {floor.floorName}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ ...btnGhost, padding: 6, width: 30, height: 30 }}>
            ✕
          </button>
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <StatusPill status={location.status} />
          {location.mics.length > 0 && <span style={chip}>{location.mics.join(' · ')}</span>}
          {location.lastInspectedDays != null && (
            <span style={chip}>Last: {location.lastInspectedDays}d ago</span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 2, padding: '0 20px', borderBottom: '1px solid var(--stroke-soft, rgba(20,55,0,0.10))' }}>
        {(['trend', 'lots', 'spatial'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              padding: '10px 12px',
              fontSize: 12,
              borderBottom: tab === t ? '2px solid var(--valentia-slate, #005776)' : '2px solid transparent',
              color: tab === t ? 'var(--valentia-slate, #005776)' : 'var(--fg-muted, #6b7280)',
              fontWeight: 500,
              textTransform: 'capitalize',
              marginBottom: -1,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, padding: '16px 20px', overflowY: 'auto' }}>
        {tab === 'trend' && (
          trendMic ? (
            trendQuery.isLoading ? (
              <div style={emptyMessage}>Loading trend…</div>
            ) : trendQuery.data?.ok ? (
              <TrendChart points={trendQuery.data.data.points} micName={trendQuery.data.data.micName} />
            ) : (
              <div style={emptyMessage}>{trendQuery.data?.error?.message ?? 'Unable to load trend'}</div>
            )
          ) : (
            <div style={emptyMessage}>No MIC observations within the time window.</div>
          )
        )}
        {tab === 'lots' && (
          lotsQuery.isLoading ? (
            <div style={emptyMessage}>Loading lots…</div>
          ) : lotsQuery.data?.ok ? (
            <LotsTable lots={lotsQuery.data.data.lots} />
          ) : (
            <div style={emptyMessage}>{lotsQuery.data?.error?.message ?? 'Unable to load lots'}</div>
          )
        )}
        {tab === 'spatial' && <div style={emptyMessage}>Spatial neighbour analysis lands with the heatmap endpoint.</div>}
      </div>
    </div>
  )
}

function TrendChart({ points, micName }: { points: { date: string; value: number | null; upper: number | null; valuation: 'R' | 'W' | 'A' | null }[]; micName: string }) {
  if (points.length === 0) return <div style={emptyMessage}>No results in window.</div>
  const upper = points[0]?.upper ?? 100
  const w = 360, h = 200
  const pad = { t: 10, r: 10, b: 24, l: 36 }
  const maxVal = Math.max(upper * 1.2, ...points.map(p => p.value ?? 0))
  const xScale = (i: number) => pad.l + (i / Math.max(points.length - 1, 1)) * (w - pad.l - pad.r)
  const yScale = (v: number) => pad.t + (1 - v / maxVal) * (h - pad.t - pad.b)

  return (
    <div>
      <div style={eyebrow}>MIC · {micName}</div>
      <div style={{ fontSize: 12, color: 'var(--fg-muted, #6b7280)', marginTop: 4 }}>
        Upper tolerance: {upper}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: 220, background: 'var(--stone, #F1F1E5)', borderRadius: 4, marginTop: 12, display: 'block' }}>
        <line x1={pad.l} y1={yScale(upper)} x2={w - pad.r} y2={yScale(upper)} stroke="var(--sunset, #F24A00)" strokeDasharray="4 4" />
        <polyline
          points={points.map((p, i) => p.value != null ? `${xScale(i)},${yScale(p.value)}` : '').filter(Boolean).join(' ')}
          fill="none"
          stroke="var(--valentia-slate, #005776)"
          strokeWidth="1.5"
        />
        {points.map((p, i) => p.value != null && (
          <circle
            key={i}
            cx={xScale(i)}
            cy={yScale(p.value)}
            r={3.2}
            fill={p.valuation === 'R' ? '#F24A00' : p.valuation === 'W' ? '#F9C20A' : '#44CF93'}
            stroke="white"
            strokeWidth="1"
          />
        ))}
      </svg>
    </div>
  )
}

function LotsTable({ lots }: { lots: { lotId: string; date: string; inspectionType: string | null; valuation: 'R' | 'W' | 'A' | null }[] }) {
  if (lots.length === 0) return <div style={emptyMessage}>No lots in window.</div>
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: 'white', borderRadius: 4 }}>
      <thead>
        <tr>
          {['Lot', 'Date', 'Type', 'Val'].map(h => (
            <th key={h} style={{ textAlign: 'left', padding: '8px 14px', fontFamily: 'var(--font-mono, monospace)', fontSize: 10.5, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--fg-muted, #6b7280)', borderBottom: '1px solid var(--stroke, rgba(20,55,0,0.18))', background: 'var(--stone, #F1F1E5)' }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lots.map(l => (
          <tr key={l.lotId}>
            <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono, monospace)', fontSize: 11.5, borderBottom: '1px solid var(--stroke-soft, rgba(20,55,0,0.10))' }}>{l.lotId}</td>
            <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono, monospace)', fontSize: 11.5, color: 'var(--fg-muted, #6b7280)', borderBottom: '1px solid var(--stroke-soft, rgba(20,55,0,0.10))' }}>{l.date}</td>
            <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--stroke-soft, rgba(20,55,0,0.10))' }}><span style={chip}>{l.inspectionType ?? '—'}</span></td>
            <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--stroke-soft, rgba(20,55,0,0.10))' }}>
              {l.valuation ? (
                <span style={{ display: 'inline-block', width: 18, height: 18, borderRadius: '50%', textAlign: 'center', lineHeight: '18px', fontSize: 10, fontWeight: 700, background: l.valuation === 'R' ? '#F24A00' : l.valuation === 'W' ? '#F9C20A' : '#44CF93', color: l.valuation === 'W' ? 'var(--forest, #143700)' : 'white' }}>{l.valuation}</span>
              ) : (
                '—'
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function StatusPill({ status }: { status: EnvMonStatus }) {
  const bg = statusColor(status)
  const fg = status === 'WARNING' || status === 'PENDING' || status === 'NO_DATA' ? 'var(--forest, #143700)' : 'white'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: 'var(--font-mono, monospace)',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        background: bg,
        color: fg,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
      {status}
    </span>
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
  marginBottom: 4,
} as const

const chip = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 10px',
  borderRadius: 999,
  background: 'white',
  border: '1px solid var(--stroke, rgba(20,55,0,0.18))',
  fontSize: 12,
  color: 'var(--forest, #143700)',
  cursor: 'pointer',
} as const

const btnGhost = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '5px 10px',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 500,
  background: 'transparent',
  color: 'var(--forest, #143700)',
  border: '1px solid var(--stroke, rgba(20,55,0,0.18))',
  cursor: 'pointer',
} as const

const selectInput = {
  padding: '6px 8px',
  background: 'white',
  border: '1px solid var(--stroke, rgba(20,55,0,0.18))',
  borderRadius: 4,
  fontSize: 13,
  color: 'var(--forest, #143700)',
  width: 120,
} as const

const emptyMessage = {
  padding: 40,
  textAlign: 'center' as const,
  color: 'var(--fg-muted, #6b7280)',
  fontSize: 13,
}
