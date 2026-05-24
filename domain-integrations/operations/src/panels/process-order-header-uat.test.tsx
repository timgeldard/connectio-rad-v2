import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProcessOrderHeaderPanel } from './process-order-header-panel.js'
import { expectNoForbiddenClaims } from './test-utils.js'
import * as queries from '../adapters/process-order-review-queries.js'

vi.mock('../adapters/process-order-review-queries.js', () => ({
  useProcessOrderHeader: vi.fn(),
}))

describe('POH process-order header (Offline UAT Smoke Check)', () => {
  it('renders truthfully with unknown status and prevents forbidden claims', () => {
    vi.mocked(queries.useProcessOrderHeader).mockReturnValue({
      data: {
        ok: true,
        data: {
          processOrderId: 'PO-10001',
          plantId: 'P001',
          materialId: 'MAT-123',
          materialDescription: 'Test Material',
          // Critical: test unknown status
          status: 'unknown',
          targetQuantity: 1000,
          deliveredQuantity: 500,
          uom: 'KG',
        },
        fetchedAt: new Date().toISOString(),
        source: 'mock',
      },
      isLoading: false,
    } as any)

    const { container } = render(
      <ProcessOrderHeaderPanel request={{ processOrderId: 'PO-10001', plantId: 'P001' }} />,
    )

    // Verify it doesn't leak forbidden claims like "safe" or "complete"
    expectNoForbiddenClaims(container)

    // Check that 'unknown' is rendered
    expect(container.textContent?.toLowerCase()).toContain('unknown')
  })
})
