import { useState } from 'react'
import { TraceGraphPanel } from '@connectio/di-traceability'
import type { Trace2AdapterRequest } from '@connectio/di-traceability'

// gold_batch_lineage stores material IDs without SAP ALPHA leading zeros.
// '20052009' is the confirmed stored key — not '000000000020052009'.
const DEFAULT_MATERIAL = '20052009'
const DEFAULT_BATCH = '0008602411'
const DEFAULT_PLANT = 'C061'

export function TraceGraphVerifyPage() {
  const [materialId, setMaterialId] = useState(DEFAULT_MATERIAL)
  const [batchId, setBatchId] = useState(DEFAULT_BATCH)
  const [plantId, setPlantId] = useState(DEFAULT_PLANT)
  const [submitted, setSubmitted] = useState<Trace2AdapterRequest | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted({ investigationId: '', materialId, batchId, plantId })
  }

  return (
    <div data-testid="trace-graph-verify-page" style={{ padding: 16 }}>
      <h2 style={{ marginBottom: 4 }}>Trace Graph Verification</h2>
      <p style={{ fontSize: 12, color: 'var(--shell-fg-2)', marginBottom: 12 }}>
        Verification surface — native Databricks trace graph. No mock fallback.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
          Material ID
          <input
            type="text"
            value={materialId}
            onChange={e => setMaterialId(e.target.value)}
            data-testid="input-material-id"
            style={{ fontFamily: 'monospace', padding: '4px 8px' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
          Batch ID
          <input
            type="text"
            value={batchId}
            onChange={e => setBatchId(e.target.value)}
            data-testid="input-batch-id"
            style={{ fontFamily: 'monospace', padding: '4px 8px' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
          Plant ID
          <input
            type="text"
            value={plantId}
            onChange={e => setPlantId(e.target.value)}
            data-testid="input-plant-id"
            style={{ fontFamily: 'monospace', padding: '4px 8px' }}
          />
        </label>
        <button type="submit" data-testid="btn-run-trace" style={{ padding: '4px 16px' }}>
          Run Trace
        </button>
      </form>
      {submitted && <TraceGraphPanel request={submitted} />}
    </div>
  )
}
