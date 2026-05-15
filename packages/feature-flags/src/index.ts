import type { LifecycleState } from '@connectio/product-model'

/** A map of flag name → enabled boolean, injectable at runtime. */
export type FeatureFlagRegistry = Record<string, boolean>

let registry: FeatureFlagRegistry = {}

/** Replace the active flag registry (called once on app init from manifest). */
export function setFeatureFlags(flags: FeatureFlagRegistry): void {
  registry = { ...flags }
}

/** Check whether a named feature flag is enabled. */
export function isFlagEnabled(flag: string): boolean {
  return registry[flag] ?? false
}

/**
 * Returns true when the lifecycle state is navigable given current flags.
 * Pilot workspaces are only visible when the 'pilot-access' flag is set.
 */
export function isLifecycleEnabled(lifecycle: LifecycleState): boolean {
  switch (lifecycle) {
    case 'live':
      return true
    case 'pilot':
      return isFlagEnabled('pilot-access')
    case 'concept-lab':
      return isFlagEnabled('concept-lab-access')
    case 'deprecated':
    case 'hidden':
      return false
  }
}
