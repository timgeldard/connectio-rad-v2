import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { QualityReadOnlyEvidencePanel } from './quality-readonly-evidence-panel.js'
import { expectNoForbiddenClaims } from '@connectio/test-support'
import * as queries from '../adapters/quality-readonly-evidence-queries.js'

vi.mock('../adapters/quality-readonly-evidence-queries.js', () => ({
  useQualityReadOnlyEvidence: vi.fn(),
}))

describe('Quality usage decision evidence (Offline UAT Smoke Check)', () => {
  it('renders unknown usage decision truthfully and prevents forbidden claims', () => {
    vi.mocked(queries.useQualityReadOnlyEvidence).mockReturnValue({
      data: {
        ok: true,
        data: {
          batchId: 'BATCH-001',
          materialId: 'MAT-123',
          materialName: 'Test Material',
          plantId: 'P001',
          summary: {
            lotCount: 1,
            inspectionLotCount: 1,
            micResultCount: 0,
            coaResultCount: 0,
            unavailableEvidence: [],
            warnings: [],
            evidenceState: 'unknown',
            status: 'unknown',
            usageDecisionStatus: 'unknown',
          },
          inspectionLots: [
            {
              inspectionLotId: 'LOT-1',
              inspectionType: '04',
              // Test that unknown code remains unknown/unverified
              usageDecisionCode: 'unknown',
              usageDecisionCodeText: 'Unknown Decision',
              usageDecisionCodeGroup: 'UD',
              usageDecisionDate: null,
              usageDecisionValuation: 'unknown',
              systemStatus: 'REL',
              userStatus: null,
            },
          ],
          micResults: [],
          coaResults: [],
          sourceSystems: ['SAP QM'],
        },
        fetchedAt: new Date().toISOString(),
        source: 'mock',
      },
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const { container } = render(
      <QualityReadOnlyEvidencePanel request={{ inspectionLotId: '1000123' }} />,
    )

    // Verify it doesn't leak forbidden claims like "safe" or "approved"
    // 'released' is allowed here because the truthful warning says "must not be interpreted as ... released"
    expectNoForbiddenClaims(container, ['released'])

    // Check that 'unknown' is rendered
    expect(container.textContent?.toLowerCase()).toContain('unknown')

    // Explicitly check for forbidden words related to batch release
    const textContent = container.textContent?.toLowerCase() || ''
    expect(textContent).not.toContain('batch approved')
    // We expect 'released' only in the truthful warning context
    expect(textContent).toMatch(/not be interpreted as accepted, released/i)
    expect(textContent).not.toContain('safe')
    expect(textContent).not.toContain('cleared for shipment')
    expect(textContent).not.toContain('signed off')
  })

  it('renders multiple-lot warning when multiple lots are present', () => {
    vi.mocked(queries.useQualityReadOnlyEvidence).mockReturnValue({
      data: {
        ok: true,
        data: {
          batchId: 'BATCH-002',
          materialId: 'MAT-123',
          materialName: 'Test Material',
          plantId: 'P001',
          summary: {
            lotCount: 2,
            inspectionLotCount: 2,
            micResultCount: 0,
            coaResultCount: 0,
            unavailableEvidence: [],
            warnings: [],
            evidenceState: 'multipleLots',
            status: 'multipleLots',
            usageDecisionStatus: 'unknown',
          },
          inspectionLots: [
            {
              inspectionLotId: 'LOT-1',
              inspectionType: '04',
              usageDecisionCode: 'A',
              usageDecisionCodeText: 'Accepted',
              usageDecisionCodeGroup: 'UD',
              usageDecisionDate: '2026-05-24',
              usageDecisionValuation: 'accepted',
              systemStatus: 'REL',
              userStatus: null,
            },
            {
              inspectionLotId: 'LOT-2',
              inspectionType: '04',
              usageDecisionCode: 'unknown',
              usageDecisionCodeText: 'Unknown Decision',
              usageDecisionCodeGroup: 'UD',
              usageDecisionDate: null,
              usageDecisionValuation: 'unknown',
              systemStatus: 'CRTD',
              userStatus: null,
            },
          ],
          micResults: [],
          coaResults: [],
          sourceSystems: ['SAP QM'],
        },
        fetchedAt: new Date().toISOString(),
        source: 'mock',
      },
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const { container } = render(
      <QualityReadOnlyEvidencePanel request={{ batchId: 'BATCH-002', plantId: 'P001' }} />,
    )

    const textContent = container.textContent || ''
    expect(textContent).toMatch(/multiple inspection lots/i)
  })
})
