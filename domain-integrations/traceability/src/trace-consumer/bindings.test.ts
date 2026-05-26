import { describe, expect, it } from 'vitest'
import { resolveTraceConsumerSearch } from './bindings.js'
import { TRACE_CONSUMER_SEARCH_FIXTURES } from './fixtures.js'

describe('resolveTraceConsumerSearch', () => {
  it('matches material descriptions by partial text', () => {
    const result = resolveTraceConsumerSearch('cheese powder', TRACE_CONSUMER_SEARCH_FIXTURES)

    expect(result.step).toBe('batches-for-material')
    if (result.step !== 'batches-for-material') return
    expect(result.selectedMaterial?.id).toBe('20035129')
    expect(result.batches.map(batch => batch.batchId)).toEqual(['8000049668', '8000049669'])
  })

  it('matches material ids with wildcards', () => {
    const result = resolveTraceConsumerSearch('10002384*', TRACE_CONSUMER_SEARCH_FIXTURES)

    expect(result.step).toBe('batches-for-material')
    if (result.step !== 'batches-for-material') return
    expect(result.selectedMaterial).toBeNull()
    expect(result.batches.map(batch => batch.materialId)).toContain('100023847')
    expect(result.batches.map(batch => batch.materialId)).toContain('100023848')
  })

  it('matches batch ids and preserves multi-plant options', () => {
    const result = resolveTraceConsumerSearch('CH-240308-0047', TRACE_CONSUMER_SEARCH_FIXTURES)

    expect(result.step).toBe('materials-for-batch')
    if (result.step !== 'materials-for-batch') return
    const emmental = result.materials.find(material => material.materialId === '100023847')
    expect(result.selectedBatch).toBe('CH-240308-0047')
    expect(emmental?.plants.map(plant => plant.id)).toEqual(['IE10', 'IE11'])
  })

  it('matches process order ids', () => {
    const result = resolveTraceConsumerSearch('PO-240308-1189', TRACE_CONSUMER_SEARCH_FIXTURES)

    expect(result.step).toBe('materials-for-batch')
    if (result.step !== 'materials-for-batch') return
    expect(result.materials).toHaveLength(1)
    expect(result.materials[0].processOrderId).toBe('PO-240308-1189')
    expect(result.materials[0].batchId).toBe('CH-240308-0047')
  })

  it('does not resolve unknown batch-like input without complete context', () => {
    const result = resolveTraceConsumerSearch('UNKNOWN-BATCH-001', TRACE_CONSUMER_SEARCH_FIXTURES)

    expect(result).toEqual({ step: 'no-results' })
  })
})
