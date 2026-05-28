import { featureFlags } from '@connectio/feature-flags'
import { ProcessOrderReviewAdapter } from './process-order-review-adapter.js'
import { ProcessOrderReviewDatabricksApiAdapter } from './process-order-review-databricks-api-adapter.js'

// TODO: retire mock mode across the app — all domain integrations should follow this pattern
// once each adapter's databricks-api feature flag is enabled and browser-verified.
export function createProcessOrderReviewAdapter(): ProcessOrderReviewAdapter {
  // Empty porBaseUrl is intentional for same-origin Databricks Apps deployment.
  const porBaseUrl = import.meta.env.VITE_POH_API_BASE_URL ?? ''

  if (featureFlags.poh.databricksApi) {
    return new ProcessOrderReviewDatabricksApiAdapter(porBaseUrl)
  }

  // TODO: mock mode — retire once all adapters are wired to databricks-api
  return new ProcessOrderReviewAdapter()
}

export const processOrderReviewAdapterInstance: ProcessOrderReviewAdapter = createProcessOrderReviewAdapter()
