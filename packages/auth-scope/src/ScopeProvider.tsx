import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import type { ScopeContext } from '@connectio/data-contracts'
import type { AuthScopeValue, UserIdentity, ScopeGrant } from './types.js'

export const AuthScopeContext = createContext<AuthScopeValue | null>(null)

const ANONYMOUS_USER: UserIdentity = {
  userId: 'anonymous',
  email: null,
  displayName: null,
  groups: [],
  isAuthenticated: false,
}

const ACTIVE_SCOPE_STORAGE_KEY = 'connectio.activeScope.v1'

function readStoredScope(): ScopeContext | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(ACTIVE_SCOPE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed as ScopeContext
  } catch {
    // Ignore corrupt storage — fall back to defaultScope.
  }
  return null
}

interface AuthScopeProviderProps {
  readonly children: ReactNode
  /** Pre-loaded user identity (from /api/auth/session in production). */
  readonly user?: UserIdentity
  /** Pre-loaded authorised scopes. */
  readonly authorisedScopes?: readonly ScopeGrant[]
  /** Default active scope used when nothing is persisted. */
  readonly defaultScope?: ScopeContext
  /** Disable localStorage persistence — used in tests. */
  readonly persistScope?: boolean
}

/** Provides user identity and multi-dimensional scope context to the tree. */
export function AuthScopeProvider({
  children,
  user = ANONYMOUS_USER,
  authorisedScopes = [],
  defaultScope = {},
  persistScope = true,
}: AuthScopeProviderProps) {
  const [activeScope, setActiveScopeState] = useState<ScopeContext>(() => {
    if (!persistScope) return defaultScope
    return readStoredScope() ?? defaultScope
  })

  const setActiveScope = useCallback((patch: Partial<ScopeContext>) => {
    setActiveScopeState((prev) => ({ ...prev, ...patch }))
  }, [])

  useEffect(() => {
    if (!persistScope || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(ACTIVE_SCOPE_STORAGE_KEY, JSON.stringify(activeScope))
    } catch {
      // Storage unavailable (private mode, quota) — silently drop.
    }
  }, [activeScope, persistScope])

  const value: AuthScopeValue = {
    user,
    authorisedScopes,
    activeScope,
    setActiveScope,
    isLoading: false,
    error: null,
  }

  return <AuthScopeContext.Provider value={value}>{children}</AuthScopeContext.Provider>
}
