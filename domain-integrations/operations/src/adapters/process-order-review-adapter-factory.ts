import { createDisabledAdapter } from '@connectio/source-adapters'
import { featureFlags } from '@connectio/feature-flags'
import { ProcessOrderReviewAdapter } from './process-order-review-adapter.js'
import { ProcessOrderReviewLegacyApiAdapter } from './process-order-review-legacy-api-adapter.js'
import { ProcessOrderReviewDatabricksApiAdapter } from './process-order-review-databricks-api-adapter.js'

export function createProcessOrderReviewAdapter(): ProcessOrderReviewAdapter {
  const adapterMode = import.meta.env.VITE_ADAPTER_MODE ?? 'mock'
  const porBaseUrl = import.meta.env.VITE_POH_API_BASE_URL ?? ''

  // Empty porBaseUrl is intentional for same-origin Databricks Apps deployment.
  if (adapterMode === 'databricks-api') {
    if (!featureFlags.poh.databricksApi) {
      return createDisabledAdapter<ProcessOrderReviewAdapter>(
        'databricks-api',
        'Process Order Review Databricks API adapter is disabled by feature flags.'
      )
    }
    return new ProcessOrderReviewDatabricksApiAdapter(porBaseUrl)
  }
  if (adapterMode === 'legacy-api') {
    // There is no explicit POH legacy API flag listed, but we can allow it by default, or just run it.
    // The user's prompt says: "Do not silently fall back to mock. If an environment is explicitly configured for databricks-api but the flag is false, return a disabled instance."
    // Let's keep legacy-api as is or check if we want a flag for it. (Wait, let's keep it simple and just do it for databricks-api).
    return new ProcessOrderReviewLegacyApiAdapter(porBaseUrl)
  }
  return new ProcessOrderReviewAdapter()
}

export const processOrderReviewAdapterInstance: ProcessOrderReviewAdapter = createProcessOrderReviewAdapter()
