import { createDisabledAdapter } from '@connectio/source-adapters'
import { featureFlags } from '@connectio/feature-flags'
import { Trace2Adapter } from './trace2-adapter.js'
import { Trace2LegacyApiAdapter } from './trace2-legacy-api-adapter.js'

export function createTrace2Adapter(): Trace2Adapter {
  const adapterMode = import.meta.env.VITE_ADAPTER_MODE ?? 'mock'
  const traceBaseUrl = import.meta.env.VITE_TRACE_API_BASE_URL ?? ''

  // Empty traceBaseUrl is intentional for same-origin Databricks Apps deployment
  // (fetch('/api/trace2/...') resolves against the current host).
  if (adapterMode === 'legacy-api') {
    if (!featureFlags.traceability.legacyApi) {
      return createDisabledAdapter<Trace2Adapter>(
        'legacy-api',
        'Traceability Legacy API adapter is disabled by feature flags.'
      )
    }
    return new Trace2LegacyApiAdapter(traceBaseUrl)
  }
  return new Trace2Adapter()
}

/**
 * Singleton Trace2 adapter instance.
 * Mode is determined by VITE_ADAPTER_MODE at build time:
 *   - 'mock'       → returns realistic fixtures (default)
 *   - 'legacy-api' → calls V1 via V2 proxy; requires VITE_TRACE_API_BASE_URL
 */
export const trace2Adapter: Trace2Adapter = createTrace2Adapter()
