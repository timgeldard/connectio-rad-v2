import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuthScope } from '@connectio/auth-scope'
import { usePlants } from './platform-plants.js'

/**
 * Cross-workspace plant picker mounted in the global header.
 *
 * Reads the active plant from {@link useAuthScope}'s `activeScope.plantId` and
 * writes it back via `setActiveScope({ plantId })`. Because the AuthScope
 * provider persists `activeScope` to localStorage, the selection survives
 * reload and propagates across every workspace that consults the same hook.
 *
 * The list comes from /api/platform/plants which queries `gold.gold_plant`
 * filtered to exclude DNU plants, sorted by `PLANT_ID`. Unity Catalog
 * enforces per-user row visibility, so we render whatever the endpoint
 * returns.
 */
export function PlantPicker() {
  const { activeScope, setActiveScope } = useAuthScope()
  const { plants, isLoading, error } = usePlants()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Close the menu on outside click.
  useEffect(() => {
    if (!open) return
    function onDocClick(event: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const filtered = useMemo(() => {
    if (!filter.trim()) return plants
    const q = filter.trim().toLowerCase()
    return plants.filter(
      p => p.plantId.toLowerCase().includes(q) || p.plantName.toLowerCase().includes(q),
    )
  }, [plants, filter])

  const activePlant = plants.find(p => p.plantId === activeScope.plantId) ?? null

  function pick(plantId: string) {
    setActiveScope({ plantId })
    setOpen(false)
    setFilter('')
  }

  const labelText = (() => {
    if (activePlant) return `${activePlant.plantId} · ${activePlant.plantName}`
    if (activeScope.plantId) return activeScope.plantId
    if (isLoading) return 'Loading plants…'
    if (error) return 'Plants unavailable'
    return 'Select plant'
  })()

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={activePlant ? `Active plant: ${labelText}` : 'Select a plant'}
        title={labelText}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 10px',
          background: 'var(--shell-surface)',
          border: '1px solid var(--shell-line)',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 12,
          color: 'var(--shell-fg)',
          maxWidth: 240,
        }}
      >
        <span aria-hidden="true">▣</span>
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          {labelText}
        </span>
        <span aria-hidden="true" style={{ color: 'var(--shell-fg-3)' }}>
          ▾
        </span>
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Plants"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: 320,
            maxHeight: 420,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--shell-bg)',
            border: '1px solid var(--shell-line)',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            zIndex: 500,
          }}
        >
          <div style={{ padding: 8, borderBottom: '1px solid var(--shell-line)' }}>
            <input
              type="search"
              autoFocus
              placeholder="Search by code or name…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                fontSize: 12,
                background: 'var(--shell-surface)',
                color: 'var(--shell-fg)',
                border: '1px solid var(--shell-line)',
                borderRadius: 4,
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: 4 }}>
            {error && (
              <div style={{ padding: 12, fontSize: 12, color: 'var(--sunset, #F24A00)' }}>
                {error}
              </div>
            )}
            {!error && isLoading && (
              <div style={{ padding: 12, fontSize: 12, color: 'var(--shell-fg-3)' }}>
                Loading plants…
              </div>
            )}
            {!error && !isLoading && filtered.length === 0 && (
              <div style={{ padding: 12, fontSize: 12, color: 'var(--shell-fg-3)' }}>
                {plants.length === 0
                  ? 'No plants available to your account.'
                  : 'No plants match this search.'}
              </div>
            )}
            {filtered.map(p => {
              const isActive = p.plantId === activeScope.plantId
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  key={p.plantId}
                  onClick={() => pick(p.plantId)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 10px',
                    background: isActive ? 'var(--shell-rail-hover, rgba(0,87,118,0.08))' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    color: 'var(--shell-fg)',
                    borderRadius: 4,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono, monospace)',
                      fontWeight: 600,
                      color: 'var(--valentia-slate, #005776)',
                      minWidth: 48,
                    }}
                  >
                    {p.plantId}
                  </span>
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                  >
                    {p.plantName}
                  </span>
                  {isActive && (
                    <span aria-hidden="true" style={{ color: 'var(--valentia-slate, #005776)' }}>
                      ✓
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
