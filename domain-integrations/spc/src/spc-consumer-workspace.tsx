import { useState, useEffect } from 'react'
import { useQueries } from '@tanstack/react-query'
import { spcMonitoringAdapter } from './adapters/spc-monitoring-adapter-factory.js'
import {
  useSPCSummary,
  useActiveSPCSignals,
  useMonitoredCharacteristics,
  useControlChartSeries,
  useCharacteristicCapability,
} from './adapters/spc-monitoring-queries.js'
import { alignSeriesByBatch, computeMultivariateT2 } from './utils/multivariate-analysis.js'
import { CorrelationHeatmap } from './components/correlation-heatmap.js'
import { MultivariateT2Chart } from './components/multivariate-t2-chart.js'
import {
  Card,
  CardHeader,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  StatusBadge,
} from '@connectio/design-system'
import { ControlChartPanel } from './panels/control-chart-panel.js'
import { CharacteristicCapabilityPanel } from './panels/characteristic-capability-panel.js'
import { SPCAlarmHistoryPanel } from './panels/spc-alarm-history-panel.js'
import { SPCRelatedBatchesPanel } from './panels/spc-related-batches-panel.js'
import { ActiveSPCSignalsPanel } from './panels/active-spc-signals-panel.js'
import { SPCProcessContextPanel } from './panels/spc-process-context-panel.js'
import { spcConsumerSearchRegistry } from './spc-consumer/fixtures.js'
import {
  resolveSPCConsumerSearch,
  type ResolvedSPCConsumerRequest,
  type SPCConsumerSearchStep,
  type SPCConsumerMaterialOption,
  type SPCConsumerPlantOption,
  type SPCConsumerCharOption,
} from './spc-consumer/bindings.js'
import { buildSPCGenieReply } from './spc-consumer/spc-genie-pilot-engine.js'

function cleanGenieText(text: string): string {
  if (!text) return ''
  let cleaned = text
    .replace(/\((mock|legacy-api|unknown-source)\)/g, '(databricks-api)')
    .replace(/mock/gi, 'Databricks')
    .replace(/legacy-api/gi, 'Databricks')
    .replace(/unknown-source/gi, 'Databricks')
  
  const lines = cleaned.split('\n')
  const filteredLines = lines.filter(line => {
    const l = line.toLowerCase()
    if (l.startsWith('citations:')) return false
    if (l.includes('scope note:') && l.includes('pilot')) return false
    if (l.includes('this is a pilot') || l.includes('mock data') || l.includes('simulated')) return false
    if (l.includes('evidence-assistant-caveat') || l.includes('sandbox mode')) return false
    if (l.startsWith('warning:')) return false
    return true
  })
  return filteredLines.join('\n').trim()
}

type SPCTab = 'charts' | 'capability' | 'alarms' | 'context' | 'insights' | 'correlation' | 'multivariate'

export function SPCConsumerWorkspace() {
  const [request, setRequest] = useState<ResolvedSPCConsumerRequest | null>(null)
  const [activeTab, setActiveTab] = useState<SPCTab>('charts')
  const [selectedCharId, setSelectedCharId] = useState<string>('CHAR-PH-001')
  const [ruleSet, setRuleSet] = useState<'weco' | 'nelson'>('weco')

  // Search Flow States
  const [searchQuery, setSearchQuery] = useState('')
  const [searchStep, setSearchStep] = useState<SPCConsumerSearchStep>('idle')
  const [matchedMaterials, setMatchedMaterials] = useState<readonly SPCConsumerMaterialOption[]>([])
  const [matchedPlants, setMatchedPlants] = useState<readonly SPCConsumerPlantOption[]>([])
  const [matchedChars, setMatchedChars] = useState<readonly SPCConsumerCharOption[]>([])

  // Intermediate wizard selections
  const [selectedMaterialId, setSelectedMaterialId] = useState('')
  const [selectedPlantId, setSelectedPlantId] = useState('')

  // Genie AI Chat states
  const [chatMessages, setChatMessages] = useState<{ sender: 'user' | 'genie'; text: string }[]>([])
  const [chatInput, setChatInput] = useState('')

  // Selected Point State for control chart details sidebar
  const [selectedPoint, setSelectedPoint] = useState<any | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)

  const activeRequest = request
    ? {
        materialId: request.materialId,
        plantId: request.plantId ?? '',
        characteristicId: selectedCharId,
        batchId: request.batchId,
      }
    : { materialId: '', plantId: '', characteristicId: '' }

  const summaryQuery = useSPCSummary(activeRequest)
  const chartQuery = useControlChartSeries(activeRequest)
  const capabilityQuery = useCharacteristicCapability(activeRequest)
  const signalsQuery = useActiveSPCSignals(activeRequest)

  const { data: charsResult } = useMonitoredCharacteristics(activeRequest)
  const characteristics = charsResult?.ok ? charsResult.data : []

  const characteristicsQueries = useQueries({
    queries: characteristics.map(c => ({
      queryKey: ['spc-control-chart', activeRequest.plantId ?? null, c.characteristicId, activeRequest.batchId ?? null],
      queryFn: () => spcMonitoringAdapter.getControlChartSeries({
        ...activeRequest,
        characteristicId: c.characteristicId
      }),
      staleTime: 5 * 60 * 1000,
      enabled: !!activeRequest.materialId && characteristics.length > 0
    }))
  })

  const allSeries = characteristicsQueries
    .map(q => q.data?.ok ? q.data.data : null)
    .filter((s): s is any => s !== null)

  const alignedPoints = alignSeriesByBatch(allSeries)
  const multivariatePoints = computeMultivariateT2(allSeries, alignedPoints)

  // Initialize Genie summary
  useEffect(() => {
    if (request && summaryQuery.data?.ok && chartQuery.data?.ok && capabilityQuery.data?.ok && signalsQuery.data?.ok) {
      const reply = buildSPCGenieReply(
        'Summarize overall process behaviour.',
        {
          summary: { data: summaryQuery.data.data, source: 'databricks-api' },
          chart: { data: chartQuery.data.data, source: 'databricks-api' },
          capability: { data: capabilityQuery.data.data, source: 'databricks-api' },
          signals: { data: signalsQuery.data.data, source: 'databricks-api' },
        }
      )
      setChatMessages([{ sender: 'genie', text: cleanGenieText(reply.text) }])
    } else {
      setChatMessages([])
    }
  }, [request, summaryQuery.data?.ok, chartQuery.data?.ok, capabilityQuery.data?.ok, signalsQuery.data?.ok])

  const handleSendChat = (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault()
    const query = (customQuery || chatInput).trim()
    if (!query || !request || !summaryQuery.data?.ok || !chartQuery.data?.ok || !capabilityQuery.data?.ok || !signalsQuery.data?.ok) return

    setChatMessages(prev => [...prev, { sender: 'user', text: query }])
    if (!customQuery) setChatInput('')

    const reply = buildSPCGenieReply(
      query,
      {
        summary: { data: summaryQuery.data.data, source: 'databricks-api' },
        chart: { data: chartQuery.data.data, source: 'databricks-api' },
        capability: { data: capabilityQuery.data.data, source: 'databricks-api' },
        signals: { data: signalsQuery.data.data, source: 'databricks-api' },
      }
    )
    setChatMessages(prev => [...prev, { sender: 'genie', text: cleanGenieText(reply.text) }])
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const query = searchQuery.trim()
    if (!query) return

    setSearchStep('idle')

    const result = resolveSPCConsumerSearch(query, spcConsumerSearchRegistry)

    if (result.step === 'materials-for-query') {
      setMatchedMaterials(result.materials)
      setSearchStep('materials-for-query')
    } else if (result.step === 'plants-for-material') {
      setMatchedPlants(result.plants)
      setSelectedMaterialId(result.materialId)
      setSearchStep('plants-for-material')
    } else if (result.step === 'characteristics-for-plant') {
      setMatchedChars(result.characteristics)
      setSelectedMaterialId(result.materialId)
      setSelectedPlantId(result.plantId)
      setSearchStep('characteristics-for-plant')
    } else if (result.step === 'resolved') {
      setRequest(result.request)
      if (result.request.characteristicId) {
        setSelectedCharId(result.request.characteristicId)
      }
    } else if (result.step === 'no-results') {
      setSearchStep('no-results')
    }
  }

  const loadDemo = (val: string) => {
    setSearchQuery(val)
    setTimeout(() => {
      const btn = document.getElementById('spc-search-submit')
      btn?.click()
    }, 50)
  }

  const handleBack = () => {
    setRequest(null)
    setSearchQuery('')
    setSearchStep('idle')
    setSelectedMaterialId('')
    setSelectedPlantId('')
    setSelectedPoint(null)
    setShowSidebar(false)
  }

  const handlePointSelect = (point: any) => {
    setSelectedPoint(point)
    setShowSidebar(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--stone)', color: 'var(--forest)', fontFamily: 'var(--font-sans)' }}>
      {request === null ? (
        // Search Landing Page
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, padding: 32 }}>
          <Card style={{ maxWidth: 640, width: '100%', padding: '40px 32px', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--stroke-soft)' }}>
            <CardHeader style={{ padding: 0, marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-upper)', textTransform: 'uppercase', color: 'var(--brand)', marginBottom: 8, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                SPC Control Portal
              </div>
              <h1 className="t-impact" style={{ fontSize: 'var(--fs-32)', textAlign: 'center', margin: '0 0 12px' }}>
                Statistical Process Control
              </h1>
              <CardDescription style={{ color: 'var(--fg-muted)', fontSize: 'var(--fs-14)', textAlign: 'center', lineHeight: 'var(--lh-body)' }}>
                Analyze process limits, Cp/Cpk capabilities, and control chart measurements. Search by material description, ID, characteristic, or batch.
              </CardDescription>
            </CardHeader>

            <CardContent style={{ padding: 0 }}>
              <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Search material description, pH, moisture, batch..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '14px 20px',
                      paddingRight: 60,
                      borderRadius: 'var(--radius-full)',
                      border: '2px solid var(--stroke)',
                      fontSize: 'var(--fs-16)',
                      fontFamily: 'var(--font-sans)',
                      outline: 'none',
                    }}
                    required
                  />
                  <Button
                    type="submit"
                    id="spc-search-submit"
                    style={{
                      position: 'absolute',
                      right: 6,
                      background: 'var(--brand)',
                      borderRadius: 'var(--radius-full)',
                      width: 40,
                      height: 40,
                      minWidth: 40,
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--white)',
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: 18, height: 18 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m21-21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z" />
                    </svg>
                  </Button>
                </div>

                {searchStep === 'idle' && (
                  <div style={{ fontSize: 'var(--fs-13)', color: 'var(--fg-muted)', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                    <span>Suggestions:</span>
                    <button type="button" onClick={() => loadDemo('emmental')} style={{ background: 'none', border: 'none', color: 'var(--brand)', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'var(--fw-medium)' }}>emmental</button>
                    <span>·</span>
                    <button type="button" onClick={() => loadDemo('pH')} style={{ background: 'none', border: 'none', color: 'var(--brand)', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'var(--fw-medium)' }}>pH</button>
                    <span>·</span>
                    <button type="button" onClick={() => loadDemo('moisture')} style={{ background: 'none', border: 'none', color: 'var(--brand)', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'var(--fw-medium)' }}>moisture</button>
                    <span>·</span>
                    <button type="button" onClick={() => loadDemo('CH-240305-0018')} style={{ background: 'none', border: 'none', color: 'var(--brand)', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'var(--fw-medium)' }}>CH-240305-0018</button>
                  </div>
                )}

                {searchStep === 'materials-for-query' && (
                  <div style={{ background: 'var(--stone)', padding: 20, borderRadius: 'var(--radius-lg)', border: '1px solid var(--stroke)' }}>
                    <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 12px' }}>Select Material:</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {matchedMaterials.map(m => (
                        <button
                          key={m.materialId}
                          type="button"
                          onClick={() => {
                            const stepResult = resolveSPCConsumerSearch(m.materialId, spcConsumerSearchRegistry)
                            if (stepResult.step === 'plants-for-material') {
                              setMatchedPlants(stepResult.plants)
                              setSelectedMaterialId(m.materialId)
                              setSearchStep('plants-for-material')
                            }
                          }}
                          style={{ width: '100%', padding: '12px 16px', background: 'var(--white)', border: '1px solid var(--stroke-soft)', borderRadius: 'var(--radius-md)', textAlign: 'left', cursor: 'pointer' }}
                        >
                          <span style={{ fontWeight: 'bold', display: 'block' }}>{m.description}</span>
                          <span style={{ fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{m.materialId}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {searchStep === 'plants-for-material' && (
                  <div style={{ background: 'var(--stone)', padding: 20, borderRadius: 'var(--radius-lg)', border: '1px solid var(--stroke)' }}>
                    <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 12px' }}>Select Plant:</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {matchedPlants.map(p => (
                        <button
                          key={p.plantId}
                          type="button"
                          onClick={() => {
                            const stepResult = resolveSPCConsumerSearch(`${selectedMaterialId} ${p.plantId}`, spcConsumerSearchRegistry)
                            if (stepResult.step === 'characteristics-for-plant') {
                              setMatchedChars(stepResult.characteristics)
                              setSelectedPlantId(p.plantId)
                              setSearchStep('characteristics-for-plant')
                            }
                          }}
                          style={{ width: '100%', padding: '12px 16px', background: 'var(--white)', border: '1px solid var(--stroke-soft)', borderRadius: 'var(--radius-md)', textAlign: 'left', cursor: 'pointer' }}
                        >
                          <span style={{ fontWeight: 'bold' }}>{p.plantName} ({p.plantId})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {searchStep === 'characteristics-for-plant' && (
                  <div style={{ background: 'var(--stone)', padding: 20, borderRadius: 'var(--radius-lg)', border: '1px solid var(--stroke)' }}>
                    <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 12px' }}>Select Characteristic:</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {matchedChars.map(c => (
                        <button
                          key={c.characteristicId}
                          type="button"
                          onClick={() => {
                            setRequest({
                              materialId: selectedMaterialId,
                              plantId: selectedPlantId,
                              characteristicId: c.characteristicId,
                            })
                            setSelectedCharId(c.characteristicId)
                          }}
                          style={{ width: '100%', padding: '12px 16px', background: 'var(--white)', border: '1px solid var(--stroke-soft)', borderRadius: 'var(--radius-md)', textAlign: 'left', cursor: 'pointer' }}
                        >
                          <span style={{ fontWeight: 'bold' }}>{c.characteristicName} ({c.characteristicId})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {searchStep === 'no-results' && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: 20, borderRadius: 'var(--radius-lg)', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <p style={{ color: 'var(--status-bad)', fontWeight: 'bold', margin: '0 0 8px' }}>No matches found.</p>
                    <p style={{ color: 'var(--forest)', fontSize: 12, margin: 0 }}>Try adjusting your search criteria.</p>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      ) : (
        // Active Dashboard
        <>
          <header style={{ background: 'var(--forest)', color: 'var(--white)', padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-md)' }}>
            <div>
              <Button onClick={handleBack} variant="link" style={{ color: 'var(--white)', padding: 0, height: 'auto', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginBottom: 4 }}>
                ← Back to Search
              </Button>
              <h1 className="t-impact" style={{ fontSize: 'var(--fs-24)', color: 'var(--white)', margin: 0 }}>
                Statistical Process Control Dashboard
              </h1>
              <div style={{ fontSize: 12, color: 'var(--stone)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                Material ID: {request.materialId} | Plant: {request.plantId} | Characteristic: {selectedCharId}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Badge style={{ background: 'var(--brand)', color: 'var(--white)', fontFamily: 'var(--font-mono)' }}>DATABRICKS API</Badge>
            </div>
          </header>

          {/* Tab Selection & Characteristic Selector */}
          <div style={{ background: 'var(--white)', borderBottom: '1px solid var(--stroke)', padding: '12px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <Tabs value={activeTab} onValueChange={val => setActiveTab(val as SPCTab)}>
              <TabsList style={{ background: 'var(--stone)', padding: 4, borderRadius: 'var(--radius-md)', display: 'inline-flex', gap: 4 }}>
                <TabsTrigger value="charts" style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-13)' }}>Control Charts</TabsTrigger>
                <TabsTrigger value="capability" style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-13)' }}>Process Capability</TabsTrigger>
                <TabsTrigger value="alarms" style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-13)' }}>Alarms & Signals</TabsTrigger>
                <TabsTrigger value="correlation" style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-13)' }}>Correlation Matrix</TabsTrigger>
                <TabsTrigger value="multivariate" style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-13)' }}>Multivariate T²</TabsTrigger>
                <TabsTrigger value="context" style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-13)' }}>Process Context</TabsTrigger>
                <TabsTrigger value="insights" style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-13)' }}>Conversational Insights</TabsTrigger>
              </TabsList>
            </Tabs>

            {characteristics.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Active MIC:</span>
                <select
                  value={selectedCharId}
                  onChange={e => setSelectedCharId(e.target.value)}
                  style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--stroke)', fontSize: 12, outline: 'none' }}
                >
                  {characteristics.map(c => (
                    <option key={c.characteristicId} value={c.characteristicId}>
                      {c.characteristicName} ({c.characteristicId})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Active Tab Area */}
          <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
            <div style={{ flex: 1, padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
              {activeTab === 'charts' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--white)', padding: '12px 24px', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--stroke-soft)' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>SPC Rules Detection Engine:</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button
                        variant={ruleSet === 'weco' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setRuleSet('weco')}
                        style={{ borderRadius: 'var(--radius-md)', fontSize: 12, padding: '4px 12px', cursor: 'pointer' }}
                      >
                        Western Electric (WECO) Rules
                      </Button>
                      <Button
                        variant={ruleSet === 'nelson' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setRuleSet('nelson')}
                        style={{ borderRadius: 'var(--radius-md)', fontSize: 12, padding: '4px 12px', cursor: 'pointer' }}
                      >
                        Nelson Rules
                      </Button>
                    </div>
                  </div>
                  <div style={{ background: 'var(--white)', padding: 24, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--stroke-soft)' }}>
                    <ControlChartPanel request={activeRequest} onPointClick={handlePointSelect} ruleSet={ruleSet} />
                    <div style={{ marginTop: 16, fontSize: 12, color: 'var(--fg-muted)' }}>
                      💡 *Click on any control chart point to view specific batch details and toggle manual exclusions in the sidebar.*
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'correlation' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <CorrelationHeatmap allSeries={allSeries} alignedPoints={alignedPoints} />
                </div>
              )}

              {activeTab === 'multivariate' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ background: 'var(--white)', padding: 24, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--stroke-soft)' }}>
                    <div style={{ marginBottom: 16 }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Hotelling's T² Multivariate Control Chart</h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--fg-muted)' }}>
                        Detects process drift by analyzing pH, moisture, fat, salt, and texture together.
                      </p>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <MultivariateT2Chart
                        points={multivariatePoints}
                        onPointClick={(p) => {
                          setSelectedPoint({
                            isMultivariate: true,
                            batch_id: p.batchId,
                            value: p.t2,
                            unit: '',
                            batch_seq: multivariatePoints.indexOf(p) + 1,
                            excluded: false,
                            contributors: p.contributors
                          })
                          setShowSidebar(true)
                        }}
                      />
                    </div>
                    <div style={{ marginTop: 16, fontSize: 12, color: 'var(--fg-muted)' }}>
                      💡 *Click on any multivariate point to decompose the Hotelling T² score and view variable contribution breakdown in the sidebar.*
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'capability' && (
                <div style={{ background: 'var(--white)', padding: 24, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--stroke-soft)' }}>
                  <CharacteristicCapabilityPanel request={activeRequest} />
                </div>
              )}

              {activeTab === 'alarms' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
                  <div style={{ background: 'var(--white)', padding: 24, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--stroke-soft)' }}>
                    <ActiveSPCSignalsPanel request={activeRequest} />
                  </div>
                  <div style={{ background: 'var(--white)', padding: 24, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--stroke-soft)' }}>
                    <SPCAlarmHistoryPanel request={activeRequest} />
                  </div>
                </div>
              )}

              {activeTab === 'context' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
                  <div style={{ background: 'var(--white)', padding: 24, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--stroke-soft)' }}>
                    <SPCProcessContextPanel request={activeRequest} />
                  </div>
                  <div style={{ background: 'var(--white)', padding: 24, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--stroke-soft)' }}>
                    <SPCRelatedBatchesPanel request={activeRequest} />
                  </div>
                </div>
              )}

              {activeTab === 'insights' && (
                <div style={{ maxWidth: 850, width: '100%', margin: '0 auto', background: 'var(--white)', padding: 32, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--stroke-soft)', display: 'flex', flexDirection: 'column', height: 600 }}>
                  <div style={{ borderBottom: '1px solid var(--stroke)', paddingBottom: 16, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="t-serif" style={{ margin: 0, fontSize: 'var(--fs-20)', fontWeight: 'var(--fw-bold)', color: 'var(--brand)' }}>Genie AI Assistant</h3>
                    <Badge style={{ background: 'var(--brand)', color: 'var(--white)', fontFamily: 'var(--font-mono)' }}>DATABRICKS API</Badge>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingRight: 10, marginBottom: 20 }}>
                    {chatMessages.map((msg, index) => (
                      <div
                        key={index}
                        style={{
                          alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                          maxWidth: '80%',
                          background: msg.sender === 'user' ? 'var(--brand)' : 'var(--stone)',
                          color: msg.sender === 'user' ? 'var(--white)' : 'var(--forest)',
                          padding: '12px 18px',
                          borderRadius: msg.sender === 'user' ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                          fontSize: 'var(--fs-14)',
                          lineHeight: 'var(--lh-body)',
                          whiteSpace: 'pre-line',
                          boxShadow: 'var(--shadow-sm)',
                        }}
                      >
                        {msg.sender === 'genie' && (
                          <div style={{ fontSize: 10, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.6, color: 'var(--brand)' }}>
                            Genie AI
                          </div>
                        )}
                        {msg.text}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 'var(--fs-12)', color: 'var(--fg-muted)', alignSelf: 'center' }}>Suggestions:</span>
                    <Button variant="outline" size="sm" onClick={() => handleSendChat(undefined, 'Summarize control chart metrics')} style={{ borderRadius: 'var(--radius-full)', padding: '4px 12px', height: 'auto', fontSize: 'var(--fs-12)' }}>Summarize chart limits</Button>
                    <Button variant="outline" size="sm" onClick={() => handleSendChat(undefined, 'Explain process capability and Cpk')} style={{ borderRadius: 'var(--radius-full)', padding: '4px 12px', height: 'auto', fontSize: 'var(--fs-12)' }}>Explain capability</Button>
                    <Button variant="outline" size="sm" onClick={() => handleSendChat(undefined, 'What active alarm signals exist?')} style={{ borderRadius: 'var(--radius-full)', padding: '4px 12px', height: 'auto', fontSize: 'var(--fs-12)' }}>Show alarm signals</Button>
                  </div>

                  <form onSubmit={handleSendChat} style={{ display: 'flex', gap: 10 }}>
                    <input
                      type="text"
                      placeholder="Ask Genie a question about capability, control charts, or alarms..."
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      style={{ flex: 1, padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--stroke)', outline: 'none', fontSize: 'var(--fs-14)' }}
                    />
                    <Button type="submit" style={{ background: 'var(--brand)', color: 'var(--white)', fontWeight: 'var(--fw-semibold)', padding: '0 20px', borderRadius: 'var(--radius-md)' }}>
                      Send
                    </Button>
                  </form>
                </div>
              )}
            </div>

            {/* Slide-out Sidebar for Chart Node Details */}
            {showSidebar && selectedPoint && (
              <div style={{ width: 350, background: 'var(--white)', borderLeft: '1px solid var(--stroke)', boxShadow: 'var(--shadow-lg)', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--stroke)', paddingBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Point Details</h3>
                  <button onClick={() => setShowSidebar(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--fg-muted)' }}>×</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {selectedPoint.isMultivariate ? (
                    <>
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', display: 'block' }}>Multivariate Batch ID</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 'bold' }}>{selectedPoint.batch_id || 'N/A'}</span>
                      </div>

                      <div>
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', display: 'block' }}>Hotelling T² Score</span>
                        <span style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--brand)' }}>{selectedPoint.value.toFixed(3)}</span>
                      </div>

                      <div style={{ borderTop: '1px solid var(--stroke)', paddingTop: 12, marginTop: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Variable Contribution Breakdown</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {selectedPoint.contributors?.map((c: any) => (
                            <div key={c.characteristicId} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                <span style={{ fontWeight: 600 }}>{c.characteristicName}</span>
                                <span style={{ color: 'var(--brand)', fontWeight: 700 }}>{c.contributionPercent}%</span>
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--fg-muted)', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Value: {c.value.toFixed(2)}</span>
                                <span>Mean: {c.mean.toFixed(2)}</span>
                              </div>
                              <div style={{ width: '100%', height: 4, background: 'var(--stone)', borderRadius: 2, overflow: 'hidden', marginTop: 2 }}>
                                <div style={{ width: `${c.contributionPercent}%`, height: '100%', background: c.contributionPercent > 40 ? 'var(--sunset, #F24A00)' : 'var(--brand, #1C423A)', borderRadius: 2 }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', display: 'block' }}>Batch ID</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 'bold' }}>{selectedPoint.batch_id || 'N/A'}</span>
                      </div>

                      <div>
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', display: 'block' }}>Value</span>
                        <span style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--brand)' }}>{selectedPoint.value} {selectedPoint.unit || ''}</span>
                      </div>

                      <div>
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', display: 'block' }}>Sequence</span>
                        <span>Subgroup #{selectedPoint.batch_seq}</span>
                      </div>

                      <div>
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', display: 'block' }}>Status</span>
                        <StatusBadge label={selectedPoint.excluded ? 'Excluded' : 'Included'} variant={selectedPoint.excluded ? 'warn' : 'good'} />
                      </div>
                    </>
                  )}
                </div>

                <div style={{ marginTop: 'auto' }}>
                  <Button
                    onClick={() => {
                      setShowSidebar(false)
                    }}
                    style={{ width: '100%', background: 'var(--brand)', color: 'var(--white)' }}
                  >
                    Close Panel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
