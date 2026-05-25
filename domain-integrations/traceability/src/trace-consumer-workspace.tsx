import { useState } from 'react'
import { useBatchHeaderSummary, useTraceGraph } from './adapters/trace2-queries.js'
import { TraceGraphPanel } from './panels/trace-graph-panel.js'
import { TimelinePanel } from './trace-app/TimelinePanel.js'
import { RecallPanel } from './trace-app/RecallPanel.js'
import { QualityPassportPanel } from './trace-app/QualityPassportPanel.js'
import { buildTraceGenieReply } from './panels/trace-genie-pilot-engine.js'
import { UAT_CANDIDATE } from './constants.js'

interface ResolvedRequest {
  readonly materialId: string
  readonly batchId: string
  readonly plantId: string
}

interface MockDatabaseItem {
  readonly materialId: string
  readonly materialDescription: string
  readonly batchId: string
  readonly plantId: string
  readonly plantName: string
}

const SEARCH_DATABASE: readonly MockDatabaseItem[] = [
  {
    materialId: '20035129',
    materialDescription: 'CHEESE POWDER BLEND 25KG',
    batchId: '8000049668',
    plantId: 'C061',
    plantName: 'Kerry Cork (C061)',
  },
  {
    materialId: '20035129',
    materialDescription: 'CHEESE POWDER BLEND 25KG',
    batchId: '8000049669',
    plantId: 'C061',
    plantName: 'Kerry Cork (C061)',
  },
  {
    materialId: '20035130',
    materialDescription: 'WHEY POWDER BLEND 25KG',
    batchId: '8000049668',
    plantId: 'C061',
    plantName: 'Kerry Cork (C061)',
  },
  {
    materialId: '100023847',
    materialDescription: 'EMMENTAL BLOCK NATURAL 100KG',
    batchId: 'CH-240308-0047',
    plantId: 'IE10',
    plantName: 'Kerry Listowel (IE10)',
  },
  {
    materialId: '100023847',
    materialDescription: 'EMMENTAL BLOCK NATURAL 100KG',
    batchId: 'CH-240308-0047',
    plantId: 'IE11',
    plantName: 'Kerry Charleville (IE11)',
  },
  {
    materialId: '100023847',
    materialDescription: 'EMMENTAL BLOCK NATURAL 100KG',
    batchId: 'CH-240308-0048',
    plantId: 'IE10',
    plantName: 'Kerry Listowel (IE10)',
  },
  {
    materialId: '100023848',
    materialDescription: 'CHEDDAR CHEESE NATURAL 100KG',
    batchId: 'CH-240308-0047',
    plantId: 'IE10',
    plantName: 'Kerry Listowel (IE10)',
  },
]

export function TraceConsumerWorkspace() {
  const [request, setRequest] = useState<ResolvedRequest | null>(null)
  const [activeTab, setActiveTab] = useState<'lineage' | 'timeline' | 'risks' | 'insights' | 'passport'>('lineage')
  
  const [searchQuery, setSearchQuery] = useState('')
  const [searchStep, setSearchStep] = useState<'idle' | 'batches-for-material' | 'materials-for-batch' | 'select-plant' | 'no-results'>('idle')
  const [selectedMaterial, setSelectedMaterial] = useState<{ id: string; description: string } | null>(null)
  const [selectedBatch, setSelectedBatch] = useState<string>('')
  const [tempMaterialId, setTempMaterialId] = useState('')
  const [tempBatchId, setTempBatchId] = useState('')
  const [matchedBatches, setMatchedBatches] = useState<Array<{ batchId: string; materialId: string; materialDescription: string; plants: Array<{ id: string; name: string }> }>>([])
  const [matchedMaterials, setMatchedMaterials] = useState<Array<{ materialId: string; description: string; batchId: string; plants: Array<{ id: string; name: string }> }>>([])
  const [plantsToSelect, setPlantsToSelect] = useState<Array<{ id: string; name: string }>>([])

  const adapterRequest = request
    ? {
        materialId: request.materialId,
        batchId: request.batchId,
        plantId: request.plantId,
        investigationId: 'consumer-trace',
        direction: 'both' as const,
        maxDepth: 2,
        maxEdges: 100,
      }
    : null

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

  const handleWebSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const query = searchQuery.trim()
    if (!query) return

    // 1. Check if input is a known Material ID or description
    const itemsByMaterial = SEARCH_DATABASE.filter(
      item => item.materialId === query || item.materialDescription.toLowerCase().includes(query.toLowerCase())
    )

    // 2. Check if input is a known Batch ID
    const itemsByBatch = SEARCH_DATABASE.filter(
      item => item.batchId.toLowerCase() === query.toLowerCase()
    )

    if (itemsByMaterial.length > 0) {
      const batchesMap: Record<string, { batchId: string; materialId: string; materialDescription: string; plants: Array<{ id: string; name: string }> }> = {}
      itemsByMaterial.forEach(item => {
        if (!batchesMap[item.batchId]) {
          batchesMap[item.batchId] = {
            batchId: item.batchId,
            materialId: item.materialId,
            materialDescription: item.materialDescription,
            plants: []
          }
        }
        if (!batchesMap[item.batchId].plants.some(p => p.id === item.plantId)) {
          batchesMap[item.batchId].plants.push({ id: item.plantId, name: item.plantName })
        }
      })
      const batches = Object.values(batchesMap)
      setMatchedBatches(batches)
      setSelectedMaterial({ id: batches[0].materialId, description: batches[0].materialDescription })
      setSearchStep('batches-for-material')
    } else if (itemsByBatch.length > 0) {
      const materialsMap: Record<string, { materialId: string; description: string; batchId: string; plants: Array<{ id: string; name: string }> }> = {}
      itemsByBatch.forEach(item => {
        if (!materialsMap[item.materialId]) {
          materialsMap[item.materialId] = {
            materialId: item.materialId,
            description: item.materialDescription,
            batchId: item.batchId,
            plants: []
          }
        }
        if (!materialsMap[item.materialId].plants.some(p => p.id === item.plantId)) {
          materialsMap[item.materialId].plants.push({ id: item.plantId, name: item.plantName })
        }
      })
      const materials = Object.values(materialsMap)
      setMatchedMaterials(materials)
      setSelectedBatch(materials[0].batchId)
      setSearchStep('materials-for-batch')
    } else {
      // Direct pass for unmatched custom queries to allow debugging or custom inputs
      if (/^\d{8}$/.test(query)) {
        // Material number format: assume custom material, no batches
        setSearchStep('no-results')
      } else if (query.includes('-') || query.length >= 10) {
        // Batch format: assume custom batch
        setRequest({ materialId: '', batchId: query, plantId: '' })
      } else {
        setSearchStep('no-results')
      }
    }
  }

  const selectBatch = (batchId: string, materialId: string, plants: Array<{ id: string; name: string }>) => {
    if (plants.length > 1) {
      setTempMaterialId(materialId)
      setTempBatchId(batchId)
      setPlantsToSelect(plants)
      setSearchStep('select-plant')
    } else if (plants.length === 1) {
      setRequest({
        materialId,
        batchId,
        plantId: plants[0].id
      })
    } else {
      setRequest({
        materialId,
        batchId,
        plantId: ''
      })
    }
  }

  const selectMaterial = (materialId: string, batchId: string, plants: Array<{ id: string; name: string }>) => {
    if (plants.length > 1) {
      setTempMaterialId(materialId)
      setTempBatchId(batchId)
      setPlantsToSelect(plants)
      setSearchStep('select-plant')
    } else if (plants.length === 1) {
      setRequest({
        materialId,
        batchId,
        plantId: plants[0].id
      })
    } else {
      setRequest({
        materialId,
        batchId,
        plantId: ''
      })
    }
  }

  const selectPlant = (plantId: string) => {
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
              Search by Material ID, Description, or Batch ID to locate traceability genealogy.
            </p>

            <form onSubmit={handleWebSearch} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Enter Material ID, Name or Batch ID..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '16px 20px', paddingRight: 60, borderRadius: 30, border: '2px solid #E2E8F0', fontSize: 16, outline: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', transition: 'border-color 0.2s' }}
                  onFocus={e => e.currentTarget.style.borderColor = '#047857'}
                  onBlur={e => e.currentTarget.style.borderColor = '#E2E8F0'}
                  required
                />
                <button
                  type="submit"
                  id="web-search-submit"
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
                    cursor: 'pointer',
                  }}
                  title="Search"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: 20, height: 20 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21-21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z" />
                  </svg>
                </button>
              </div>

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
                </div>
              )}

              {/* Step: Batches for Material */}
              {searchStep === 'batches-for-material' && selectedMaterial && (
                <div style={{ background: '#F8FAFC', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0', marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#334155', margin: 0 }}>
                      Select a Batch for <span style={{ color: '#0F172A' }}>{selectedMaterial.description} ({selectedMaterial.id})</span>:
                    </h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {matchedBatches.map(b => (
                      <button
                        key={b.batchId}
                        type="button"
                        onClick={() => selectBatch(b.batchId, b.materialId, b.plants)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '12px 16px', background: 'white', border: '1px solid #E2E8F0', borderRadius: 8, textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.2s, background-color 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#047857'; e.currentTarget.style.backgroundColor = '#F0FDF4'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.backgroundColor = 'white'; }}
                      >
                        <span style={{ fontWeight: 600, color: '#0F172A' }}>Batch: {b.batchId}</span>
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
                  <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#334155', margin: 0 }}>
                      Select Material associated with Batch <span style={{ color: '#0F172A' }}>{selectedBatch}</span>:
                    </h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {matchedMaterials.map(m => (
                      <button
                        key={m.materialId}
                        type="button"
                        onClick={() => selectMaterial(m.materialId, m.batchId, m.plants)}
                        style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '12px 16px', background: 'white', border: '1px solid #E2E8F0', borderRadius: 8, textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.2s, background-color 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#047857'; e.currentTarget.style.backgroundColor = '#F0FDF4'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.backgroundColor = 'white'; }}
                      >
                        <span style={{ fontWeight: 600, color: '#0F172A' }}>{m.description}</span>
                        <span style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                          Material ID: {m.materialId} | {m.plants.length} plant{m.plants.length > 1 ? 's' : ''}
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
                  <p style={{ color: '#991B1B', fontWeight: 600, fontSize: 14, margin: '0 0 8px' }}>No matches found in the search database.</p>
                  <p style={{ color: '#7F1D1D', fontSize: 13, margin: '0 0 16px' }}>Try searching for one of the validated demo values below:</p>
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
