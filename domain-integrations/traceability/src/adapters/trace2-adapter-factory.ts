import { Trace2Adapter } from './trace2-adapter.js'
import { Trace2LegacyApiAdapter } from './trace2-legacy-api-adapter.js'

const adapterMode = import.meta.env.VITE_ADAPTER_MODE ?? 'mock'
const traceBaseUrl = import.meta.env.VITE_TRACE_API_BASE_URL ?? ''

function createTrace2Adapter(): Trace2Adapter {
  // Empty traceBaseUrl is intentional for same-origin Databricks Apps deployment
  // (fetch('/api/trace2/...') resolves against the current host).
  if (adapterMode === 'legacy-api') {
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
