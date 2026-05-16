import { ConnectedQualityLabAdapter } from './connected-quality-lab-adapter.js'
import { ConnectedQualityLabLegacyApiAdapter } from './connected-quality-lab-legacy-api-adapter.js'

const adapterMode = import.meta.env.VITE_ADAPTER_MODE ?? 'mock'
const cqBaseUrl = import.meta.env.VITE_CQ_API_BASE_URL ?? ''

function createConnectedQualityLabAdapter(): ConnectedQualityLabAdapter {
  // Empty cqBaseUrl is intentional for same-origin Databricks Apps deployment.
  if (adapterMode === 'legacy-api') {
    return new ConnectedQualityLabLegacyApiAdapter(cqBaseUrl)
  }
  return new ConnectedQualityLabAdapter()
}

export const connectedQualityLabAdapterInstance: ConnectedQualityLabAdapter =
  createConnectedQualityLabAdapter()
