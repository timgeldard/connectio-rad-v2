import { describe, it, expect, vi, beforeEach } from 'vitest'
import { spcMonitoringAdapterFactory } from './spc-monitoring-adapter-factory.js'
import { SPCMonitoringAdapter } from './spc-monitoring-adapter.js'
import { SPCMonitoringLegacyApiAdapter } from './spc-monitoring-legacy-api-adapter.js'
import { SPCMonitoringDatabricksApiAdapter } from './spc-monitoring-databricks-api-adapter.js'

describe('spcMonitoringAdapterFactory', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns SPCMonitoringAdapter when mode is mock', () => {
    vi.stubEnv('VITE_ADAPTER_MODE', 'mock')
    const adapter = spcMonitoringAdapterFactory()
    expect(adapter).toBeInstanceOf(SPCMonitoringAdapter)
    // Should NOT be a subclass if strictly 'mock'
    expect(adapter.constructor.name).toBe('SPCMonitoringAdapter')
  })

  it('returns SPCMonitoringLegacyApiAdapter when mode is legacy-api', () => {
    vi.stubEnv('VITE_ADAPTER_MODE', 'legacy-api')
    const adapter = spcMonitoringAdapterFactory()
    expect(adapter).toBeInstanceOf(SPCMonitoringLegacyApiAdapter)
  })

  it('returns SPCMonitoringDatabricksApiAdapter when mode is databricks-api', () => {
    vi.stubEnv('VITE_ADAPTER_MODE', 'databricks-api')
    const adapter = spcMonitoringAdapterFactory()
    expect(adapter).toBeInstanceOf(SPCMonitoringDatabricksApiAdapter)
  })

  it('defaults to mock if mode is undefined', () => {
    vi.stubEnv('VITE_ADAPTER_MODE', '')
    const adapter = spcMonitoringAdapterFactory()
    expect(adapter.constructor.name).toBe('SPCMonitoringAdapter')
  })
})
