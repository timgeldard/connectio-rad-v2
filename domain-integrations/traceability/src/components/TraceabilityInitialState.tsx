import React from 'react'

interface EvidenceStatus {
  readonly name: string
  readonly status: 'live' | 'mock' | 'planned' | 'unavailable' | 'unknown'
  readonly description: string
}

export interface TraceabilityInitialStateProps {
  onLoadCandidate: () => void
  adapterMode: string
  children?: React.ReactNode
}

export function TraceabilityInitialState({ onLoadCandidate, adapterMode, children }: TraceabilityInitialStateProps) {
  const evidenceSlices: EvidenceStatus[] = [
    { name: 'Batch Header', status: 'live', description: 'Partially live-verified field mapping.' },
    { name: 'Trace Graph', status: 'live', description: 'Native Databricks path; validation pending.' },
    { name: 'Mass Balance', status: 'mock', description: 'High-fidelity simulation; live verification pending.' },
    { name: 'Customer Exposure', status: 'unavailable', description: 'Planned; requires depth-slice validation.' },
    { name: 'Quality / CoA', status: 'mock', description: 'Mock-fixtures; source QM alignment pending.' },
    { name: 'Risk Signals', status: 'mock', description: 'Rule-engine simulation.' }
  ]

  const statusColors: Record<EvidenceStatus['status'], string> = {
    live: 'var(--shell-good, #1F8B4C)',
    mock: 'var(--shell-warn, #C7821C)',
    planned: 'var(--shell-fg-3)',
    unavailable: 'var(--shell-bad, #C73315)',
    unknown: 'var(--shell-fg-3)'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 900, margin: '0 auto', padding: '40px 20px' }}>
      {/* Hero / Intro */}
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 700, margin: '0 0 12px 0', color: 'var(--shell-fg)' }}>Trace a batch</h1>
        <p style={{ fontSize: '16px', color: 'var(--shell-fg-2)', lineHeight: 1.6, maxWidth: 700, margin: '0 auto' }}>
          Start a read-only trace investigation by entering a material, batch, and plant. 
          The workspace will assemble batch header, lineage, mass-balance, customer exposure, 
          quality, and risk evidence where available.
        </p>
      </div>

      {/* Input Card (TraceQueryForm) */}
      <div>
        {children}
      </div>

      {/* Readiness Strip */}
      <div style={{ 
        background: 'var(--shell-surface-2)', 
        border: '1px solid var(--shell-line)', 
        borderRadius: '8px', 
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 20,
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--shell-fg-3)' }}>Source Readiness:</span>
          <div style={{ display: 'flex', gap: 8, fontSize: '12px' }}>
             <span style={{ color: 'var(--shell-fg-2)' }}>Mode: <strong>{adapterMode}</strong></span>
             <span style={{ color: 'var(--shell-fg-3)' }}>|</span>
             <span style={{ color: 'var(--shell-fg-2)' }}>Header: <span style={{ color: statusColors.live }}>Live (Partial)</span></span>
             <span style={{ color: 'var(--shell-fg-3)' }}>|</span>
             <span style={{ color: 'var(--shell-fg-2)' }}>Exposure: <span style={{ color: statusColors.unavailable }}>Unavailable</span></span>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: '11px', color: 'var(--shell-fg-3)', maxWidth: 400 }}>
          Source readiness is mixed. Batch-header field mapping has live Databricks verification; 
          customer exposure and QM release decisions remain pending source validation.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
        {/* Evidence Preview Card */}
        <div style={{ background: 'var(--shell-surface)', border: '1px solid var(--shell-line)', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 16px 0' }}>Evidence Preview</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {evidenceSlices.map(slice => (
              <div key={slice.name} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 500 }}>{slice.name}</span>
                  <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: statusColors[slice.status] }}>{slice.status}</span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--shell-fg-3)' }}>{slice.description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* UAT Candidate Card */}
        <div style={{ background: 'var(--shell-surface)', border: '1px solid var(--shell-line)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 12px 0' }}>UAT Candidate</h2>
            <p style={{ fontSize: '13px', color: 'var(--shell-fg-2)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Load known <strong>C061</strong> UAT candidate for validation. Expected results must be 
              verified against golden-test-batches.md and the UAT validation ledger before claiming a pass.
            </p>
            <div style={{ fontSize: '12px', fontFamily: 'monospace', background: 'var(--shell-surface-2)', padding: '10px', borderRadius: '4px', color: 'var(--shell-fg-2)', marginBottom: 20 }}>
              Material: 20035129<br />
              Batch: 8000049668<br />
              Plant: C061
            </div>
          </div>
          <button 
            onClick={onLoadCandidate}
            style={{ 
              width: '100%', 
              padding: '10px', 
              background: 'var(--shell-surface-2)', 
              border: '1px solid var(--shell-line)', 
              borderRadius: '6px', 
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Load UAT Candidate
          </button>
        </div>
      </div>

      {/* Safety / Readiness Note */}
      <div style={{ 
        background: 'rgba(199, 51, 21, 0.05)', 
        border: '1px solid rgba(199, 51, 21, 0.2)', 
        borderRadius: '8px', 
        padding: '16px',
        display: 'flex',
        gap: 16
      }}>
        <span style={{ fontSize: '20px' }}>⚠️</span>
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--shell-bad, #C73315)', margin: '0 0 4px 0' }}>Safety & Readiness Notice</h3>
          <p style={{ fontSize: '12px', color: 'var(--shell-fg-2)', lineHeight: 1.5, margin: 0 }}>
            This workspace is read-only. Some evidence slices are still pending live validation. 
            <strong> Unavailable evidence means the slice could not be confirmed from the current source. 
            It must not be interpreted as zero exposure, no risk, or release approval.</strong> 
            Unknown or unavailable exposure data must not be interpreted as no exposure.
          </p>
        </div>
      </div>

      {/* UAT Evidence Checklist */}
      <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 12px 0', color: 'var(--shell-fg-3)' }}>UAT Evidence Checklist</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
          {[
            'Deployed commit SHA',
            'Adapter mode',
            'Source badges',
            'Material / Batch / Plant',
            'Batch header values',
            'Graph node/edge counts',
            'Mass-balance confidence',
            'Customer exposure state',
            'Quality status state'
          ].map(item => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '12px', color: 'var(--shell-fg-3)' }}>
              <div style={{ width: 12, height: 12, border: '1px solid var(--shell-line)', borderRadius: '2px' }} />
              {item}
            </div>
          ))}
        </div>
        <p style={{ fontSize: '11px', color: 'var(--shell-fg-3)', marginTop: 12, fontStyle: 'italic' }}>
          Verify results against the UAT validation ledger before claiming a pass.
        </p>
      </div>
    </div>
  )
}
