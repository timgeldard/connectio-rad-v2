import { useState } from 'react'
import { useBatchHeaderSummary, useTraceGraph } from './adapters/trace2-queries.js'
import { TraceGraphPanel } from './panels/trace-graph-panel.js'
import { TimelinePanel } from './trace-app/TimelinePanel.js'
import { RecallPanel } from './trace-app/RecallPanel.js'
import { CustomerExposureView } from './views/customer-exposure-view.js'
import { buildTraceGenieReply } from './panels/trace-genie-pilot-engine.js'
import { UAT_CANDIDATE } from './constants.js'

interface ResolvedRequest {
  readonly materialId: string
  readonly batchId: string
  readonly plantId: string
}

export function TraceConsumerWorkspace() {
  const [request, setRequest] = useState<ResolvedRequest | null>(null)
  const [activeTab, setActiveTab] = useState<'lineage' | 'timeline' | 'risks' | 'insights'>('lineage')
  const [materialIdInput, setMaterialIdInput] = useState('')
  const [batchIdInput, setBatchIdInput] = useState('')
  const [plantIdInput, setPlantIdInput] = useState('')

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

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!materialIdInput.trim() || !batchIdInput.trim()) return
    setRequest({
      materialId: materialIdInput.trim(),
      batchId: batchIdInput.trim(),
      plantId: plantIdInput.trim(),
    })
  }

  function loadUatCandidate() {
    setMaterialIdInput(UAT_CANDIDATE.materialId)
    setBatchIdInput(UAT_CANDIDATE.batchId)
    setPlantIdInput(UAT_CANDIDATE.plantId)
    setRequest({ ...UAT_CANDIDATE })
  }

  function handleBack() {
    setRequest(null)
    setMaterialIdInput('')
    setBatchIdInput('')
    setPlantIdInput('')
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
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: '#047857', marginBottom: 12 }}>
              Consumer Experience · Traceability
            </div>
            <h1 style={{ fontSize: 36, fontWeight: 800, color: '#064E3B', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
              Batch Traceability Portal
            </h1>
            <p style={{ color: '#475569', fontSize: 15, margin: '0 0 32px', lineHeight: 1.6 }}>
              Enter batch identifiers below to track raw materials, production history, and downstream customer shipments.
            </p>

            <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
                  Material ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 20052009"
                  value={materialIdInput}
                  onChange={e => setMaterialIdInput(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
                  Batch ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 0008602411"
                  value={batchIdInput}
                  onChange={e => setBatchIdInput(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
                  Plant ID (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. C061"
                  value={plantIdInput}
                  onChange={e => setPlantIdInput(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={loadUatCandidate}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    background: 'white',
                    color: '#0F172A',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Load Demo Data
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#047857',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Investigate Batch
                </button>
              </div>
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
                <div style={{ background: 'white', padding: 24, borderRadius: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Exposure Context</h3>
                  <CustomerExposureView request={adapterRequest} />
                </div>
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
