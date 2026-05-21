import { describe, expect, it } from 'vitest'
import { buildTraceGenieReply } from './trace-genie-pilot-engine.js'
import type { TraceGenieSnapshot } from './trace-genie-pilot-engine.js'

const snapshot: TraceGenieSnapshot = {
  batchHeader: {
    data: {
      materialId: '20052009',
      materialDescription: 'Silicon Dioxide Powder',
      batchId: '0008602411',
      plantId: 'C061',
      plantName: 'C061',
      batchStatus: 'active',
      stockStatus: 'unrestricted',
      qualityStatus: 'pending',
      releaseStatus: 'unknown',
      quantity: 135,
      uom: 'KG',
    },
    source: 'legacy-api',
  },
  traceGraph: {
    data: {
      nodes: [
        { id: 'n1', materialId: '20052009', materialDescription: 'Silicon Dioxide Powder', batchId: '0008602411', plantId: 'C061', type: 'finished-good', status: 'resolved', riskLevel: 'low' },
        { id: 'n2', materialId: 'RM1', materialDescription: 'Raw Input', batchId: 'RM-B1', plantId: 'C061', type: 'raw-material', status: 'resolved', riskLevel: 'medium' },
      ],
      edges: [
        { id: 'e1', source: 'n2', target: 'n1', relationshipType: 'component-of' },
      ],
      direction: 'both',
      depth: 1,
      rootBatch: '0008602411',
      upstreamCount: 1,
      downstreamCount: 0,
      unresolvedNodeCount: 0,
      warnings: ['no_edges_found'],
      truncated: false,
    },
    source: 'databricks-api',
  },
}

describe('buildTraceGenieReply', () => {
  it('builds a cited graph summary', () => {
    const reply = buildTraceGenieReply('Summarize the lineage currently visible in the trace graph for this batch.', snapshot)

    expect(reply.kind).toBe('approved')
    expect(reply.text).toContain('BatchHeaderPanel (legacy-api)')
    expect(reply.text).toContain('TraceGraphPanel (databricks-api)')
    expect(reply.text).toContain('visible nodes')
  })

  it('refuses blocked customer exposure questions', () => {
    const reply = buildTraceGenieReply('Which customers are definitely affected?', snapshot)

    expect(reply.kind).toBe('blocked')
    expect(reply.text).toContain('current pilot')
  })

  it('returns unsupported response for out-of-pack questions', () => {
    const reply = buildTraceGenieReply('Tell me something interesting.', snapshot)

    expect(reply.kind).toBe('unsupported')
    expect(reply.text).toContain('could not match')
  })
})
