import { SPCMonitoringAdapter } from './spc-monitoring-adapter.js'
import { SPCMonitoringLegacyApiAdapter } from './spc-monitoring-legacy-api-adapter.js'
import { SPCMonitoringDatabricksApiAdapter } from './spc-monitoring-databricks-api-adapter.js'

/**
 * Factory for creating the appropriate SPC monitoring adapter based on the
 * VITE_ADAPTER_MODE environment variable.
 */
export function spcMonitoringAdapterFactory(): SPCMonitoringAdapter {
  const mode = import.meta.env.VITE_ADAPTER_MODE || 'mock'

  if (mode === 'databricks-api') {
    // Native Databricks integration is currently blocked/pending catalog alignment.
    // Falling back to Databricks adapter which currently behaves like a 
    // mock adapter with a warning source.
    return new SPCMonitoringDatabricksApiAdapter()
  }

  if (mode === 'legacy-api') {
    // No legacy API exists for SPC yet. Falling back to Legacy adapter
    // which currently behaves like a mock adapter with a warning source.
    return new SPCMonitoringLegacyApiAdapter()
  }

  return new SPCMonitoringAdapter()
}

/** Shared singleton instance for hooks and panels. */
export const spcMonitoringAdapter = spcMonitoringAdapterFactory()
