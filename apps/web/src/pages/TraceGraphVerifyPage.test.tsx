import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TraceGraphVerifyPage } from './TraceGraphVerifyPage.js'

const mockPanel = vi.fn()

vi.mock('@connectio/di-traceability', () => ({
  TraceGraphPanel: (props: { request: { materialId?: string; batchId?: string; plantId?: string } }) => {
    mockPanel(props.request)
    return (
      <div
        data-testid="trace-graph-panel"
        data-material-id={props.request.materialId}
        data-batch-id={props.request.batchId}
        data-plant-id={props.request.plantId}
      />
    )
  },
}))

describe('TraceGraphVerifyPage', () => {
  beforeEach(() => {
    mockPanel.mockClear()
  })

  it('renders material, batch, and plant text inputs with default test values', () => {
    render(<TraceGraphVerifyPage />)
    const materialInput = screen.getByTestId('input-material-id') as HTMLInputElement
    const batchInput = screen.getByTestId('input-batch-id') as HTMLInputElement
    const plantInput = screen.getByTestId('input-plant-id') as HTMLInputElement
    expect(materialInput).not.toBeNull()
    expect(batchInput).not.toBeNull()
    expect(plantInput).not.toBeNull()
    expect(materialInput.value).toBe('000000000020052009')
    expect(batchInput.value).toBe('0008602411')
    expect(plantInput.value).toBe('C061')
    expect(screen.getByTestId('btn-run-trace')).not.toBeNull()
  })

  it('does not render the graph panel before submit', () => {
    render(<TraceGraphVerifyPage />)
    expect(screen.queryByTestId('trace-graph-panel')).toBeNull()
    expect(mockPanel).not.toHaveBeenCalled()
  })

  it('submitting the form triggers getTraceGraph with the entered values', () => {
    render(<TraceGraphVerifyPage />)
    fireEvent.click(screen.getByTestId('btn-run-trace'))
    expect(mockPanel).toHaveBeenCalledWith({
      investigationId: '',
      materialId: '000000000020052009',
      batchId: '0008602411',
      plantId: 'C061',
    })
  })

  it('success path: renders the graph panel after submit', () => {
    render(<TraceGraphVerifyPage />)
    fireEvent.click(screen.getByTestId('btn-run-trace'))
    expect(screen.getByTestId('trace-graph-panel')).not.toBeNull()
  })

  it('error path: renders only the panel after submit with no additional result content', () => {
    render(<TraceGraphVerifyPage />)
    fireEvent.click(screen.getByTestId('btn-run-trace'))
    // The page adds no fallback/alternative result content — only TraceGraphPanel
    // Panel error handling (no mock on failure) is tested in trace-graph-panel.test.tsx
    const page = screen.getByTestId('trace-graph-verify-page')
    const panelCount = page.querySelectorAll('[data-testid="trace-graph-panel"]').length
    expect(panelCount).toBe(1)
    // No second result container besides the panel
    expect(page.querySelectorAll('[data-testid]').length).toBeLessThanOrEqual(5)
  })

  it('empty path: delegates no-results rendering to TraceGraphPanel', () => {
    // The verify page passes the submitted request directly to TraceGraphPanel
    // and adds no alternative content. Panel empty-state is tested in trace-graph-panel.test.tsx.
    render(<TraceGraphVerifyPage />)
    fireEvent.click(screen.getByTestId('btn-run-trace'))
    const panel = screen.getByTestId('trace-graph-panel')
    expect(panel.getAttribute('data-material-id')).toBe('000000000020052009')
  })

  it('passes updated input values to the panel on re-submit', () => {
    render(<TraceGraphVerifyPage />)
    fireEvent.change(screen.getByTestId('input-material-id'), { target: { value: '000000000099999999' } })
    fireEvent.change(screen.getByTestId('input-batch-id'), { target: { value: 'TEST-BATCH' } })
    fireEvent.change(screen.getByTestId('input-plant-id'), { target: { value: 'C999' } })
    fireEvent.click(screen.getByTestId('btn-run-trace'))
    expect(mockPanel).toHaveBeenCalledWith({
      investigationId: '',
      materialId: '000000000099999999',
      batchId: 'TEST-BATCH',
      plantId: 'C999',
    })
  })
})
