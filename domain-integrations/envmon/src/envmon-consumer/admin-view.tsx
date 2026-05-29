/**
 * EnvMon Admin view — coordinate-mapper, polygon authoring, SVG upload.
 *
 * Combines:
 *   - Custom polygon drawing (click vertices, double-click to close) for L4
 *     custom areas — extends the prototype's rectangle-only sub-area drawing.
 *   - Drag-from-unmapped list onto the floor canvas. Drop is constrained by
 *     a client-side point-in-polygon check against the floor's L4 polygons;
 *     the server re-runs the same check before persisting.
 *   - SVG underlay upload to the envmon_floor_svgs Unity Catalog Volume.
 *   - Live persistence: every successful action runs a write mutation that
 *     invalidates the envmon-v2 query cache so Site/Floor see updates.
 */
import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from 'react'
import type { EnvMonSubArea, EnvMonUnmappedLocation } from '@connectio/data-contracts'
import {
  floorSvgUrl,
  useDeleteCoordinate,
  useDeleteSubArea,
  useFloors,
  useLocationsV2,
  useSubAreas,
  useUnmappedLocations,
  useUploadFloorSvg,
  useUpsertCoordinate,
  useUpsertSubArea,
} from '../adapters/envmon-v2-queries.js'

interface AdminViewProps {
  readonly plantId: string
}

type Tool = 'select' | 'draw' | 'delete'

interface DraftPolygon {
  readonly points: readonly [number, number][]
}

const L4_CODES = ['MIX', 'FIL', 'PCK', 'RTE', 'CIP', 'DRN', 'WSH', 'LAB', 'UTL', 'COR', 'DRY', 'PRE', 'CLD', 'WHS']

export function AdminView({ plantId }: AdminViewProps) {
  const floorsQuery = useFloors(plantId)
  const floors = floorsQuery.data?.ok ? floorsQuery.data.data.floors : []
  const [floorId, setFloorId] = useState<string | null>(null)

  useEffect(() => {
    if (!floorId && floors.length > 0) setFloorId(floors[0].floorId)
  }, [floorId, floors])

  const floor = floors.find(f => f.floorId === floorId) ?? null

  const subAreasQuery = useSubAreas(plantId, floorId ?? undefined)
  const locationsQuery = useLocationsV2(plantId, floorId ?? undefined)
  const unmappedQuery = useUnmappedLocations(plantId)

  const subAreas = subAreasQuery.data?.ok ? subAreasQuery.data.data.subAreas : []
  const locations = locationsQuery.data?.ok ? locationsQuery.data.data.locations : []
  const unmapped = unmappedQuery.data?.ok ? unmappedQuery.data.data.unmapped : []

  const [tool, setTool] = useState<Tool>('select')
  const [draft, setDraft] = useState<DraftPolygon | null>(null)
  const [draftL4Code, setDraftL4Code] = useState<string>(L4_CODES[0])
  const [draftName, setDraftName] = useState<string>('')
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ tone: 'error' | 'ok'; message: string } | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [l4Filter, setL4Filter] = useState<string>('ALL')
  const svgRef = useRef<SVGSVGElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const upsertSubArea = useUpsertSubArea()
  const deleteSubArea = useDeleteSubArea()
  const upsertCoordinate = useUpsertCoordinate()
  const deleteCoordinate = useDeleteCoordinate()
  const uploadSvg = useUploadFloorSvg()

  function showToast(tone: 'error' | 'ok', message: string) {
    setToast({ tone, message })
    setTimeout(() => setToast(null), 4000)
  }

  function getSvgPct(e: MouseEvent<SVGSVGElement>): [number, number] {
    if (!svgRef.current) return [0, 0]
    const rect = svgRef.current.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return [0, 0]
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    return [
      Math.max(0, Math.min(100, Number(x.toFixed(2)))),
      Math.max(0, Math.min(100, Number(y.toFixed(2)))),
    ]
  }

  // ─── Polygon drawing ──────────────────────────────────────────────────────

  function onCanvasClick(e: MouseEvent<SVGSVGElement>) {
    if (tool !== 'draw') return
    const pt = getSvgPct(e)
    setDraft(prev => ({ points: [...(prev?.points ?? []), pt] }))
  }

  function onCanvasDoubleClick() {
    if (tool !== 'draw' || !draft) return
    if (draft.points.length < 3) {
      showToast('error', 'A polygon needs at least 3 vertices.')
      return
    }
    if (!plantId || !floorId) return
    const areaId = `area-${Date.now().toString(36)}`
    const displayName = draftName.trim() || `${draftL4Code} area`
    upsertSubArea.mutate(
      {
        areaId,
        plantId,
        floorId,
        l4Code: draftL4Code,
        displayName,
        polygonPts: draft.points.map(p => [p[0], p[1]]),
      },
      {
        onSuccess: result => {
          if (result.ok) {
            showToast('ok', `Saved L4 polygon "${displayName}".`)
            setDraft(null)
            setDraftName('')
            setSelectedAreaId(areaId)
          } else {
            showToast('error', result.error.message)
          }
        },
      },
    )
  }

  function cancelDraft() {
    setDraft(null)
  }

  // ─── Drag-drop pin placement with PIP constraint ──────────────────────────

  function pointInPolygon(x: number, y: number, polygon: readonly [number, number][]): boolean {
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0]
      const yi = polygon[i][1]
      const xj = polygon[j][0]
      const yj = polygon[j][1]
      const intersect = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi
      if (intersect) inside = !inside
    }
    return inside
  }

  function findContainingArea(x: number, y: number): EnvMonSubArea | null {
    const matches = subAreas.filter(a => pointInPolygon(x, y, a.polygonPts as [number, number][]))
    if (matches.length === 0) return null
    // Smallest by axis-aligned bounding-box area, as a stable disambiguator.
    return matches.sort((a, b) => polyBboxArea(a) - polyBboxArea(b))[0]
  }

  function polyBboxArea(a: EnvMonSubArea): number {
    const xs = a.polygonPts.map(p => p[0])
    const ys = a.polygonPts.map(p => p[1])
    return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))
  }

  function onDragStart(e: DragEvent<HTMLDivElement>, fl: EnvMonUnmappedLocation) {
    e.dataTransfer.setData('envmon/func-loc', JSON.stringify(fl))
    e.dataTransfer.effectAllowed = 'move'
  }

  function onCanvasDrop(e: DragEvent<SVGSVGElement>) {
    e.preventDefault()
    const raw = e.dataTransfer.getData('envmon/func-loc')
    if (!raw || !plantId || !floorId) return
    const fl = JSON.parse(raw) as EnvMonUnmappedLocation
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    const area = findContainingArea(x, y)
    if (!area) {
      showToast('error', 'L5 swab points must land inside an L4 polygon.')
      return
    }
    upsertCoordinate.mutate(
      {
        funcLocId: fl.funcLocId,
        plantId,
        floorId,
        areaId: area.areaId,
        xPct: Number(x.toFixed(2)),
        yPct: Number(y.toFixed(2)),
      },
      {
        onSuccess: result => {
          if (result.ok) {
            showToast('ok', `Placed ${fl.funcLocId} in ${area.l4Code}.`)
          } else {
            showToast('error', result.error.message)
          }
        },
      },
    )
  }

  function onCanvasDragOver(e: DragEvent<SVGSVGElement>) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  // ─── Area + pin removal ───────────────────────────────────────────────────

  function onAreaClick(area: EnvMonSubArea) {
    if (tool === 'delete') {
      deleteSubArea.mutate(area.areaId, {
        onSuccess: result => {
          if (result.ok) {
            showToast('ok', `Removed area "${area.displayName}".`)
            if (selectedAreaId === area.areaId) setSelectedAreaId(null)
          } else {
            showToast('error', result.error.message)
          }
        },
      })
    } else {
      setSelectedAreaId(area.areaId)
    }
  }

  function onPinClick(funcLocId: string) {
    if (tool === 'delete') {
      deleteCoordinate.mutate(funcLocId, {
        onSuccess: result => {
          if (result.ok) showToast('ok', `Removed pin ${funcLocId}.`)
          else showToast('error', result.error.message)
        },
      })
    }
  }

  // ─── SVG upload ───────────────────────────────────────────────────────────

  function onUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !plantId || !floorId) return
    if (!file.type.includes('svg') && !file.name.endsWith('.svg')) {
      showToast('error', 'Only .svg files are accepted.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('error', 'SVG must be smaller than 2 MB.')
      return
    }
    uploadSvg.mutate(
      { plantId, floorId, file },
      {
        onSuccess: result => {
          if (result.ok) showToast('ok', 'SVG underlay uploaded.')
          else showToast('error', result.error.message)
        },
      },
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const filteredUnmapped = useMemo(() => {
    return unmapped.filter(u => {
      if (l4Filter !== 'ALL' && u.l4Code !== l4Filter) return false
      if (!searchTerm.trim()) return true
      const q = searchTerm.trim().toLowerCase()
      return u.funcLocId.toLowerCase().includes(q) || (u.name ?? '').toLowerCase().includes(q)
    })
  }, [unmapped, l4Filter, searchTerm])

  const l4Codes = useMemo(() => {
    const set = new Set<string>()
    unmapped.forEach(u => u.l4Code && set.add(u.l4Code))
    return Array.from(set).sort()
  }, [unmapped])

  const selectedArea = subAreas.find(a => a.areaId === selectedAreaId) ?? null

  if (floorsQuery.isLoading) {
    return <div style={emptyMessage}>Loading floors…</div>
  }

  if (floors.length === 0) {
    return (
      <div style={emptyMessage}>
        No floors configured. Create one with the +Floor button on a future iteration.
      </div>
    )
  }

  if (!floor) {
    return <div style={emptyMessage}>Pick a floor to begin.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={adminBanner}>
        ⚠ ADMIN MODE — edits persist to em_sub_areas and em_location_coordinates on save.
      </div>

      <header style={adminHeader}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--forest, #143700)' }}>
          {plantId} · Coordinate &amp; area mapper
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 4 }}>
          {floors.map(f => (
            <button
              key={f.floorId}
              type="button"
              onClick={() => setFloorId(f.floorId)}
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

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left rail — unmapped FLs */}
        <aside style={leftRail}>
          <div style={{ padding: 14, borderBottom: '1px solid var(--stroke-soft, rgba(20,55,0,0.10))' }}>
            <div style={eyebrow}>Unmapped locations</div>
            <div style={{ fontSize: 12, color: 'var(--fg-muted, #6b7280)', marginTop: 4 }}>
              {filteredUnmapped.length} · drag to place
            </div>
            <input
              type="search"
              placeholder="Search FL code…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={searchInput}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setL4Filter('ALL')}
                style={{ ...chip, fontSize: 10.5, padding: '2px 8px', background: l4Filter === 'ALL' ? 'var(--forest, #143700)' : 'white', color: l4Filter === 'ALL' ? 'white' : 'var(--forest, #143700)', borderColor: l4Filter === 'ALL' ? 'var(--forest, #143700)' : 'var(--stroke, rgba(20,55,0,0.18))' }}
              >
                All L4
              </button>
              {l4Codes.map(l => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setL4Filter(l)}
                  style={{ ...chip, fontSize: 10.5, padding: '2px 8px', background: l4Filter === l ? 'var(--forest, #143700)' : 'white', color: l4Filter === l ? 'white' : 'var(--forest, #143700)', borderColor: l4Filter === l ? 'var(--forest, #143700)' : 'var(--stroke, rgba(20,55,0,0.18))' }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filteredUnmapped.map(u => (
              <div
                key={u.funcLocId}
                draggable
                onDragStart={e => onDragStart(e, u)}
                style={dragCard}
              >
                <span style={dragCardCode}>{u.funcLocId}</span>
                {u.name && <span style={dragCardName}>{u.name}</span>}
              </div>
            ))}
            {filteredUnmapped.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--fg-muted, #6b7280)', padding: 14, textAlign: 'center' }}>
                {unmapped.length === 0 ? 'No unmapped functional locations.' : 'No matches in this filter.'}
              </div>
            )}
          </div>
        </aside>

        {/* Centre — canvas */}
        <section style={canvasShell}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={toolPalette}>
              <button type="button" onClick={() => setTool('select')} style={{ ...toolBtn, ...(tool === 'select' ? toolBtnActive : {}) }}>
                ↖ Select
              </button>
              <button type="button" onClick={() => setTool('draw')} style={{ ...toolBtn, ...(tool === 'draw' ? toolBtnActive : {}) }}>
                ✎ Draw L4 polygon
              </button>
              <button type="button" onClick={() => setTool('delete')} style={{ ...toolBtn, ...(tool === 'delete' ? toolBtnActive : {}) }}>
                🗑 Remove
              </button>
              {tool === 'draw' && draft && (
                <button type="button" onClick={cancelDraft} style={{ ...toolBtn, marginLeft: 6 }}>
                  Cancel
                </button>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-muted, #6b7280)' }}>
              {tool === 'draw' && 'Click to add vertex. Double-click to close polygon.'}
              {tool === 'select' && 'Drag a FL card from the left onto an L4 polygon to place a pin.'}
              {tool === 'delete' && 'Click a polygon or pin to remove it.'}
            </div>
            <div style={{ flex: 1 }} />
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--fg-muted, #6b7280)' }}>
              {subAreas.length} polygons · {locations.length} pins
            </span>
          </div>

          <div style={floorStage}>
            <svg
              ref={svgRef}
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid meet"
              style={{ width: '100%', height: '100%', cursor: tool === 'draw' ? 'crosshair' : 'default' }}
              onClick={onCanvasClick}
              onDoubleClick={onCanvasDoubleClick}
              onDragOver={onCanvasDragOver}
              onDrop={onCanvasDrop}
            >
              {floor.svgPath && (
                <image
                  href={floorSvgUrl(plantId, floor.floorId)}
                  x="0"
                  y="0"
                  width="100"
                  height="100"
                  preserveAspectRatio="xMidYMid meet"
                  opacity={0.45}
                />
              )}

              {subAreas.map(a => (
                <g key={a.areaId}>
                  <polygon
                    points={a.polygonPts.map(p => `${p[0]},${p[1]}`).join(' ')}
                    fill={selectedAreaId === a.areaId ? 'rgba(0,87,118,0.10)' : 'white'}
                    stroke={selectedAreaId === a.areaId ? 'var(--valentia-slate, #005776)' : 'rgba(20,55,0,0.22)'}
                    strokeWidth="0.18"
                    style={{ cursor: 'pointer' }}
                    onClick={evt => {
                      evt.stopPropagation()
                      onAreaClick(a)
                    }}
                  />
                  <text
                    x={a.polygonPts.reduce((s, p) => s + p[0], 0) / a.polygonPts.length}
                    y={a.polygonPts.reduce((s, p) => s + p[1], 0) / a.polygonPts.length}
                    fontSize="1.8"
                    textAnchor="middle"
                    fill="rgba(20,55,0,0.5)"
                    fontFamily="var(--font-mono, monospace)"
                    style={{ pointerEvents: 'none', textTransform: 'uppercase', letterSpacing: '0.06em' }}
                  >
                    {a.l4Code}
                  </text>
                </g>
              ))}

              {draft && draft.points.length > 0 && (
                <>
                  <polyline
                    points={draft.points.map(p => `${p[0]},${p[1]}`).join(' ')}
                    fill="none"
                    stroke="var(--valentia-slate, #005776)"
                    strokeWidth="0.2"
                    strokeDasharray="0.6 0.4"
                  />
                  {draft.points.map((p, i) => (
                    <circle key={i} cx={p[0]} cy={p[1]} r={0.7} fill="var(--valentia-slate, #005776)" />
                  ))}
                </>
              )}

              {locations.map(l => (
                <g key={l.funcLocId} style={{ cursor: tool === 'delete' ? 'pointer' : 'default' }}>
                  <circle
                    cx={l.xPct}
                    cy={l.yPct}
                    r={1.2}
                    fill="var(--valentia-slate, #005776)"
                    stroke="white"
                    strokeWidth="0.25"
                    onClick={evt => {
                      evt.stopPropagation()
                      onPinClick(l.funcLocId)
                    }}
                  />
                </g>
              ))}
            </svg>
          </div>

          {tool === 'draw' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 8 }}>
              <label style={{ fontSize: 12, color: 'var(--fg-muted, #6b7280)' }}>L4 code</label>
              <select value={draftL4Code} onChange={e => setDraftL4Code(e.target.value)} style={selectInput}>
                {L4_CODES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <label style={{ fontSize: 12, color: 'var(--fg-muted, #6b7280)', marginLeft: 12 }}>Name</label>
              <input
                type="text"
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                placeholder={`${draftL4Code} area`}
                style={{ ...searchInput, marginTop: 0, width: 200 }}
              />
              <span style={{ fontSize: 11, color: 'var(--fg-muted, #6b7280)' }}>
                {draft?.points.length ?? 0} vertices
              </span>
            </div>
          )}
        </section>

        {/* Right rail — properties / SVG upload */}
        <aside style={rightRail}>
          {selectedArea ? (
            <div>
              <div style={eyebrow}>Area properties</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8, color: 'var(--forest, #143700)' }}>
                {selectedArea.displayName}
              </div>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--valentia-slate, #005776)', marginTop: 2 }}>
                {selectedArea.areaId}
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--fg-muted, #6b7280)' }}>
                L4 code: <span style={{ color: 'var(--forest, #143700)', fontWeight: 600 }}>{selectedArea.l4Code}</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--fg-muted, #6b7280)' }}>
                {selectedArea.polygonPts.length} vertices
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--fg-muted, #6b7280)' }}>
                Contains {locations.filter(l => l.areaId === selectedArea.areaId).length} pins
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Remove L4 area "${selectedArea.displayName}"?`)) {
                    deleteSubArea.mutate(selectedArea.areaId, {
                      onSuccess: result => {
                        if (result.ok) {
                          showToast('ok', 'Removed.')
                          setSelectedAreaId(null)
                        } else {
                          showToast('error', result.error.message)
                        }
                      },
                    })
                  }
                }}
                style={{ ...toolBtn, marginTop: 16, color: 'var(--sunset, #F24A00)', borderColor: 'var(--sunset, #F24A00)' }}
              >
                Delete polygon
              </button>
            </div>
          ) : (
            <div>
              <div style={eyebrow}>Floor properties</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8, color: 'var(--forest, #143700)' }}>
                {floor.floorName}
              </div>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--fg-muted, #6b7280)', marginTop: 4 }}>
                {floor.svgWidth}×{floor.svgHeight}
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={eyebrow}>SVG underlay</div>
                <div style={{ fontSize: 12, color: 'var(--fg-muted, #6b7280)', marginTop: 6 }}>
                  {floor.svgPath ? 'Underlay uploaded' : 'No underlay uploaded'}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".svg,image/svg+xml"
                  onChange={onUploadFile}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ ...toolBtn, marginTop: 8 }}
                  disabled={uploadSvg.isPending}
                >
                  {uploadSvg.isPending ? 'Uploading…' : floor.svgPath ? 'Replace underlay' : 'Upload SVG underlay'}
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>

      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            padding: '10px 14px',
            borderRadius: 6,
            background: toast.tone === 'error' ? 'var(--sunset, #F24A00)' : 'var(--jade, #44CF93)',
            color: toast.tone === 'error' ? 'white' : 'var(--forest, #143700)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
            fontSize: 13,
            fontWeight: 500,
            zIndex: 1000,
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────

const adminBanner = {
  padding: '10px 24px',
  background: 'color-mix(in srgb, var(--innovation, #DFFF11) 18%, white)',
  borderBottom: '1px solid color-mix(in srgb, var(--innovation, #DFFF11) 40%, white)',
  fontSize: 12,
  fontFamily: 'var(--font-mono, monospace)',
  letterSpacing: '0.04em',
  color: 'var(--forest, #143700)',
} as const

const adminHeader = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '12px 24px',
  background: 'white',
  borderBottom: '1px solid var(--stroke-soft, rgba(20,55,0,0.10))',
} as const

const leftRail = {
  width: 280,
  background: 'white',
  borderRight: '1px solid var(--stroke-soft, rgba(20,55,0,0.10))',
  display: 'flex',
  flexDirection: 'column' as const,
}

const canvasShell = {
  flex: 1,
  padding: 16,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 12,
  background: '#FAFAF1',
}

const rightRail = {
  width: 300,
  background: 'white',
  borderLeft: '1px solid var(--stroke-soft, rgba(20,55,0,0.10))',
  padding: 16,
}

const floorStage = {
  flex: 1,
  position: 'relative' as const,
  background: 'white',
  borderRadius: 8,
  border: '1px solid var(--stroke-soft, rgba(20,55,0,0.10))',
  overflow: 'hidden' as const,
  minHeight: 360,
}

const toolPalette = {
  display: 'inline-flex',
  padding: 4,
  gap: 2,
  background: 'var(--stone, #F1F1E5)',
  borderRadius: 8,
}

const toolBtn = {
  padding: '8px 10px',
  fontSize: 12,
  color: 'var(--forest, #143700)',
  borderRadius: 6,
  background: 'transparent',
  border: '1px solid transparent',
  cursor: 'pointer',
} as const

const toolBtnActive = {
  background: 'var(--forest, #143700)',
  color: 'white',
} as const

const dragCard = {
  padding: '10px 12px',
  background: 'white',
  border: '1px solid var(--stroke, rgba(20,55,0,0.18))',
  borderRadius: 6,
  fontSize: 12,
  cursor: 'grab',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 2,
}

const dragCardCode = {
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: 11,
  color: 'var(--valentia-slate, #005776)',
  fontWeight: 500,
} as const

const dragCardName = {
  fontSize: 12.5,
  color: 'var(--forest, #143700)',
} as const

const eyebrow = {
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: 10.5,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--valentia-slate, #005776)',
  fontWeight: 500,
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
}

const searchInput = {
  width: '100%',
  padding: '6px 8px',
  background: 'white',
  border: '1px solid var(--stroke, rgba(20,55,0,0.18))',
  borderRadius: 4,
  fontSize: 13,
  color: 'var(--forest, #143700)',
  marginTop: 10,
} as const

const selectInput = {
  padding: '6px 8px',
  background: 'white',
  border: '1px solid var(--stroke, rgba(20,55,0,0.18))',
  borderRadius: 4,
  fontSize: 13,
  color: 'var(--forest, #143700)',
} as const

const emptyMessage = {
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 40,
  color: 'var(--fg-muted, #6b7280)',
  fontSize: 13,
  textAlign: 'center' as const,
}
