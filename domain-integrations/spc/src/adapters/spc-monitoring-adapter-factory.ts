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
    // Native Databricks integration is currently blocked/pending gold-view alignment.
    // Returns unavailable/not-implemented status until native routes exist.
    return new SPCMonitoringDatabricksApiAdapter()
  }

  if (mode === 'legacy-api') {
    // No legacy API exists for SPC. 
    // Returns unavailable status as no V1 endpoint is available for proxying.
    return new SPCMonitoringLegacyApiAdapter()
  }

  return new SPCMonitoringAdapter()
}

/** Shared singleton instance for hooks and panels. */
export const spcMonitoringAdapter = spcMonitoringAdapterFactory()
