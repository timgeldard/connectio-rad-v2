import { z } from 'zod'

const SeveritySchema = z.enum(['low', 'medium', 'high', 'critical'])

// ---------------------------------------------------------------------------
// ProcessOrderReviewContext
// ---------------------------------------------------------------------------

export const ProcessOrderReviewContextSchema = z.object({
  processOrderId: z.string(),
  materialId: z.string(),
  materialDescription: z.string(),
  batchId: z.string().optional(),
  plantId: z.string(),
  lineOrResource: z.string().optional(),
  orderStatus: z.enum(['created', 'released', 'in-process', 'confirmed', 'partially-confirmed', 'closed', 'cancelled']),
  qualityStatus: z.enum(['not-inspected', 'in-inspection', 'passed', 'failed', 'conditionally-released', 'on-hold']),
  stagingStatus: z.enum(['not-started', 'partial', 'fully-staged', 'blocked', 'not-required']),
  lastUpdatedAt: z.string().datetime(),
  activeScope: z.string().optional(),
  activeView: z.string().optional(),
})

export type ProcessOrderReviewContext = z.infer<typeof ProcessOrderReviewContextSchema>

// ---------------------------------------------------------------------------
// ProcessOrderHeader
// ---------------------------------------------------------------------------

export const ProcessOrderHeaderSchema = z.object({
  processOrderId: z.string(),
  orderType: z.enum(['process-order', 'production-order', 'maintenance-order', 'planned-order']),
  materialId: z.string(),
  materialDescription: z.string(),
  batchId: z.string().optional(),
  plantId: z.string(),
  productionLine: z.string().optional(),
  plannedQuantity: z.number().min(0),
  confirmedQuantity: z.number().min(0),
  scrapQuantity: z.number().min(0).optional(),
  uom: z.string(),
  plannedStart: z.string().datetime(),
  plannedFinish: z.string().datetime(),
  actualStart: z.string().datetime().optional(),
  actualFinish: z.string().datetime().optional(),
  orderStatus: z.enum(['created', 'released', 'in-process', 'confirmed', 'partially-confirmed', 'closed', 'cancelled']),
})

export type ProcessOrderHeader = z.infer<typeof ProcessOrderHeaderSchema>

// ---------------------------------------------------------------------------
// OrderProgressSummary
// ---------------------------------------------------------------------------

export const OrderProgressSummarySchema = z.object({
  processOrderId: z.string(),
  progressPercent: z.number().min(0).max(100),
  operationsComplete: z.number().int().min(0),
  operationsTotal: z.number().int().min(0),
  confirmationsComplete: z.number().int().min(0),
  openConfirmations: z.number().int().min(0),
  currentOperation: z.string().optional(),
  delayMinutes: z.number().min(0),
  riskLevel: z.enum(['on-track', 'at-risk', 'delayed', 'blocked']),
  confidence: z.number().min(0).max(1),
})

export type OrderProgressSummary = z.infer<typeof OrderProgressSummarySchema>

// ---------------------------------------------------------------------------
// ExecutionTimelineItem
// ---------------------------------------------------------------------------

export const ExecutionTimelineItemSchema = z.object({
  eventId: z.string(),
  timestamp: z.string().datetime(),
  eventType: z.enum(['order-released', 'operation-started', 'operation-confirmed', 'goods-issued', 'deviation-raised', 'quality-inspection', 'staging-completed', 'order-confirmed', 'order-closed', 'alert']),
  title: z.string(),
  description: z.string(),
  sourceSystem: z.string(),
  actor: z.string().optional(),
  severity: SeveritySchema.optional(),
})

export type ExecutionTimelineItem = z.infer<typeof ExecutionTimelineItemSchema>

// ---------------------------------------------------------------------------
// OrderQualityContext
// ---------------------------------------------------------------------------

export const OrderQualityContextSchema = z.object({
  inspectionLotId: z.string().optional(),
  releaseCaseId: z.string().optional(),
  qualityStatus: z.enum(['not-inspected', 'in-inspection', 'passed', 'failed', 'conditionally-released', 'on-hold']),
  usageDecision: z.string().optional(),
  failedCharacteristics: z.number().int().min(0),
  openDeviations: z.number().int().min(0),
  spcSignals: z.number().int().min(0),
  releaseBlockers: z.array(z.string()),
})

export type OrderQualityContext = z.infer<typeof OrderQualityContextSchema>

// ---------------------------------------------------------------------------
// OrderStagingContext
// ---------------------------------------------------------------------------

export const OrderStagingContextSchema = z.object({
  processOrderId: z.string(),
  stagingStatus: z.enum(['not-started', 'partial', 'fully-staged', 'blocked', 'not-required']),
  componentsRequired: z.number().int().min(0),
  componentsStaged: z.number().int().min(0),
  missingComponents: z.number().int().min(0),
  blockedComponents: z.number().int().min(0),
  openTransferRequirements: z.number().int().min(0),
  readinessStatus: z.enum(['ready', 'partial', 'blocked', 'not-started']),
})

export type OrderStagingContext = z.infer<typeof OrderStagingContextSchema>

// ---------------------------------------------------------------------------
// RelatedBatchContext
// ---------------------------------------------------------------------------

export const RelatedBatchContextSchema = z.object({
  batchId: z.string(),
  materialId: z.string(),
  relationshipType: z.enum(['output', 'input-component', 'co-product', 'by-product', 'rework']),
  traceRisk: z.enum(['none', 'potential', 'confirmed']),
  qualityStatus: z.enum(['released', 'on-hold', 'rejected', 'under-review', 'awaiting-review']),
  stockStatus: z.enum(['unrestricted', 'blocked', 'in-transit', 'quality-inspection', 'restricted']),
  drillThroughTarget: z.string().optional(),
})

export type RelatedBatchContext = z.infer<typeof RelatedBatchContextSchema>

// ---------------------------------------------------------------------------
// ProcessOrderOperation
// ---------------------------------------------------------------------------

export const ProcessOrderOperationSchema = z.object({
  operationId: z.string(),
  operationNumber: z.string(),
  operationText: z.string(),
  workCentre: z.string(),
  resource: z.string().optional(),
  plannedStart: z.string().datetime(),
  plannedFinish: z.string().datetime(),
  actualStart: z.string().datetime().optional(),
  actualFinish: z.string().datetime().optional(),
  status: z.enum(['pending', 'in-progress', 'confirmed', 'skipped']),
  plannedDurationMinutes: z.number().min(0),
  actualDurationMinutes: z.number().min(0).optional(),
  confirmationStatus: z.enum(['unconfirmed', 'partially-confirmed', 'final-confirmed']),
  confirmed: z.boolean(),
  hasException: z.boolean(),
})

export type ProcessOrderOperation = z.infer<typeof ProcessOrderOperationSchema>

// ---------------------------------------------------------------------------
// ProcessOrderConfirmation
// ---------------------------------------------------------------------------

export const ProcessOrderConfirmationSchema = z.object({
  confirmationId: z.string(),
  operationId: z.string(),
  // Not in vw_gold_confirmation — re-require once gold view exposes PHASE_DESCRIPTION join (2026-05-17)
  operationText: z.string().optional(),
  confirmedYield: z.number().min(0),
  scrapQuantity: z.number().min(0).optional(),
  reworkQuantity: z.number().min(0).optional(),
  uom: z.string(),
  confirmedAt: z.string().datetime(),
  confirmedBy: z.string().optional(),
  // Not in vw_gold_confirmation — re-require once gold view exposes final-confirmation flag (2026-05-17)
  isFinalConfirmation: z.boolean().optional(),
  setupDurationMinutes: z.number().min(0).optional(),
  machineDurationMinutes: z.number().min(0).optional(),
  cleaningDurationMinutes: z.number().min(0).optional(),
  variancePercent: z.number().optional(),
})

export type ProcessOrderConfirmation = z.infer<typeof ProcessOrderConfirmationSchema>

// ---------------------------------------------------------------------------
// ProcessOrderGoodsMovement
// ---------------------------------------------------------------------------

export const ProcessOrderGoodsMovementSchema = z.object({
  movementId: z.string(),
  movementType: z.string(),
  direction: z.enum(['input', 'output']),
  materialId: z.string(),
  // Not in vw_gold_adp_movement — re-require once material master join is available (2026-05-17)
  materialDescription: z.string().optional(),
  batchId: z.string().optional(),
  quantity: z.number(),
  uom: z.string(),
  postedAt: z.string().datetime(),
  postedBy: z.string().optional(),
  referenceDocument: z.string().optional(),
  storageLocation: z.string().optional(),
})

export type ProcessOrderGoodsMovement = z.infer<typeof ProcessOrderGoodsMovementSchema>
