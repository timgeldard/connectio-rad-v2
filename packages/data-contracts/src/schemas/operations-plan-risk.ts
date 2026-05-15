import { z } from 'zod'

const SeveritySchema = z.enum(['low', 'medium', 'high', 'critical'])

// ---------------------------------------------------------------------------
// OperationsPlanRiskContext
// ---------------------------------------------------------------------------

export const OperationsPlanRiskContextSchema = z.object({
  planDate: z.string().date(),
  plantId: z.string(),
  plantName: z.string(),
  lineIds: z.array(z.string()),
  shiftId: z.string(),
  supervisor: z.string(),
  riskStatus: z.enum(['on-track', 'at-risk', 'critical', 'unknown']),
  highestSeverity: SeveritySchema,
  openBlockers: z.number().int().min(0),
  lateOrders: z.number().int().min(0),
  materialShortages: z.number().int().min(0),
  qualityBlockers: z.number().int().min(0),
  stagingBlockers: z.number().int().min(0),
  maintenanceConstraints: z.number().int().min(0),
  lastUpdatedAt: z.string().datetime(),
  activeScope: z.string(),
  activeView: z.string(),
})

export type OperationsPlanRiskContext = z.infer<typeof OperationsPlanRiskContextSchema>

// ---------------------------------------------------------------------------
// PlanRiskSummary
// ---------------------------------------------------------------------------

export const PlanRiskSummarySchema = z.object({
  planDate: z.string().date(),
  plantId: z.string(),
  plannedOrders: z.number().int().min(0),
  ordersOnTrack: z.number().int().min(0),
  ordersAtRisk: z.number().int().min(0),
  ordersLate: z.number().int().min(0),
  blockedOrders: z.number().int().min(0),
  highestSeverity: SeveritySchema,
  topRiskReason: z.string(),
  recommendedAction: z.string(),
  confidence: z.number().min(0).max(1),
})

export type PlanRiskSummary = z.infer<typeof PlanRiskSummarySchema>

// ---------------------------------------------------------------------------
// LateOrder
// ---------------------------------------------------------------------------

export const LateOrderSchema = z.object({
  processOrderId: z.string(),
  materialId: z.string(),
  materialDescription: z.string(),
  batchId: z.string(),
  lineOrResource: z.string(),
  plannedStart: z.string().datetime(),
  plannedFinish: z.string().datetime(),
  actualStart: z.string().datetime().optional(),
  estimatedFinish: z.string().datetime().optional(),
  delayMinutes: z.number().int(),
  delayReason: z.string(),
  severity: SeveritySchema,
  owner: z.string(),
})

export type LateOrder = z.infer<typeof LateOrderSchema>

// ---------------------------------------------------------------------------
// MaterialShortage
// ---------------------------------------------------------------------------

export const MaterialShortageSchema = z.object({
  materialId: z.string(),
  materialDescription: z.string(),
  plantId: z.string(),
  requiredQuantity: z.number(),
  availableQuantity: z.number(),
  shortageQuantity: z.number(),
  uom: z.string(),
  requiredBy: z.string().datetime(),
  affectedOrders: z.array(z.string()),
  stagingStatus: z.enum(['not-staged', 'partial', 'staged', 'not-required']),
  procurementStatus: z.enum(['in-stock', 'ordered', 'delayed', 'out-of-stock', 'unknown']),
  severity: SeveritySchema,
})

export type MaterialShortage = z.infer<typeof MaterialShortageSchema>

// ---------------------------------------------------------------------------
// WarehouseStagingStatus
// ---------------------------------------------------------------------------

export const WarehouseStagingStatusSchema = z.object({
  processOrderId: z.string(),
  materialId: z.string(),
  materialDescription: z.string(),
  batchId: z.string(),
  requiredQuantity: z.number(),
  stagedQuantity: z.number(),
  missingQuantity: z.number(),
  uom: z.string(),
  transferRequirementId: z.string().optional(),
  stagingArea: z.string(),
  status: z.enum(['pending', 'in-progress', 'staged', 'partial', 'blocked', 'not-required']),
  lastMovementAt: z.string().datetime().optional(),
  blockerReason: z.string().optional(),
})

export type WarehouseStagingStatus = z.infer<typeof WarehouseStagingStatusSchema>

// ---------------------------------------------------------------------------
// QualityBlocker
// ---------------------------------------------------------------------------

export const QualityBlockerSchema = z.object({
  blockerId: z.string(),
  type: z.enum(['inspection-lot', 'release-hold', 'deviation', 'spc-alarm', 'coa-incomplete', 'other']),
  materialId: z.string(),
  materialDescription: z.string(),
  batchId: z.string().optional(),
  processOrderId: z.string().optional(),
  inspectionLotId: z.string().optional(),
  releaseCaseId: z.string().optional(),
  severity: SeveritySchema,
  description: z.string(),
  owner: z.string(),
  dueAt: z.string().datetime().optional(),
  drillThroughTarget: z.string().optional(),
})

export type QualityBlocker = z.infer<typeof QualityBlockerSchema>

// ---------------------------------------------------------------------------
// ReleaseHoldImpact
// ---------------------------------------------------------------------------

export const ReleaseHoldImpactSchema = z.object({
  holdId: z.string(),
  batchId: z.string(),
  materialId: z.string(),
  materialDescription: z.string(),
  plantId: z.string(),
  blockedQuantity: z.number(),
  affectedOrders: z.array(z.string()),
  affectedDeliveries: z.array(z.string()),
  holdReason: z.string(),
  releaseStatus: z.enum(['active', 'pending-release', 'released', 'escalated']),
  qualityOwner: z.string(),
  severity: SeveritySchema,
})

export type ReleaseHoldImpact = z.infer<typeof ReleaseHoldImpactSchema>

// ---------------------------------------------------------------------------
// LineStatus
// ---------------------------------------------------------------------------

export const LineStatusSchema = z.object({
  lineId: z.string(),
  lineName: z.string(),
  currentOrderId: z.string().optional(),
  currentMaterial: z.string().optional(),
  status: z.enum(['running', 'idle', 'changeover', 'downtime', 'planned-stop', 'unknown']),
  oee: z.number().min(0).max(100),
  speedLossPercent: z.number().min(0).max(100),
  downtimeMinutes: z.number().int().min(0),
  changeoverStatus: z.enum(['not-applicable', 'pending', 'in-progress', 'complete']),
  nextOrderId: z.string().optional(),
  riskLevel: z.enum(['none', 'low', 'medium', 'high', 'critical']),
})

export type LineStatus = z.infer<typeof LineStatusSchema>

// ---------------------------------------------------------------------------
// ScheduleAdherenceSummary
// ---------------------------------------------------------------------------

export const ScheduleAdherenceSummarySchema = z.object({
  planDate: z.string().date(),
  totalOrders: z.number().int().min(0),
  onTimeOrders: z.number().int().min(0),
  lateOrders: z.number().int().min(0),
  atRiskOrders: z.number().int().min(0),
  adherencePercent: z.number().min(0).max(100),
  averageDelayMinutes: z.number(),
  worstLine: z.string().optional(),
  confidence: z.number().min(0).max(1),
})

export type ScheduleAdherenceSummary = z.infer<typeof ScheduleAdherenceSummarySchema>

// ---------------------------------------------------------------------------
// YieldVarianceSummary
// ---------------------------------------------------------------------------

export const YieldVarianceSummarySchema = z.object({
  processOrderId: z.string(),
  materialId: z.string(),
  lineOrResource: z.string(),
  plannedYieldPercent: z.number().min(0).max(200),
  actualYieldPercent: z.number().min(0).max(200),
  variancePercent: z.number(),
  scrapQuantity: z.number().min(0),
  reworkQuantity: z.number().min(0),
  lossReason: z.string(),
  severity: SeveritySchema,
})

export type YieldVarianceSummary = z.infer<typeof YieldVarianceSummarySchema>

// ---------------------------------------------------------------------------
// MaintenanceConstraint
// ---------------------------------------------------------------------------

export const MaintenanceConstraintSchema = z.object({
  constraintId: z.string(),
  assetId: z.string(),
  assetName: z.string(),
  lineId: z.string(),
  workOrderId: z.string().optional(),
  constraintType: z.enum(['planned-pm', 'breakdown', 'inspection', 'calibration', 'permit-required', 'other']),
  severity: SeveritySchema,
  expectedResolutionAt: z.string().datetime().optional(),
  affectedOrders: z.array(z.string()),
  status: z.enum(['active', 'scheduled', 'in-progress', 'resolved', 'overdue']),
})

export type MaintenanceConstraint = z.infer<typeof MaintenanceConstraintSchema>

// ---------------------------------------------------------------------------
// ShiftHandoverItem
// ---------------------------------------------------------------------------

export const ShiftHandoverItemSchema = z.object({
  handoverId: z.string(),
  shiftId: z.string(),
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  category: z.enum(['quality', 'safety', 'maintenance', 'operations', 'material', 'other']),
  title: z.string(),
  description: z.string(),
  linkedOrders: z.array(z.string()),
  linkedLines: z.array(z.string()),
  severity: SeveritySchema,
  status: z.enum(['open', 'acknowledged', 'in-progress', 'resolved']),
})

export type ShiftHandoverItem = z.infer<typeof ShiftHandoverItemSchema>

// ---------------------------------------------------------------------------
// OperationsActionQueueItem
// ---------------------------------------------------------------------------

export const OperationsActionQueueItemSchema = z.object({
  actionId: z.string(),
  title: z.string(),
  description: z.string(),
  ownerRole: z.string(),
  dueAt: z.string().datetime().optional(),
  severity: SeveritySchema,
  sourcePanel: z.string(),
  linkedEntityType: z.enum(['process-order', 'line', 'material', 'batch', 'asset', 'handover', 'other']),
  linkedEntityId: z.string(),
  status: z.enum(['open', 'in-progress', 'completed', 'dismissed']),
  recommendedAction: z.string(),
})

export type OperationsActionQueueItem = z.infer<typeof OperationsActionQueueItemSchema>
