import { useState } from 'react'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

const DEFAULT_MATERIAL = '20052009'
const DEFAULT_BATCH = '0008602411'
const DEFAULT_PLANT = 'C061'
const DEFAULT_DIRECTION = 'both' as const
const DEFAULT_MAX_DEPTH = 2
const DEFAULT_MAX_EDGES = 100

type Direction = 'both' | 'upstream' | 'downstream'

export interface TraceQueryFormProps {
  onSubmit: (request: Trace2AdapterRequest) => void
  initialMaterialId?: string
  initialBatchId?: string
  initialPlantId?: string
}

/** Returns a stored-key suggestion if the input looks like an 18-char SAP ALPHA-padded material ID. */
function buildSuggestion(materialId: string): string | null {
  if (/^\d{18}$/.test(materialId) && materialId.startsWith('0')) {
    const stripped = materialId.replace(/^0+/, '')
    return stripped !== materialId ? stripped : null
  }
  return null
}

/**
 * Shared trace query form used by TraceTreeView and any other surface that needs
 * a material/batch/plant anchor with direction and depth controls.
 *
 * Features:
 * - §5 recent searches (last 3 in component state, one-click reload)
 * - §5 copy payload button (JSON for direct API use)
 * - §6 material ID normalization warning for 18-char zero-padded inputs
 */
export function TraceQueryForm({
  onSubmit,
  initialMaterialId,
  initialBatchId,
  initialPlantId,
}: TraceQueryFormProps) {
  const [materialId, setMaterialId] = useState(initialMaterialId ?? DEFAULT_MATERIAL)
  const [batchId, setBatchId] = useState(initialBatchId ?? DEFAULT_BATCH)
  const [plantId, setPlantId] = useState(initialPlantId ?? DEFAULT_PLANT)
  const [direction, setDirection] = useState<Direction>(DEFAULT_DIRECTION)
  const [maxDepth, setMaxDepth] = useState(DEFAULT_MAX_DEPTH)
  const [maxEdges, setMaxEdges] = useState(DEFAULT_MAX_EDGES)
  const [recentSearches, setRecentSearches] = useState<readonly Trace2AdapterRequest[]>([])
  const [copyLabel, setCopyLabel] = useState('Copy payload')

  const suggestion = buildSuggestion(materialId)

  function buildRequest(): Trace2AdapterRequest {
    return { investigationId: '', materialId, batchId, plantId, direction, maxDepth, maxEdges }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const req = buildRequest()
    setRecentSearches(prev => {
      const filtered = prev.filter(
        r =>
          !(
            r.materialId === req.materialId &&
            r.batchId === req.batchId &&
            r.direction === req.direction &&
            r.maxDepth === req.maxDepth &&
            r.maxEdges === req.maxEdges
          ),
      )
      return [req, ...filtered].slice(0, 3)
    })
    onSubmit(req)
  }

  function handleReset() {
    setMaterialId(DEFAULT_MATERIAL)
    setBatchId(DEFAULT_BATCH)
    setPlantId(DEFAULT_PLANT)
    setDirection(DEFAULT_DIRECTION)
    setMaxDepth(DEFAULT_MAX_DEPTH)
    setMaxEdges(DEFAULT_MAX_EDGES)
  }

  function reloadRecent(req: Trace2AdapterRequest) {
    setMaterialId(req.materialId ?? DEFAULT_MATERIAL)
    setBatchId(req.batchId ?? DEFAULT_BATCH)
    setPlantId(req.plantId ?? DEFAULT_PLANT)
    setDirection((req.direction ?? DEFAULT_DIRECTION) as Direction)
    setMaxDepth(req.maxDepth ?? DEFAULT_MAX_DEPTH)
    setMaxEdges(req.maxEdges ?? DEFAULT_MAX_EDGES)
    onSubmit(req)
  }

  function handleCopyPayload() {
    const payload = {
      material_id: materialId,
      batch_id: batchId,
      plant_id: plantId,
      direction,
      max_depth: maxDepth,
      max_edges: maxEdges,
    }
    navigator.clipboard
      .writeText(JSON.stringify(payload, null, 2))
      .then(() => {
        setCopyLabel('Copied!')
        setTimeout(() => setCopyLabel('Copy payload'), 2000)
      })
      .catch(() => {
        setCopyLabel('Copy failed')
        setTimeout(() => setCopyLabel('Copy payload'), 2000)
      })
  }

  const selectStyle = { fontFamily: 'monospace', padding: '4px 8px' }
  const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }

  return (
    <div data-testid="trace-query-form">
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 8 }}
      >
        <label style={labelStyle}>
          Material ID
          <input
            type="text"
            value={materialId}
            onChange={e => setMaterialId(e.target.value)}
            data-testid="input-material-id"
            style={{ fontFamily: 'monospace', padding: '4px 8px' }}
          />
        </label>
        <label style={labelStyle}>
          Batch ID
          <input
            type="text"
            value={batchId}
            onChange={e => setBatchId(e.target.value)}
            data-testid="input-batch-id"
            style={{ fontFamily: 'monospace', padding: '4px 8px' }}
          />
        </label>
        <label style={labelStyle}>
          Plant ID
          <input
            type="text"
            value={plantId}
            onChange={e => setPlantId(e.target.value)}
            data-testid="input-plant-id"
            style={{ fontFamily: 'monospace', padding: '4px 8px' }}
          />
        </label>
        <label style={labelStyle}>
          Direction
          <select
            value={direction}
            onChange={e => setDirection(e.target.value as Direction)}
            data-testid="select-direction"
            style={selectStyle}
          >
            <option value="both">Both</option>
            <option value="upstream">Upstream</option>
            <option value="downstream">Downstream</option>
          </select>
        </label>
        <label style={labelStyle}>
          Max depth
          <select
            value={maxDepth}
            onChange={e => setMaxDepth(Number(e.target.value))}
            data-testid="select-max-depth"
            style={selectStyle}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
        </label>
        <label style={labelStyle}>
          Max edges
          <select
            value={maxEdges}
            onChange={e => setMaxEdges(Number(e.target.value))}
            data-testid="select-max-edges"
            style={selectStyle}
          >
            <option value={100}>100</option>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
          </select>
        </label>
        <button type="submit" data-testid="btn-run-trace" style={{ padding: '4px 16px' }}>
          Run Trace
        </button>
        <button
          type="button"
          onClick={handleReset}
          data-testid="btn-reset"
          style={{ padding: '4px 12px', fontSize: 11, color: 'var(--shell-fg-3)' }}
        >
          Reset to test case
        </button>
        <button
          type="button"
          onClick={handleCopyPayload}
          data-testid="btn-copy-payload"
          style={{ padding: '4px 12px', fontSize: 11, color: 'var(--shell-fg-3)' }}
        >
          {copyLabel}
        </button>
      </form>

      {suggestion !== null && (
        <p
          data-testid="material-id-suggestion"
          style={{ fontSize: 11, color: '#D97706', margin: '0 0 8px 0' }}
        >
          SAP ALPHA-padded material IDs are not automatically normalized. Try stored key{' '}
          <strong>{suggestion}</strong> (e.g. 20052009, not 000000000020052009). Batch IDs
          preserve leading zeros.
        </p>
      )}

      {recentSearches.length > 0 && (
        <div
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}
          aria-label="Recent searches"
        >
          <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>Recent:</span>
          {recentSearches.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => reloadRecent(r)}
              data-testid={`btn-recent-${i}`}
              style={{ fontSize: 11, padding: '2px 8px', fontFamily: 'monospace' }}
            >
              {r.materialId} / {r.batchId}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
