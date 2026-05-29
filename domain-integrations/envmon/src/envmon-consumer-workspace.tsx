/**
 * EnvMon Consumer workspace shell — V2 production rebuild.
 *
 * Replaces the in-memory mock workspace. Reads `plantId` from the global
 * AuthScope (cross-workspace context) and renders one of three internal
 * tabs:
 *   - Site (default) — plant overview with floor cards
 *   - Floor — drill-through floor detail (enabled after Site card click)
 *   - Admin — polygon authoring + coordinate placement (PR-4)
 *
 * All data comes from /api/envmon/v2/* and the cross-workspace plants
 * endpoint. No mock branches.
 */
import { useState } from 'react'
import type { ScopeContext } from '@connectio/data-contracts'
import { AdminView } from './envmon-consumer/admin-view.js'
import { FloorView } from './envmon-consumer/floor-view.js'
import { SiteView } from './envmon-consumer/site-view.js'

export interface EnvMonConsumerWorkspaceProps {
  readonly scope: ScopeContext
}

type Tab = 'site' | 'floor' | 'admin'

export function EnvMonConsumerWorkspace({ scope }: EnvMonConsumerWorkspaceProps) {
  const [tab, setTab] = useState<Tab>('site')
  const [floorId, setFloorId] = useState<string | null>(null)

  const plantId = scope.plantId

  function openFloor(id: string) {
    setFloorId(id)
    setTab('floor')
  }

  function backToSite() {
    setTab('site')
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--stone, #F1F1E5)' }}>
      <nav
        style={{
          display: 'flex',
          gap: 2,
          padding: '0 24px',
          background: 'white',
          borderBottom: '1px solid var(--stroke-soft, rgba(20,55,0,0.10))',
        }}
      >
        {([
          { id: 'site', label: 'Site overview' },
          { id: 'floor', label: 'Floor detail', disabled: !floorId },
          { id: 'admin', label: 'Admin · coordinate mapper' },
        ] as const).map(t => (
          <button
            key={t.id}
            type="button"
            disabled={'disabled' in t ? t.disabled : false}
            onClick={() => setTab(t.id)}
            style={{
              padding: '12px 16px',
              fontSize: 13,
              fontWeight: 500,
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--valentia-slate, #005776)' : '2px solid transparent',
              color:
                'disabled' in t && t.disabled
                  ? 'var(--fg-muted, #6b7280)'
                  : tab === t.id
                    ? 'var(--valentia-slate, #005776)'
                    : 'var(--forest, #143700)',
              cursor: 'disabled' in t && t.disabled ? 'not-allowed' : 'pointer',
              opacity: 'disabled' in t && t.disabled ? 0.5 : 1,
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div style={{ flex: 1, minHeight: 0 }}>
        {!plantId ? (
          <div style={emptyShell}>Pick a plant from the header to begin.</div>
        ) : tab === 'site' ? (
          <SiteView plantId={plantId} onOpenFloor={openFloor} />
        ) : tab === 'floor' && floorId ? (
          <FloorView
            plantId={plantId}
            floorId={floorId}
            onBackToSite={backToSite}
            onSelectFloor={setFloorId}
          />
        ) : tab === 'admin' ? (
          <AdminView plantId={plantId} />
        ) : (
          <div style={emptyShell}>Select a floor from the Site overview to drill in.</div>
        )}
      </div>
    </div>
  )
}

const emptyShell = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  padding: 40,
  color: 'var(--fg-muted, #6b7280)',
  fontFamily: 'var(--font-sans, system-ui)',
  textAlign: 'center' as const,
}
