import { useCallback, useEffect, useState } from 'react'

/** Immutable snapshot of URL-derived shell state. */
interface ShellState {
  /** The currently active workspace id, or null when on the home screen. */
  readonly workspaceId: string | null
  /** The currently active tab id within the workspace, or null when unset. */
  readonly tabId: string | null
  /** True when a workspace is selected and the scopebar should be shown. */
  readonly hasScope: boolean
}

/** Imperative actions that mutate the URL and trigger a re-render. */
interface ShellStateActions {
  /** Navigate to a workspace, clearing any previously active tab. */
  readonly setWorkspace: (workspaceId: string) => void
  /** Activate a tab within the current workspace. */
  readonly setTab: (tabId: string) => void
}

/**
 * Reads `?workspace=X&tab=Y` from `window.location.search` and returns a
 * parsed {@link ShellState}.
 *
 * @returns Parsed shell state derived from the current URL search params.
 */
function readFromUrl(): ShellState {
  const params = new URLSearchParams(window.location.search)
  const workspaceId = params.get('workspace')
  const tabId = params.get('tab')
  return { workspaceId, tabId, hasScope: workspaceId !== null }
}

/**
 * URL-backed shell state hook — no router library dependency.
 *
 * State is derived from `?workspace=X&tab=Y` query parameters and kept in sync
 * with browser history via `popstate` events. Mutations use
 * `history.replaceState` so navigation does not add history entries.
 *
 * @returns Combined shell state snapshot and action callbacks.
 */
export function useWorkspaceShellState(): ShellState & ShellStateActions {
  const [state, setState] = useState<ShellState>(readFromUrl)

  useEffect(() => {
    /** Re-sync state whenever the user navigates back/forward. */
    function onPopState() {
      setState(readFromUrl())
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const setWorkspace = useCallback((workspaceId: string) => {
    const params = new URLSearchParams(window.location.search)
    params.set('workspace', workspaceId)
    params.delete('tab')
    history.replaceState(null, '', `?${params.toString()}`)
    setState(readFromUrl())
  }, [])

  const setTab = useCallback((tabId: string) => {
    const params = new URLSearchParams(window.location.search)
    params.set('tab', tabId)
    history.replaceState(null, '', `?${params.toString()}`)
    setState(readFromUrl())
  }, [])

  return { ...state, setWorkspace, setTab }
}
