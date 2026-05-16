import { ProcessOrderReviewAdapter } from './process-order-review-adapter.js'
import { ProcessOrderReviewLegacyApiAdapter } from './process-order-review-legacy-api-adapter.js'

const adapterMode = import.meta.env.VITE_ADAPTER_MODE ?? 'mock'
const porBaseUrl = import.meta.env.VITE_POH_API_BASE_URL ?? ''

function createProcessOrderReviewAdapter(): ProcessOrderReviewAdapter {
  // Empty porBaseUrl is intentional for same-origin Databricks Apps deployment.
  if (adapterMode === 'legacy-api') {
    return new ProcessOrderReviewLegacyApiAdapter(porBaseUrl)
  }
  return new ProcessOrderReviewAdapter()
}

export const processOrderReviewAdapterInstance: ProcessOrderReviewAdapter = createProcessOrderReviewAdapter()
