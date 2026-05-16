import { Warehouse360Adapter } from './warehouse-360-adapter.js'
import { Warehouse360LegacyApiAdapter } from './warehouse-360-legacy-api-adapter.js'

const adapterMode = import.meta.env.VITE_ADAPTER_MODE ?? 'mock'
const wh360BaseUrl = import.meta.env.VITE_WH360_API_BASE_URL ?? ''

function createWarehouse360Adapter(): Warehouse360Adapter {
  if (adapterMode === 'legacy-api' && wh360BaseUrl) {
    return new Warehouse360LegacyApiAdapter(wh360BaseUrl)
  }
  return new Warehouse360Adapter()
}

export const warehouse360AdapterInstance: Warehouse360Adapter = createWarehouse360Adapter()
