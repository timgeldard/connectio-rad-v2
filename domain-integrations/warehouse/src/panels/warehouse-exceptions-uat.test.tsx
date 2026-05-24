import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { WarehouseReconciliationExceptionsPanel } from './warehouse-reconciliation-exceptions-panel.js'
import { expectNoForbiddenClaims } from '@connectio/test-support'
import * as queries from '../adapters/warehouse-360-queries.js'

vi.mock('../adapters/warehouse-360-queries.js', () => ({
  useWarehouseExceptions: vi.fn(),
}))

describe('Warehouse exceptions (Offline UAT Smoke Check)', () => {
  it('renders truthfully with null severity and prevents forbidden claims', () => {
    vi.mocked(queries.useWarehouseExceptions).mockReturnValue({
      data: {
        ok: true,
        data: [
          {
            exceptionId: 'EXC-1',
            exceptionType: 'reconciliation',
            // Critical: test null severity
            severity: null,
            status: 'open',
            resolution: 'pending',
            ageHours: 12.5,
            createdAt: '2026-05-24T12:00:00Z',
          },
        ],
        fetchedAt: new Date().toISOString(),
        source: 'mock',
      },
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const { container } = render(
      <WarehouseReconciliationExceptionsPanel request={{ warehouseId: 'WH01', plantId: 'P001' }} />,
    )

    // Verify it doesn't leak forbidden claims like "safe" or "low risk"
    expectNoForbiddenClaims(container)

    // Check that 'unavailable' or similar fallback is rendered for null severity
    // It should not default to 'low'.
    expect(container.textContent?.toLowerCase()).not.toContain('low')
    expect(container.textContent?.toLowerCase()).not.toContain('low')
  })
})
