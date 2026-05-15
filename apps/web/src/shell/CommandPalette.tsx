import { useState, useEffect, useRef, useCallback } from 'react'
import { isNavigable } from '@connectio/product-model'
import { workspaceRegistry } from '../registry/workspace-registry.js'
import { useWorkspaceShellState } from './useWorkspaceShellState.js'

/** Props for the CommandPalette. */
export interface CommandPaletteProps {
  /** Called when the palette should be dismissed. */
  readonly onClose: () => void
}

/** A single selectable command in the palette. */
interface Command {
  readonly id: string
  readonly label: string
  readonly description?: string
  readonly category: string
  readonly action: () => void
}

/**
 * Global command palette (Ctrl+K / Cmd+K).
 *
 * @remarks
 * Provides keyboard-driven navigation to workspaces, investigations, and
 * actions. Rendered as a full-viewport overlay with an auto-focused search
 * input. Commands are filtered by the current query string.
 *
 * Accessibility: traps focus within the overlay; Escape closes; Arrow keys
 * navigate the command list; Enter activates the highlighted command.
 */
export function CommandPalette({ onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const { setWorkspace, navigateToTraceInvestigation } = useWorkspaceShellState()

  /** Auto-focus the input on mount. */
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  /** Build the full command list from registered workspaces + quick actions. */
  const allCommands: Command[] = [
    ...workspaceRegistry
      .filter(w => isNavigable(w.lifecycle))
      .map(w => ({
        id: `workspace-${w.workspaceId}`,
        label: `Go to ${w.displayName}`,
        description: w.description,
        category: 'Workspaces',
        action: () => {
          setWorkspace(w.workspaceId)
          onClose()
        },
      })),
    {
      id: 'trace-inv-mock',
      label: 'Open Trace Investigation — INV-2024-003847',
      description: 'EMMENTAL BLOCK NATURAL 100KG · Batch CH-240308-0047 · Kerry Listowel',
      category: 'Recent Investigations',
      action: () => {
        navigateToTraceInvestigation('INV-2024-003847', 'overview')
        onClose()
      },
    },
    {
      id: 'trace-inv-mock-recall',
      label: 'Open Trace Investigation — INV-2024-003847 (Recall Readiness)',
      description: 'Jump directly to recall readiness assessment',
      category: 'Recent Investigations',
      action: () => {
        navigateToTraceInvestigation('INV-2024-003847', 'recall-readiness')
        onClose()
      },
    },
  ]

  /** Filter commands by the current query (case-insensitive). */
  const filteredCommands = query.trim()
    ? allCommands.filter(
        c =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.description?.toLowerCase().includes(query.toLowerCase()),
      )
    : allCommands

  /** Reset highlighted index when the filtered list changes. */
  useEffect(() => {
    setHighlighted(0)
  }, [query])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlighted(i => Math.min(i + 1, filteredCommands.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlighted(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        filteredCommands[highlighted]?.action()
      } else if (e.key === 'Escape') {
        onClose()
      }
    },
    [filteredCommands, highlighted, onClose],
  )

  /** Group commands by category for rendering. */
  const grouped = filteredCommands.reduce<Record<string, Command[]>>((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = []
    acc[cmd.category].push(cmd)
    return acc
  }, {})

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh',
        zIndex: 2000,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: 560,
          maxWidth: '90vw',
          background: 'var(--shell-bg)',
          border: '1px solid var(--shell-line)',
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--shell-line)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 16, color: 'var(--shell-fg-3)' }} aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            type="search"
            placeholder="Search workspaces, investigations, actions…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Search command palette"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: 14,
              color: 'var(--shell-fg)',
            }}
          />
          <kbd
            style={{
              fontSize: 10,
              padding: '2px 6px',
              background: 'var(--shell-surface)',
              border: '1px solid var(--shell-line)',
              borderRadius: 3,
              color: 'var(--shell-fg-3)',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Command list */}
        <div
          style={{ maxHeight: '60vh', overflowY: 'auto' }}
          role="listbox"
          aria-label="Commands"
        >
          {filteredCommands.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--shell-fg-3)', fontSize: 13 }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            Object.entries(grouped).map(([category, commands]) => {
              // Track global index offset for the highlighted index
              const categoryOffset = filteredCommands.indexOf(commands[0])
              return (
                <div key={category}>
                  <div
                    style={{
                      padding: '6px 16px 4px',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'var(--shell-fg-3)',
                    }}
                  >
                    {category}
                  </div>
                  {commands.map((cmd, localIdx) => {
                    const globalIdx = categoryOffset + localIdx
                    const isHighlighted = globalIdx === highlighted
                    return (
                      <button
                        key={cmd.id}
                        type="button"
                        role="option"
                        aria-selected={isHighlighted}
                        onClick={cmd.action}
                        onMouseEnter={() => setHighlighted(globalIdx)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 16px',
                          background: isHighlighted
                            ? 'var(--shell-rail-active, var(--valentia-slate, #005776))'
                            : 'none',
                          border: 'none',
                          cursor: 'pointer',
                          gap: 2,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: isHighlighted ? '#fff' : 'var(--shell-fg)',
                          }}
                        >
                          {cmd.label}
                        </span>
                        {cmd.description && (
                          <span
                            style={{
                              fontSize: 11,
                              color: isHighlighted ? 'rgba(255,255,255,0.7)' : 'var(--shell-fg-3)',
                            }}
                          >
                            {cmd.description}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--shell-line)',
            display: 'flex',
            gap: 16,
            fontSize: 11,
            color: 'var(--shell-fg-3)',
          }}
        >
          <span><kbd style={kbdStyle}>↑↓</kbd> navigate</span>
          <span><kbd style={kbdStyle}>↵</kbd> select</span>
          <span><kbd style={kbdStyle}>ESC</kbd> close</span>
        </div>
      </div>
    </div>
  )
}

const kbdStyle: React.CSSProperties = {
  fontSize: 10,
  padding: '1px 4px',
  background: 'var(--shell-surface)',
  border: '1px solid var(--shell-line)',
  borderRadius: 3,
  color: 'var(--shell-fg-3)',
  marginRight: 4,
}
