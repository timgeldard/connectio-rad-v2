import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { setFeatureFlags } from '@connectio/feature-flags'
import { ReleaseActionsPanel } from './release-actions-panel.js'
import type { BatchReleaseContext } from '@connectio/data-contracts'

const mockContext: BatchReleaseContext = {
  batchId: 'BATCH123',
  materialId: 'MAT123',
  plantId: 'IE10',
  status: 'pending',
  usageDecision: null,
  releasedAt: null,
  releasedBy: null,
}

describe('ReleaseActionsPanel Write-Back Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setFeatureFlags({})
  })

  it('renders disabled buttons and warning message when write-back feature flag is false', () => {
    setFeatureFlags({
      'writeBack.qualityReleaseAction': false,
    })

    render(<ReleaseActionsPanel context={mockContext} />)

    // Check warning message
    expect(screen.getByText('Write-back actions disabled by configuration.')).toBeDefined()

    // Verify all primary action buttons are disabled
    const releaseBtn = screen.getByLabelText('Release Batch') as HTMLButtonElement
    const holdBtn = screen.getByLabelText('Place on Hold') as HTMLButtonElement
    const retestBtn = screen.getByLabelText('Request Retest') as HTMLButtonElement
    const escalateBtn = screen.getByLabelText('Escalate Deviation') as HTMLButtonElement
    const traceBtn = screen.getByLabelText('Open Trace Investigation') as HTMLButtonElement

    expect(releaseBtn.disabled).toBe(true)
    expect(holdBtn.disabled).toBe(true)
    expect(retestBtn.disabled).toBe(true)
    expect(escalateBtn.disabled).toBe(true)
    expect(traceBtn.disabled).toBe(true)
  })

  it('renders enabled buttons and no warning when write-back feature flag is true', () => {
    setFeatureFlags({
      'writeBack.qualityReleaseAction': true,
    })

    render(<ReleaseActionsPanel context={mockContext} />)

    // Check no warning message is present
    expect(screen.queryByText('Write-back actions disabled by configuration.')).toBeNull()

    // Verify action buttons are enabled
    const releaseBtn = screen.getByLabelText('Release Batch') as HTMLButtonElement
    const holdBtn = screen.getByLabelText('Place on Hold') as HTMLButtonElement
    const retestBtn = screen.getByLabelText('Request Retest') as HTMLButtonElement
    const escalateBtn = screen.getByLabelText('Escalate Deviation') as HTMLButtonElement
    const traceBtn = screen.getByLabelText('Open Trace Investigation') as HTMLButtonElement

    expect(releaseBtn.disabled).toBe(false)
    expect(holdBtn.disabled).toBe(false)
    expect(retestBtn.disabled).toBe(false)
    expect(escalateBtn.disabled).toBe(false)
    expect(traceBtn.disabled).toBe(false)
  })
})
