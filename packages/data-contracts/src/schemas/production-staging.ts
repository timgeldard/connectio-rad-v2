import { z } from 'zod'

const SeveritySchema = z.enum(['low', 'medium', 'high', 'critical'])

// ---------------------------------------------------------------------------
// ProductionStagingContext
// ---------------------------------------------------------------------------

export const ProductionStagingContextSchema = z.object({
  plantId: z.string(),
  warehouseId: z.string(),
  warehouseName: z.string(),
  planDate: z.string().date(),
  totalOrders: z.number().int().min(0),
  stagedOrders: z.number().int().min(0),
  partialOrders: z.number().int().min(0),
  blockedOrders: z.number().int().min(0),
  openShortfalls: z.number().int().min(0),
  openMoveRequests: z.number().int().min(0),
  overallReadinessPercent: z.number().min(0).max(100),
  riskStatus: z.enum(['ready', 'at-risk', 'blocked', 'unknown']),
  lastUpdatedAt: z.string().datetime(),
})

export type ProductionStagingContext = z.infer<typeof ProductionStagingContextSchema>

// ---------------------------------------------------------------------------
// StagingOrderSummary
// ---------------------------------------------------------------------------

export const StagingOrderSummarySchema = z.object({
  processOrderId: z.string(),
  materialId: z.string(),
  materialDescription: z.string(),
  batchId: z.string(),
  plantId: z.string(),
  lineOrResource: z.string(),
  plannedStart: z.string().datetime(),
  requiredQuantity: z.number(),
  stagedQuantity: z.number(),
  shortfallQuantity: z.number(),
  uom: z.string(),
  stagingArea: z.string(),
  status: z.enum(['not-staged', 'partial', 'staged', 'blocked', 'not-required']),
  urgency: SeveritySchema,
  pickTaskIds: z.array(z.string()),
  blockerReason: z.string().optional(),
})

export type StagingOrderSummary = z.infer<typeof StagingOrderSummarySchema>

// ---------------------------------------------------------------------------
// StagingPickTask
// ---------------------------------------------------------------------------

export const StagingPickTaskSchema = z.object({
  taskId: z.string(),
  processOrderId: z.string(),
  materialId: z.string(),
  materialDescription: z.string(),
  warehouseId: z.string(),
  storageLocation: z.string(),
  destinationLocation: z.string(),
  requiredQuantity: z.number(),
  pickedQuantity: z.number(),
  uom: z.string(),
  assignee: z.string().optional(),
  status: z.enum(['open', 'in-progress', 'picked', 'staged', 'cancelled']),
  priority: SeveritySchema,
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  batchId: z.string().optional(),
})

export type StagingPickTask = z.infer<typeof StagingPickTaskSchema>

// ---------------------------------------------------------------------------
// StagingZoneCapacity
// ---------------------------------------------------------------------------

export const StagingZoneCapacitySchema = z.object({
  zoneId: z.string(),
  zoneName: z.string(),
  warehouseId: z.string(),
  capacityPercent: z.number().min(0).max(100),
  pendingOrders: z.number().int().min(0),
  stagedOrders: z.number().int().min(0),
  blockedOrders: z.number().int().min(0),
  status: z.enum(['available', 'high-utilisation', 'full', 'blocked']),
  overflowRisk: z.boolean(),
})

export type StagingZoneCapacity = z.infer<typeof StagingZoneCapacitySchema>

// ---------------------------------------------------------------------------
// StagingShortfall
// ---------------------------------------------------------------------------

export const StagingShortfallSchema = z.object({
  shortfallId: z.string(),
  materialId: z.string(),
  materialDescription: z.string(),
  plantId: z.string(),
  warehouseId: z.string(),
  requiredQuantity: z.number(),
  availableQuantity: z.number(),
  shortfallQuantity: z.number(),
  uom: z.string(),
  affectedOrders: z.array(z.string()),
  urgency: SeveritySchema,
  procurementStatus: z.enum(['in-stock', 'in-transit', 'ordered', 'delayed', 'out-of-stock', 'unknown']),
  expectedArrival: z.string().datetime().optional(),
  canBeSubstituted: z.boolean(),
})

export type StagingShortfall = z.infer<typeof StagingShortfallSchema>

// ---------------------------------------------------------------------------
// StagingMoveRequest
// ---------------------------------------------------------------------------

export const StagingMoveRequestSchema = z.object({
  requestId: z.string(),
  warehouseId: z.string(),
  fromLocation: z.string(),
  toLocation: z.string(),
  materialId: z.string(),
  materialDescription: z.string(),
  quantity: z.number(),
  uom: z.string(),
  processOrderId: z.string().optional(),
  requestedBy: z.string(),
  assignedTo: z.string().optional(),
  status: z.enum(['open', 'assigned', 'in-transit', 'completed', 'cancelled']),
  priority: SeveritySchema,
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  reason: z.string(),
})

export type StagingMoveRequest = z.infer<typeof StagingMoveRequestSchema>

// ---------------------------------------------------------------------------
// StagingReadinessSummary
// ---------------------------------------------------------------------------

export const StagingReadinessSummarySchema = z.object({
  planDate: z.string().date(),
  warehouseId: z.string(),
  totalOrders: z.number().int().min(0),
  fullyStaged: z.number().int().min(0),
  partiallyStaged: z.number().int().min(0),
  notStaged: z.number().int().min(0),
  blocked: z.number().int().min(0),
  percentReady: z.number().min(0).max(100),
  openShortfalls: z.number().int().min(0),
  pendingPickTasks: z.number().int().min(0),
  openMoveRequests: z.number().int().min(0),
  riskStatus: z.enum(['ready', 'at-risk', 'blocked', 'unknown']),
  confidence: z.number().min(0).max(1),
})

export type StagingReadinessSummary = z.infer<typeof StagingReadinessSummarySchema>

// ---------------------------------------------------------------------------
// StagingPickingWave
// ---------------------------------------------------------------------------

export const StagingPickingWaveSchema = z.object({
  waveId: z.string(),
  warehouseId: z.string(),
  planDate: z.string().date(),
  waveLabel: z.string(),
  includedOrders: z.array(z.string()),
  totalTasks: z.number().int().min(0),
  completedTasks: z.number().int().min(0),
  status: z.enum(['planned', 'in-progress', 'completed', 'partial', 'cancelled']),
  scheduledStart: z.string().datetime().optional(),
  actualStart: z.string().datetime().optional(),
  estimatedCompletion: z.string().datetime().optional(),
  actualCompletion: z.string().datetime().optional(),
  assignedTeam: z.string().optional(),
})

export type StagingPickingWave = z.infer<typeof StagingPickingWaveSchema>

// ---------------------------------------------------------------------------
// StagingAlert
// ---------------------------------------------------------------------------

export const StagingAlertSchema = z.object({
  alertId: z.string(),
  warehouseId: z.string(),
  alertType: z.enum(['shortfall', 'overdue-pick', 'zone-capacity', 'move-delay', 'blocked-order', 'other']),
  severity: SeveritySchema,
  processOrderId: z.string().optional(),
  materialId: z.string().optional(),
  zoneId: z.string().optional(),
  description: z.string(),
  recommendedAction: z.string(),
  raisedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
  status: z.enum(['open', 'acknowledged', 'in-progress', 'resolved']),
  owner: z.string().optional(),
})

export type StagingAlert = z.infer<typeof StagingAlertSchema>
