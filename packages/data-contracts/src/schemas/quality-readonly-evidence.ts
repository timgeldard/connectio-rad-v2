import { z } from 'zod'

/**
 * Shared source attribution for read-only Quality evidence.
 *
 * `unavailable` and `unknown` are first-class values so callers do not need to
 * masquerade missing source verification as mock or live Databricks data.
 */
export const QualityEvidenceSourceSchema = z.enum([
  'mock',
  'legacy-api',
  'databricks-api',
  'unavailable',
  'unknown',
])

export type QualityEvidenceSource = z.infer<typeof QualityEvidenceSourceSchema>

/**
 * Section-level state for read-only Quality evidence.
 *
 * These values are intentionally evidence-oriented, not release-oriented.
 * `no-records` means no rows were returned by the queried source; it is not
 * proof that no source records exist elsewhere.
 */
export const QualityEvidenceStatusSchema = z.enum([
  'loaded',
  'no-records',
  'unavailable',
  'error',
  'mock',
  'pending-source-verification',
  'not-requested',
])

export type QualityEvidenceStatus = z.infer<typeof QualityEvidenceStatusSchema>

export const QualityUsageDecisionStatusSchema = z.enum([
  'source-present',
  'not-found',
  'source-unverified',
  'unavailable',
  'error',
  'not-requested',
])

export type QualityUsageDecisionStatus = z.infer<typeof QualityUsageDecisionStatusSchema>

export const QualityUsageDecisionMappingStatusSchema = z.enum([
  'source-only',
  'verified',
  'unverified',
  'unavailable',
  'not-mapped',
])

export type QualityUsageDecisionMappingStatus = z.infer<typeof QualityUsageDecisionMappingStatusSchema>

export const QualitySourceFreshnessStatusSchema = z.enum([
  'fresh',
  'stale',
  'unknown',
  'unavailable',
  'not-verified',
])

export type QualitySourceFreshnessStatus = z.infer<typeof QualitySourceFreshnessStatusSchema>

export const QualityCoaDocumentStatusSchema = z.enum(['unavailable', 'unknown'])

export type QualityCoaDocumentStatus = z.infer<typeof QualityCoaDocumentStatusSchema>

// ---------------------------------------------------------------------------
// QualityEvidenceRequest
// ---------------------------------------------------------------------------

export const QualityEvidenceRequestSchema = z.object({
  plantId: z.string().optional(),
  materialId: z.string().optional(),
  batchId: z.string().optional(),
  inspectionLotId: z.string().optional(),
  processOrderId: z.string().optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
}).strict()

export type QualityEvidenceRequest = z.infer<typeof QualityEvidenceRequestSchema>

// ---------------------------------------------------------------------------
// QualityInspectionLotEvidence
// ---------------------------------------------------------------------------

export const QualityInspectionLotEvidenceSchema = z.object({
  inspectionLotId: z.string(),
  inspectionType: z.string().optional().nullable(),
  inspectionLotStatus: z.string().optional().nullable(),
  materialId: z.string().optional().nullable(),
  batchId: z.string().optional().nullable(),
  plantId: z.string().optional().nullable(),
  processOrderId: z.string().optional().nullable(),
  createdAt: z.string().datetime().optional().nullable(),
  startedAt: z.string().datetime().optional().nullable(),
  completedAt: z.string().datetime().optional().nullable(),
  source: QualityEvidenceSourceSchema,
  /**
   * Per-lot usage decision evidence fields.
   *
   * These are raw source fields from `gold_inspection_usage_decision` joined to
   * the inspection lot. They are read-only evidence only — they do not represent
   * a batch-level release decision. Multiple lots per batch each carry their own
   * usage decision; no aggregation into a "batch decision" is performed.
   *
   * PROHIBITED: These fields must not be mapped to "Released", "Approved",
   * "Cleared", or "Can release" without a governed lot-selection rule.
   */
  usageDecisionCode: z.string().optional().nullable(),
  usageDecisionText: z.string().optional().nullable(),
  usageDecisionMappingStatus: QualityUsageDecisionMappingStatusSchema.optional().nullable(),
  usageDecisionCreatedAt: z.string().datetime().optional().nullable(),
}).strict()

export type QualityInspectionLotEvidence = z.infer<typeof QualityInspectionLotEvidenceSchema>

// ---------------------------------------------------------------------------
// QualityMicResultEvidence
// ---------------------------------------------------------------------------

/**
 * MIC / inspection-characteristic result evidence.
 *
 * Specification limits are product or inspection specifications. They are not
 * SPC control limits, and `resultStatus` is not a release approval state.
 */
export const QualityMicResultEvidenceSchema = z.object({
  micId: z.string().optional().nullable(),
  micCode: z.string().optional().nullable(),
  micName: z.string().optional().nullable(),
  characteristicId: z.string().optional().nullable(),
  resultValue: z.number().optional().nullable(),
  resultText: z.string().optional().nullable(),
  resultUnit: z.string().optional().nullable(),
  lowerSpecificationLimit: z.number().optional().nullable(),
  upperSpecificationLimit: z.number().optional().nullable(),
  targetValue: z.number().optional().nullable(),
  toleranceText: z.string().optional().nullable(),
  valuationCode: z.string().optional().nullable(),
  valuationText: z.string().optional().nullable(),
  resultStatus: z.enum(['pass', 'fail', 'warning', 'pending', 'unknown', 'not-evaluated']),
  sampleId: z.string().optional().nullable(),
  sampleDate: z.string().datetime().optional().nullable(),
  resultDate: z.string().datetime().optional().nullable(),
  method: z.string().optional().nullable(),
  source: QualityEvidenceSourceSchema,
}).strict()

export type QualityMicResultEvidence = z.infer<typeof QualityMicResultEvidenceSchema>

// ---------------------------------------------------------------------------
// QualityUsageDecisionEvidence
// ---------------------------------------------------------------------------

/**
 * Source display for SAP QM usage decision evidence.
 *
 * This contract carries raw source fields and a mapping status. It deliberately
 * avoids accepted/released/conditional release semantics.
 */
export const QualityUsageDecisionEvidenceSchema = z.object({
  usageDecisionCode: z.string().optional().nullable(),
  usageDecisionText: z.string().optional().nullable(),
  valuationCode: z.string().optional().nullable(),
  qualityScore: z.number().optional().nullable(),
  createdBy: z.string().optional().nullable(),
  createdAt: z.string().datetime().optional().nullable(),
  source: QualityEvidenceSourceSchema,
  mappingStatus: QualityUsageDecisionMappingStatusSchema,
}).strict()

export type QualityUsageDecisionEvidence = z.infer<typeof QualityUsageDecisionEvidenceSchema>

// ---------------------------------------------------------------------------
// QualityCoaResultEvidence
// ---------------------------------------------------------------------------

/**
 * CoA-like result evidence.
 *
 * `documentStatus` is limited to unavailable/unknown until a source proves
 * official CoA document approval, sign-off, versioning, or PDF availability.
 */
export const QualityCoaResultEvidenceSchema = z.object({
  micCode: z.string().optional().nullable(),
  micName: z.string().optional().nullable(),
  targetValue: z.number().optional().nullable(),
  toleranceRange: z.string().optional().nullable(),
  actualResult: z.number().optional().nullable(),
  resultStatus: z.string().optional().nullable(),
  withinSpec: z.string().optional().nullable(),
  deviationFromTarget: z.number().optional().nullable(),
  source: QualityEvidenceSourceSchema,
  documentStatus: QualityCoaDocumentStatusSchema,
}).strict()

export type QualityCoaResultEvidence = z.infer<typeof QualityCoaResultEvidenceSchema>

// ---------------------------------------------------------------------------
// QualityEvidenceSummary
// ---------------------------------------------------------------------------

export const QualityEvidenceSummarySchema = z.object({
  source: QualityEvidenceSourceSchema,
  status: QualityEvidenceStatusSchema,
  inspectionLotCount: z.number().int().min(0),
  micResultCount: z.number().int().min(0),
  usageDecisionStatus: QualityUsageDecisionStatusSchema,
  coaResultCount: z.number().int().min(0),
  unavailableEvidence: z.array(z.string()),
  warnings: z.array(z.string()),
  queriedAt: z.string().datetime(),
  sourceFreshnessStatus: QualitySourceFreshnessStatusSchema,
  /**
   * Extended state model fields.
   *
   * These carry expressive state-model states (from quality-readonly-evidence-state-model.md)
   * as strings rather than widening the strict `status` enum. They are optional so
   * existing adapters and fixtures remain schema-valid without modification.
   *
   * PROHIBITED: `evidenceState` must never be set to "released", "approved", "cleared",
   * or any value implying release authority. Only evidence-oriented states are valid.
   */
  evidenceState: z.string().optional(),
  sourceStatus: z.string().optional(),
  lotCount: z.number().int().min(0).optional(),
  multipleLotsWarning: z.string().optional(),
  missingLotWarning: z.string().optional(),
}).strict()

export type QualityEvidenceSummary = z.infer<typeof QualityEvidenceSummarySchema>

// ---------------------------------------------------------------------------
// QualityEvidenceResponse
// ---------------------------------------------------------------------------

export const QualityEvidenceResponseSchema = z.object({
  request: QualityEvidenceRequestSchema,
  summary: QualityEvidenceSummarySchema,
  inspectionLots: z.array(QualityInspectionLotEvidenceSchema),
  micResults: z.array(QualityMicResultEvidenceSchema),
  usageDecision: QualityUsageDecisionEvidenceSchema.optional().nullable(),
  coaResults: z.array(QualityCoaResultEvidenceSchema),
}).strict()

export type QualityEvidenceResponse = z.infer<typeof QualityEvidenceResponseSchema>
