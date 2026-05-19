import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { calculateConfidence, EvidenceConfidenceBadge } from './EvidenceConfidence.js'
import type {
  BatchHeaderSummary,
  CustomerExposureSummary,
  MassBalanceSummary,
  CoAReleaseStatus,
  SupplierExposureSummary,
  TraceGraph,
} from '@connectio/data-contracts'

describe('calculateConfidence', () => {
  const completeBatchHeader: BatchHeaderSummary = {
    materialId: 'MAT01',
    materialDescription: 'Material One',
    batchId: 'BATCH01',
    plantId: 'PLANT01',
    plantName: 'Plant One',
    batchStatus: 'active',
    processOrderId: 'PO01',
    quantity: 1000,
    uom: 'KG',
    stockStatus: 'unrestricted',
    qualityStatus: 'accepted',
    releaseStatus: 'released',
  }

  const completeCustomerExposure: CustomerExposureSummary = {
    shippedQuantity: 500,
    affectedDeliveries: 5,
    countries: ['Ireland', 'UK'],
    affectedCustomers: 3,
    highestSeverity: 'low',
    blockedDeliveries: 0,
    recallRecommended: false,
  }

  const completeMassBalance: MassBalanceSummary = {
    inputQuantity: 1000,
    outputQuantity: 1000,
    varianceQuantity: 0,
    variancePercent: 0,
    uom: 'KG',
    confidence: 1.0,
    unresolvedMovements: 0,
  }

  const completeCoARelease: CoAReleaseStatus = {
    coaAvailable: true,
    releaseStatus: 'released',
    usageDecision: 'accept',
    openQualityLots: 0,
    failedCharacteristics: 0,
    pendingResults: 0,
  }

  const completeSupplierExposure: SupplierExposureSummary = {
    supplierCount: 2,
    supplierLots: 4,
    highestRiskSupplier: 'Supp1',
    upstreamMaterials: 2,
    openSupplierActions: 0,
  }

  const completeTraceGraph: TraceGraph = {
    nodes: [],
    edges: [],
    direction: 'both',
    depth: 3,
    rootBatch: 'BATCH01',
    upstreamCount: 2,
    downstreamCount: 4,
    unresolvedNodeCount: 0,
  }

  it('calculates 100% score (COMPLETE) when all evidence sectors are perfect', () => {
    const result = calculateConfidence({
      batchHeader: completeBatchHeader,
      customerExposure: completeCustomerExposure,
      massBalance: completeMassBalance,
      coaRelease: completeCoARelease,
      supplierExposure: completeSupplierExposure,
      traceGraph: completeTraceGraph,
    })

    expect(result.grade).toBe('COMPLETE')
    expect(result.score).toBe(100)
    expect(result.gaps).toHaveLength(0)
  })

  it('returns a PARTIAL grade and identifies gaps when some sectors are partial or missing', () => {
    const incompleteBatchHeader = { ...completeBatchHeader, processOrderId: undefined }
    const partialCoARelease = { ...completeCoARelease, coaAvailable: false, releaseStatus: 'not-released' as const }

    const result = calculateConfidence({
      batchHeader: incompleteBatchHeader,
      customerExposure: completeCustomerExposure,
      massBalance: completeMassBalance,
      coaRelease: partialCoARelease,
      supplierExposure: completeSupplierExposure,
      traceGraph: null,
    })

    expect(result.grade).toBe('PARTIAL')
    expect(result.score).toBe(78) // 0 for lineage, 20 cust, 20 mb, 15 qual, 8 coa, 15 suppliers. Total: 20+20+15+8+15 = 78.
    expect(result.gaps).toContain('Missing upstream process order lineage trace.')
    expect(result.gaps).toContain('Certificate of Analysis is pending inspection release.')
  })

  it('returns an UNKNOWN grade when score is 0 due to critical missing datasets', () => {
    const result = calculateConfidence({
      batchHeader: null,
      customerExposure: null,
      massBalance: null,
      coaRelease: null,
      supplierExposure: null,
      traceGraph: null,
    })

    expect(result.grade).toBe('UNKNOWN')
    expect(result.score).toBe(0)
    expect(result.gaps).toHaveLength(4) // lineage, mb, quality, suppliers
  })
})

describe('EvidenceConfidenceBadge', () => {
  it('renders the badge details correctly', () => {
    render(
      <EvidenceConfidenceBadge
        result={{
          grade: 'COMPLETE',
          score: 100,
          gaps: [],
          details: {
            lineage: 'complete',
            customers: 'complete',
            massBalance: 'complete',
            quality: 'complete',
            coa: 'complete',
            suppliers: 'complete',
          },
        }}
      />
    )

    expect(screen.getByText('Evidence Confidence:')).not.toBeNull()
    expect(screen.getByText('100%')).not.toBeNull()
    expect(screen.getByText('(Complete)')).not.toBeNull()
  })
})
