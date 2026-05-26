import { useState } from 'react'
import { useBatchHeaderSummary, useTraceGraph } from './adapters/trace2-queries.js'
import { trace2Adapter } from './adapters/trace2-adapter-factory.js'
import { TraceGraphPanel } from './panels/trace-graph-panel.js'
import { TimelinePanel } from './trace-app/TimelinePanel.js'
import { RecallPanel } from './trace-app/RecallPanel.js'
import { QualityPassportPanel } from './trace-app/QualityPassportPanel.js'
import { buildTraceGenieReply } from './panels/trace-genie-pilot-engine.js'
import {
  createTraceConsumerAdapterRequest,
  parseTraceConsumerCombinedSearch,
  resolveTraceConsumerSearch,
  resolveTraceConsumerSelection,
  type ResolvedTraceConsumerRequest,
  type TraceConsumerMatchedBatch,
  type TraceConsumerMatchedMaterial,
  type TraceConsumerPlantOption,
  type TraceConsumerSelectionResult,
  type TraceConsumerSearchMatchType,
  type TraceConsumerSearchStep,
  type TraceConsumerTab,
} from './trace-consumer/bindings.js'
import { TRACE_CONSUMER_REQUIRED_CAVEATS } from './trace-consumer/caveats.js'

type SearchStatus = 'idle' | 'loading' | 'error'

const MATCH_TYPE_LABELS: Record<TraceConsumerSearchMatchType, string> = {
  'material-id': 'Material ID',
  description: 'Description',
  'batch-id': 'Batch ID',
  'process-order-id': 'Process order',
}

function formatMatchTypes(matchTypes: readonly TraceConsumerSearchMatchType[]): string {
  return matchTypes.map(type => MATCH_TYPE_LABELS[type]).join(', ')
}

export function TraceConsumerWorkspace() {
  const [request, setRequest] = useState<ResolvedTraceConsumerRequest | null>(null)
  const [activeTab, setActiveTab] = useState<TraceConsumerTab>('lineage')
  
  const [searchQuery, setSearchQuery] = useState('')
  const [searchStep, setSearchStep] = useState<TraceConsumerSearchStep>('idle')
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle')
  const [searchError, setSearchError] = useState('')
  const [searchMeta, setSearchMeta] = useState<{
    readonly total: number
    readonly truncated: boolean
    readonly wildcardApplied: boolean
    readonly source?: string
  } | null>(null)
  const [selectedMaterial, setSelectedMaterial] = useState<{ id: string; description: string } | null>(null)
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null)
  const [tempMaterialId, setTempMaterialId] = useState('')
  const [tempBatchId, setTempBatchId] = useState('')
  const [matchedBatches, setMatchedBatches] = useState<TraceConsumerMatchedBatch[]>([])
  const [matchedMaterials, setMatchedMaterials] = useState<TraceConsumerMatchedMaterial[]>([])
  const [plantsToSelect, setPlantsToSelect] = useState<TraceConsumerPlantOption[]>([])

  const adapterRequest = request ? createTraceConsumerAdapterRequest(request) : null

  const batchHeaderQuery = useBatchHeaderSummary(adapterRequest ?? { materialId: '', batchId: '', plantId: '' }, {
    enabled: request !== null,
  })
  const graphQuery = useTraceGraph(adapterRequest ?? { materialId: '', batchId: '', plantId: '' }, {
    enabled: request !== null,
  })

  const batchHeader = batchHeaderQuery.data?.ok ? batchHeaderQuery.data.data : null

  // Run Genie Pilot Engine to get insights
  let genieInsights = ''
  if (request && graphQuery.data?.ok && batchHeaderQuery.data?.ok) {
    const reply = buildTraceGenieReply(
      'Summarize the lineage and exposure status.',
      {
        batchHeader: {
          data: batchHeaderQuery.data.data,
          source: batchHeaderQuery.data.source,
        },
        traceGraph: {
          data: graphQuery.data.data,
          source: graphQuery.data.source,
        },
      }
    )
    genieInsights = reply.text
  }

  const handleWebSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const query = searchQuery.trim()
    if (!query) return

    setSearchStatus('loading')
    setSearchError('')
    setSearchStep('idle')
    setSelectedMaterial(null)
    setSelectedBatch(null)
    setMatchedBatches([])
    setMatchedMaterials([])
    setPlantsToSelect([])
    setSearchMeta(null)

    const combinedCriteria = parseTraceConsumerCombinedSearch(query)
    const adapterResult = await trace2Adapter.searchBatches({
      query,
      maxRows: 25,
      ...(combinedCriteria
        ? {
            materialId: combinedCriteria.materialId,
            batchId: combinedCriteria.batchId,
          }
        : {}),
    })
    if (!adapterResult.ok) {
      setSearchStatus('error')
      setSearchError(adapterResult.error.message)
      return
    }

    setSearchStatus('idle')
    setSearchMeta({
      total: adapterResult.data.total,
      truncated: adapterResult.data.truncated,
      wildcardApplied: adapterResult.data.wildcardApplied,
      source: adapterResult.source,
    })

    const searchResult = resolveTraceConsumerSearch(query, adapterResult.data.items)
    if (searchResult.step === 'batches-for-material') {
      setMatchedBatches(searchResult.batches)
      setSelectedMaterial(searchResult.selectedMaterial)
      setSearchStep('batches-for-material')
    } else if (searchResult.step === 'materials-for-batch') {
      setMatchedMaterials(searchResult.materials)
      setSelectedBatch(searchResult.selectedBatch)
      setSearchStep('materials-for-batch')
    } else if (searchResult.step === 'select-plant') {
      setTempMaterialId(searchResult.materialId)
      setTempBatchId(searchResult.batchId)
      setPlantsToSelect([...searchResult.plants])
      setSearchStep('select-plant')
    } else if (searchResult.step === 'resolved') {
      setRequest(searchResult.request)
    } else if (searchResult.step === 'missing-plant') {
      setSearchStatus('error')
      setSearchError(searchResult.message)
      setSearchStep('idle')
    } else {
      setSearchStep('no-results')
    }
  }

  const applySelectionResult = (selection: TraceConsumerSelectionResult) => {
    if (selection.step === 'select-plant') {
      setTempMaterialId(selection.materialId)
      setTempBatchId(selection.batchId)
      setPlantsToSelect([...selection.plants])
      setSearchStep('select-plant')
    } else if (selection.step === 'resolved') {
      setRequest(selection.request)
    } else {
      setSearchStatus('error')
      setSearchError(selection.message)
      setSearchStep('idle')
    }
  }

  const selectBatch = (batchId: string, materialId: string, plants: TraceConsumerPlantOption[]) => {
    applySelectionResult(resolveTraceConsumerSelection(materialId, batchId, plants))
  }

  const selectMaterial = (materialId: string, batchId: string, plants: TraceConsumerPlantOption[]) => {
    applySelectionResult(resolveTraceConsumerSelection(materialId, batchId, plants))
  }

  const selectPlant = (plantId: string) => {
    if (!plantId.trim()) {
      setSearchStatus('error')
      setSearchError('Plant context is required before launching trace.')
      return
    }
    setRequest({
      materialId: tempMaterialId,
      batchId: tempBatchId,
      plantId
    })
  }

  const loadDemoValue = (val: string) => {
    setSearchQuery(val)
    // Run search automatically
    setTimeout(() => {
      const btn = document.getElementById('web-search-submit')
      btn?.click()
    }, 50)
  }

  function handleBack() {
    setRequest(null)
    setSearchQuery('')
    setSearchStep('idle')
    setSearchStatus('idle')
    setSearchError('')
    setSearchMeta(null)
    setSelectedMaterial(null)
    setSelectedBatch(null)
    setMatchedBatches([])
    setMatchedMaterials([])
    setPlantsToSelect([])
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    background: '#F8FAFC',
    color: '#0F172A',
    fontFamily: 'Inter, sans-serif',
  }

  const headerStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #022C22 0%, #064E3B 100%)',
    color: 'white',
    padding: '24px 32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  }

  const tabButtonStyle = (tab: typeof activeTab) => ({
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    background: activeTab === tab ? '#047857' : 'transparent',
    color: activeTab === tab ? 'white' : '#64748B',
    transition: 'all 0.2s',
  })

  return (
    <div style={containerStyle}>
      {request === null ? (
        // Premium Landing Screen
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, padding: 32 }}>
          <div style={{ maxWidth: 640, width: '100%', background: 'white', padding: 40, borderRadius: 16, boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.05)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: '#047857', marginBottom: 12, textAlign: 'center' }}>
              Consumer Experience · Unified Search
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: '#064E3B', margin: '0 0 8px', letterSpacing: '-0.02em', textAlign: 'center' }}>
              Batch Traceability Portal
            </h1>
            <p style={{ color: '#475569', fontSize: 14, margin: '0 0 32px', lineHeight: 1.6, textAlign: 'center' }}>
              Search by material ID, description, batch ID, or process order ID to locate traceability genealogy. Use * for wildcards.
            </p>

            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, padding: 14, marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#047857', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
                POC consolidation caveats
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#065F46', fontSize: 12, lineHeight: 1.5 }}>
                {TRACE_CONSUMER_REQUIRED_CAVEATS.map(caveat => <li key={caveat}>{caveat}</li>)}
              </ul>
            </div>

            <form onSubmit={handleWebSearch} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Enter material, description, batch, or process order..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  disabled={searchStatus === 'loading'}
                  style={{ width: '100%', padding: '16px 20px', paddingRight: 60, borderRadius: 30, border: '2px solid #E2E8F0', fontSize: 16, outline: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', transition: 'border-color 0.2s' }}
                  onFocus={e => e.currentTarget.style.borderColor = '#047857'}
                  onBlur={e => e.currentTarget.style.borderColor = '#E2E8F0'}
                  required
                />
                <button
                  type="submit"
                  id="web-search-submit"
                  disabled={searchStatus === 'loading'}
                  style={{
                    position: 'absolute',
                    right: 8,
                    background: '#047857',
                    border: 'none',
                    borderRadius: '50%',
                    width: 44,
                    height: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    cursor: searchStatus === 'loading' ? 'wait' : 'pointer',
                    opacity: searchStatus === 'loading' ? 0.7 : 1,
                  }}
                  title="Search"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: 20, height: 20 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21-21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z" />
                  </svg>
                </button>
              </div>

              {searchStatus === 'loading' && (
                <div style={{ background: '#F0FDF4', color: '#065F46', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
                  Searching batches, materials, descriptions, and process orders...
                </div>
              )}

              {searchStatus === 'error' && (
                <div style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FEE2E2', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
                  {searchError || 'Search is unavailable right now.'}
                </div>
              )}

              {/* Suggestions */}
              {searchStep === 'idle' && (
                <div style={{ fontSize: 13, color: '#64748B', display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                  <span>Suggestions:</span>
                  <button type="button" onClick={() => loadDemoValue('20035129')} style={{ background: 'none', border: 'none', color: '#047857', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>Material (Cheese Powder)</button>
                  <span>·</span>
                  <button type="button" onClick={() => loadDemoValue('100023847')} style={{ background: 'none', border: 'none', color: '#047857', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>Material (Emmental)</button>
                  <span>·</span>
                  <button type="button" onClick={() => loadDemoValue('8000049668')} style={{ background: 'none', border: 'none', color: '#047857', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>Batch (8000049668)</button>
                  <span>·</span>
                  <button type="button" onClick={() => loadDemoValue('CH-240308-0047')} style={{ background: 'none', border: 'none', color: '#047857', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>Batch (CH-240308-0047)</button>
                  <span>·</span>
                  <button type="button" onClick={() => loadDemoValue('PO-240308-1189')} style={{ background: 'none', border: 'none', color: '#047857', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>Order (PO-240308-1189)</button>
                </div>
              )}

              {/* Step: Batches for Material */}
              {searchStep === 'batches-for-material' && (
                <div style={{ background: '#F8FAFC', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0', marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#334155', margin: 0 }}>
                      {selectedMaterial ? (
                        <>Select a Batch for <span style={{ color: '#0F172A' }}>{selectedMaterial.description} ({selectedMaterial.id})</span>:</>
                      ) : (
                        <>Select a Batch from <span style={{ color: '#0F172A' }}>{matchedBatches.length}</span> matching results:</>
                      )}
                    </h3>
                    {searchMeta && (
                      <span style={{ fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>
                        {searchMeta.source ?? 'source'} · {searchMeta.truncated ? 'showing first ' : ''}{searchMeta.total} result{searchMeta.total === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {matchedBatches.map(b => (
                      <button
                        key={`${b.materialId}:${b.batchId}`}
                        type="button"
                        onClick={() => selectBatch(b.batchId, b.materialId, b.plants)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, width: '100%', padding: '12px 16px', background: 'white', border: '1px solid #E2E8F0', borderRadius: 8, textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.2s, background-color 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#047857'; e.currentTarget.style.backgroundColor = '#F0FDF4'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.backgroundColor = 'white'; }}
                      >
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ fontWeight: 700, color: '#0F172A' }}>Batch: {b.batchId}</span>
                          <span style={{ fontSize: 12, color: '#475569' }}>{b.materialDescription} ({b.materialId})</span>
                          <span style={{ fontSize: 11, color: '#64748B' }}>
                            {b.processOrderId ? `Order ${b.processOrderId}` : 'No process order shown'}
                            {b.quantity != null ? ` · ${b.quantity.toLocaleString()} ${b.uom ?? ''}` : ''}
                            {b.matchTypes.length ? ` · Matched ${formatMatchTypes(b.matchTypes)}` : ''}
                          </span>
                        </span>
                        <span style={{ fontSize: 12, color: '#64748B' }}>
                          {b.plants.length} plant{b.plants.length > 1 ? 's' : ''} available →
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step: Materials for Batch */}
              {searchStep === 'materials-for-batch' && (
                <div style={{ background: '#F8FAFC', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0', marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#334155', margin: 0 }}>
                      {selectedBatch ? (
                        <>Select Material associated with Batch <span style={{ color: '#0F172A' }}>{selectedBatch}</span>:</>
                      ) : (
                        <>Select a material and batch from <span style={{ color: '#0F172A' }}>{matchedMaterials.length}</span> matching results:</>
                      )}
                    </h3>
                    {searchMeta && (
                      <span style={{ fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>
                        {searchMeta.source ?? 'source'} · {searchMeta.truncated ? 'showing first ' : ''}{searchMeta.total} result{searchMeta.total === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {matchedMaterials.map(m => (
                      <button
                        key={`${m.materialId}:${m.batchId}`}
                        type="button"
                        onClick={() => selectMaterial(m.materialId, m.batchId, m.plants)}
                        style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '12px 16px', background: 'white', border: '1px solid #E2E8F0', borderRadius: 8, textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.2s, background-color 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#047857'; e.currentTarget.style.backgroundColor = '#F0FDF4'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.backgroundColor = 'white'; }}
                      >
                        <span style={{ fontWeight: 600, color: '#0F172A' }}>{m.description}</span>
                        <span style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                          Material ID: {m.materialId} | Batch: {m.batchId} | {m.plants.length} plant{m.plants.length > 1 ? 's' : ''}
                        </span>
                        <span style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                          {m.processOrderId ? `Order ${m.processOrderId}` : 'No process order shown'}
                          {m.quantity != null ? ` · ${m.quantity.toLocaleString()} ${m.uom ?? ''}` : ''}
                          {m.matchTypes.length ? ` · Matched ${formatMatchTypes(m.matchTypes)}` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step: Select Plant */}
              {searchStep === 'select-plant' && (
                <div style={{ background: '#F8FAFC', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0', marginTop: 10 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#334155', margin: '0 0 12px' }}>
                    Select Anchor Plant:
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {plantsToSelect.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectPlant(p.id)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '12px 16px', background: 'white', border: '1px solid #E2E8F0', borderRadius: 8, textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.2s, background-color 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#047857'; e.currentTarget.style.backgroundColor = '#F0FDF4'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.backgroundColor = 'white'; }}
                      >
                        <span style={{ fontWeight: 600, color: '#0F172A' }}>{p.name}</span>
                        <span style={{ fontSize: 12, color: '#047857', fontWeight: 600 }}>Select & Launch →</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step: No Results */}
              {searchStep === 'no-results' && (
                <div style={{ background: '#FEF2F2', padding: 20, borderRadius: 12, border: '1px solid #FEE2E2', marginTop: 10, textAlign: 'center' }}>
                  <p style={{ color: '#991B1B', fontWeight: 600, fontSize: 14, margin: '0 0 8px' }}>No matching batch context found.</p>
                  <p style={{ color: '#7F1D1D', fontSize: 13, margin: '0 0 16px' }}>Try a material ID, partial description, batch ID, process order ID, or wildcard such as 200*.</p>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                    <button type="button" onClick={() => loadDemoValue('20035129')} style={{ background: 'white', border: '1px solid #FCA5A5', color: '#991B1B', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cheese Powder</button>
                    <button type="button" onClick={() => loadDemoValue('CH-240308-0047')} style={{ background: 'white', border: '1px solid #FCA5A5', color: '#991B1B', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Emmental Batch</button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      ) : (
        // Active Investigation View
        <>
          <header style={headerStyle}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={handleBack}
                  style={{ background: 'transparent', border: 'none', color: '#A7F3D0', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
                >
                  ← Back to Search
                </button>
                <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Batch Genealogy Overview</h1>
              </div>
              {batchHeader && (
                <div style={{ fontSize: 13, color: '#D1FAE5', marginTop: 4, fontFamily: 'monospace' }}>
                  Material: {batchHeader.materialDescription} ({batchHeader.materialId}) | Batch: {batchHeader.batchId} | Plant: {batchHeader.plantId}
                </div>
              )}
            </div>
            {batchHeader && (
              <div style={{ background: '#065F46', padding: '8px 16px', borderRadius: 8, fontSize: 13 }}>
                Status: <span style={{ color: '#34D399', fontWeight: 700 }}>{batchHeader.releaseStatus || 'Active'}</span>
              </div>
            )}
          </header>

          {/* Navigation tabs */}
          <div style={{ background: 'white', borderBottom: '1px solid #E2E8F0', padding: '12px 32px', display: 'flex', gap: 8 }}>
            <button onClick={() => setActiveTab('lineage')} style={tabButtonStyle('lineage')}>Lineage Graph</button>
            <button onClick={() => setActiveTab('timeline')} style={tabButtonStyle('timeline')}>Production Events</button>
            <button onClick={() => setActiveTab('risks')} style={tabButtonStyle('risks')}>Shipment & Exposure</button>
            <button onClick={() => setActiveTab('passport')} style={tabButtonStyle('passport')}>Batch Passport</button>
            <button onClick={() => setActiveTab('insights')} style={tabButtonStyle('insights')}>Conversational Insights</button>
          </div>

          {/* Active Tab Area */}
          <div style={{ flex: 1, padding: 32, display: 'flex', flexDirection: 'column' }}>
            {activeTab === 'lineage' && adapterRequest && (
              <div style={{ flex: 1, background: 'white', borderRadius: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)', overflow: 'hidden', minHeight: 600 }}>
                <TraceGraphPanel request={adapterRequest} />
              </div>
            )}

            {activeTab === 'timeline' && adapterRequest && (
              <div style={{ background: 'white', padding: 24, borderRadius: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Production & Logistics Journey</h3>
                <TimelinePanel request={adapterRequest} />
              </div>
            )}

            {activeTab === 'risks' && adapterRequest && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ background: 'white', padding: 24, borderRadius: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Recall & Customer Shipments</h3>
                  <RecallPanel request={adapterRequest} />
                </div>
              </div>
            )}

            {activeTab === 'passport' && adapterRequest && (
              <div style={{ background: 'white', padding: 24, borderRadius: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}>
                <QualityPassportPanel request={adapterRequest} />
              </div>
            )}

            {activeTab === 'insights' && (
              <div style={{ maxWidth: 800, width: '100%', margin: '0 auto', background: 'white', padding: 32, borderRadius: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 800, color: '#064E3B' }}>Genie AI Insights</h3>
                <div style={{ background: '#F1F5F9', borderLeft: '4px solid #047857', padding: 20, borderRadius: 8, fontSize: 14, lineHeight: 1.6, color: '#334155', whiteSpace: 'pre-line' }}>
                  {genieInsights || 'No insights available for this batch.'}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
