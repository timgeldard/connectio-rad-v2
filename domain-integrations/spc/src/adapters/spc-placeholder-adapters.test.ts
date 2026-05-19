import { describe, it, expect } from 'vitest'
import { SPCMonitoringDatabricksApiAdapter } from './spc-monitoring-databricks-api-adapter.js'
import { SPCMonitoringLegacyApiAdapter } from './spc-monitoring-legacy-api-adapter.js'
import type { SPCMonitoringAdapterRequest } from './spc-monitoring-adapter.js'

describe('SPC Placeholder Adapters', () => {
  const request: SPCMonitoringAdapterRequest = {
    plantId: 'C113',
    materialId: 'MAT-1',
    characteristicId: 'CHAR-1'
  }

  describe('SPCMonitoringDatabricksApiAdapter', () => {
    const adapter = new SPCMonitoringDatabricksApiAdapter()

    it('returns error for getSPCSummary', async () => {
      const result = await adapter.getSPCSummary(request)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.source).toBe('databricks-api')
        expect(result.error.code).toBe('not-found')
        expect(result.error.message).toContain('Databricks adapter unavailable')
      }
    })
  })

  describe('SPCMonitoringLegacyApiAdapter', () => {
    const adapter = new SPCMonitoringLegacyApiAdapter()

    it('returns error for getSPCSummary', async () => {
      const result = await adapter.getSPCSummary(request)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.source).toBe('legacy-api')
        expect(result.error.code).toBe('not-found')
        expect(result.error.message).toContain('Legacy API adapter unavailable')
      }
    })
  })
})
