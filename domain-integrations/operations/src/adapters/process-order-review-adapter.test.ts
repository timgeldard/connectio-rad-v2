import { describe, it, expect } from 'vitest'
import { ProcessOrderReviewAdapter } from './process-order-review-adapter.js'

const FIXED_NOW = '2024-03-08T10:00:00.000Z'
const adapter = new ProcessOrderReviewAdapter({ now: () => FIXED_NOW })

const request = { processOrderId: 'PO-240308-3847', plantId: 'IE10' }

describe('ProcessOrderReviewAdapter', () => {
  describe('getProcessOrderReviewContext', () => {
    it('returns ok result', async () => {
      const result = await adapter.getProcessOrderReviewContext(request)
      expect(result.ok).toBe(true)
    })

    it('returns processOrderId PO-240308-3847', async () => {
      const result = await adapter.getProcessOrderReviewContext(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.processOrderId).toBe('PO-240308-3847')
    })

    it('includes fetchedAt timestamp', async () => {
      const result = await adapter.getProcessOrderReviewContext(request)
      expect(result.ok && result.fetchedAt).toBe(FIXED_NOW)
    })

    it('returns plantId IE10', async () => {
      const result = await adapter.getProcessOrderReviewContext(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.plantId).toBe('IE10')
    })
  })

  describe('getProcessOrderHeader', () => {
    it('returns ok result', async () => {
      const result = await adapter.getProcessOrderHeader(request)
      expect(result.ok).toBe(true)
    })

    it('returns valid quantities', async () => {
      const result = await adapter.getProcessOrderHeader(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.plannedQuantity).toBeGreaterThan(0)
      expect(result.data.confirmedQuantity).toBeGreaterThanOrEqual(0)
    })

    it('returns correct orderType', async () => {
      const result = await adapter.getProcessOrderHeader(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.orderType).toBe('process-order')
    })
  })

  describe('getOrderProgressSummary', () => {
    it('returns ok result', async () => {
      const result = await adapter.getOrderProgressSummary(request)
      expect(result.ok).toBe(true)
    })

    it('progressPercent is between 0 and 100', async () => {
      const result = await adapter.getOrderProgressSummary(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.progressPercent).toBeGreaterThanOrEqual(0)
      expect(result.data.progressPercent).toBeLessThanOrEqual(100)
    })

    it('confidence is between 0 and 1', async () => {
      const result = await adapter.getOrderProgressSummary(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.confidence).toBeGreaterThanOrEqual(0)
      expect(result.data.confidence).toBeLessThanOrEqual(1)
    })
  })

  describe('getExecutionTimeline', () => {
    it('returns ok result with array', async () => {
      const result = await adapter.getExecutionTimeline(request)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data.length).toBeGreaterThan(0)
    })

    it('each event has required fields', async () => {
      const result = await adapter.getExecutionTimeline(request)
      if (!result.ok) throw new Error('Expected ok result')
      for (const event of result.data) {
        expect(event.eventId).toBeTruthy()
        expect(event.timestamp).toBeTruthy()
        expect(event.title).toBeTruthy()
      }
    })
  })

  describe('getOrderQualityContext', () => {
    it('returns ok result', async () => {
      const result = await adapter.getOrderQualityContext(request)
      expect(result.ok).toBe(true)
    })

    it('releaseBlockers is an array', async () => {
      const result = await adapter.getOrderQualityContext(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data.releaseBlockers)).toBe(true)
    })

    it('spcSignals count is non-negative', async () => {
      const result = await adapter.getOrderQualityContext(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.spcSignals).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getOrderStagingContext', () => {
    it('returns ok result', async () => {
      const result = await adapter.getOrderStagingContext(request)
      expect(result.ok).toBe(true)
    })

    it('componentsStaged does not exceed componentsRequired', async () => {
      const result = await adapter.getOrderStagingContext(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.componentsStaged).toBeLessThanOrEqual(result.data.componentsRequired)
    })
  })

  describe('getRelatedBatchContext', () => {
    it('returns ok result with array', async () => {
      const result = await adapter.getRelatedBatchContext(request)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data)).toBe(true)
    })

    it('each batch has valid relationship type', async () => {
      const result = await adapter.getRelatedBatchContext(request)
      if (!result.ok) throw new Error('Expected ok result')
      const validTypes = ['output', 'input-component', 'co-product', 'by-product', 'rework']
      for (const batch of result.data) {
        expect(validTypes).toContain(batch.relationshipType)
      }
    })

    it('each batch has valid traceRisk', async () => {
      const result = await adapter.getRelatedBatchContext(request)
      if (!result.ok) throw new Error('Expected ok result')
      for (const batch of result.data) {
        expect(['none', 'potential', 'confirmed']).toContain(batch.traceRisk)
      }
    })
  })
})
