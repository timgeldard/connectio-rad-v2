import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ControlChartPanel } from './control-chart-panel.js'
import { expectNoForbiddenClaims } from './test-utils.js'
import * as queries from '../adapters/spc-monitoring-queries.js'

vi.mock('../adapters/spc-monitoring-queries.js', () => ({
  useControlChartSeries: vi.fn(),
}))

describe('SPC chart data (Offline UAT Smoke Check)', () => {
  it('renders truthfully with not-evaluated point status and prevents forbidden claims', () => {
    vi.mocked(queries.useControlChartSeries).mockReturnValue({
      data: {
        ok: true,
        data: {
          seriesId: 'SPC-001',
          characteristicId: 'CHAR-1',
          characteristicName: 'Weight',
          chartType: 'individuals',
          uom: 'g',
          dataPoints: [
            {
              pointId: 'PT-1',
              timestamp: '2026-05-24T12:00:00Z',
              value: 100.5,
              batchId: 'BATCH-001',
              // Critical: test not-evaluated status
              pointStatus: 'not-evaluated',
              isOutlier: false,
              nelsonRuleViolations: [],
            },
          ],
          controlLimits: {
            ucl: 105,
            lcl: 95,
            target: 100,
            approved: false, // Ensure not explicitly approved
            locked: true,
          },
        },
        fetchedAt: new Date().toISOString(),
        source: 'mock',
      },
      isLoading: false,
    } as any)

    const { container } = render(
      <ControlChartPanel request={{ characteristicId: 'CHAR-1', plantId: 'P001' }} />,
    )

    // Verify it doesn't leak forbidden claims like "safe", "approved", or "in control"
    expectNoForbiddenClaims(container)

    // Check that 'not evaluated' or equivalent phrasing is rendered or preserved
    expect(container.textContent?.toLowerCase()).toContain('not-evaluated')
  })
})
