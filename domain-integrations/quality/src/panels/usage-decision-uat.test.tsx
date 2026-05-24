import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QualityReadonlyEvidencePanel } from './quality-readonly-evidence-panel.js'
import { expectNoForbiddenClaims } from '@connectio/evidence-panel-runtime/test-utils'
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
          sourceSystems: ['SAP QM'],
        },
        fetchedAt: new Date().toISOString(),
        source: 'mock',
      },
      isLoading: false,
    } as any)

    const { container } = render(
      <QualityReadonlyEvidencePanel request={{ investigationId: 'INV-1', batchId: 'BATCH-001' }} />,
    )

    // Verify it doesn't leak forbidden claims like "safe" or "approved"
    expectNoForbiddenClaims(container)

    // Check that 'unknown' is rendered
    expect(container.textContent?.toLowerCase()).toContain('unknown')
  })
})
