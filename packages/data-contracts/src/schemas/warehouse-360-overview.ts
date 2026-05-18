import { z } from 'zod'

// ---------------------------------------------------------------------------
// Warehouse360OverviewContext
// ---------------------------------------------------------------------------

export const Warehouse360OverviewContextSchema = z.object({
  warehouseId: z.string(),
  warehouseName: z.string(),
  plantId: z.string(),
  totalStockLines: z.number().int().min(0),
  holdPercent: z.number().min(0).max(100),
  openTransfers: z.number().int().min(0),
  capacityUtilizationPercent: z.number().min(0).max(100),
  lastUpdatedAt: z.string().datetime(),
})

export type Warehouse360OverviewContext = z.infer<typeof Warehouse360OverviewContextSchema>

// ---------------------------------------------------------------------------
// Warehouse360Summary
// ---------------------------------------------------------------------------

export const Warehouse360SummarySchema = z.object({
  warehouseId: z.string(),
  totalStockLines: z.number().int().min(0),
  unrestrictedLines: z.number().int().min(0),
  holdLines: z.number().int().min(0),
  qualityInspectionLines: z.number().int().min(0),
  openGoodsReceipts: z.number().int().min(0),
  openGoodsIssues: z.number().int().min(0),
  openTransfers: z.number().int().min(0),
  capacityUtilizationPercent: z.number().min(0).max(100),
  activeReplenishmentNeeds: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
})

export type Warehouse360Summary = z.infer<typeof Warehouse360SummarySchema>

// ---------------------------------------------------------------------------
// StockOverview
// ---------------------------------------------------------------------------

export const StockZoneSchema = z.object({
  zoneId: z.string(),
  zoneName: z.string(),
  zoneType: z.enum(['ambient', 'chilled', 'frozen', 'hazardous', 'bulk', 'staging']),
  stockLines: z.number().int().min(0),
  capacityPercent: z.number().min(0).max(100),
  holdPercent: z.number().min(0).max(100),
})

export type StockZone = z.infer<typeof StockZoneSchema>

export const StockOverviewSchema = z.object({
  warehouseId: z.string(),
  zones: z.array(StockZoneSchema),
  totalStorageLocations: z.number().int().min(0),
  occupiedLocations: z.number().int().min(0),
  blockedLocations: z.number().int().min(0),
})

export type StockOverview = z.infer<typeof StockOverviewSchema>

// ---------------------------------------------------------------------------
// OpenHoldItem
// ---------------------------------------------------------------------------

export const OpenHoldItemSchema = z.object({
  holdId: z.string(),
  batchId: z.string().optional(),
  materialId: z.string(),
  materialDescription: z.string(),
  storageLocationId: z.string(),
  holdReason: z.enum(['quality-hold', 'customer-hold', 'production-hold', 'regulatory-hold', 'damaged', 'expired', 'investigation']),
  holdQuantity: z.number().min(0),
  uom: z.string(),
  raisedAt: z.string().datetime(),
  raisedBy: z.string().optional(),
  ageHours: z.number().min(0),
  linkedWorkspaceId: z.string().optional(),
})

export type OpenHoldItem = z.infer<typeof OpenHoldItemSchema>

// ---------------------------------------------------------------------------
// GoodsMovementEvent
// ---------------------------------------------------------------------------

export const GoodsMovementEventSchema = z.object({
  movementId: z.string(),
  timestamp: z.string().datetime(),
  movementType: z.enum(['goods-receipt', 'goods-issue', 'transfer-order', 'stock-transfer', 'return', 'adjustment']),
  materialId: z.string(),
  materialDescription: z.string(),
  batchId: z.string().optional(),
  quantity: z.number(),
  uom: z.string(),
  sourceLocation: z.string().optional(),
  destinationLocation: z.string().optional(),
  referenceDocument: z.string().optional(),
  postedBy: z.string().optional(),
})

export type GoodsMovementEvent = z.infer<typeof GoodsMovementEventSchema>

// ---------------------------------------------------------------------------
// ReplenishmentNeed
// ---------------------------------------------------------------------------

export const ReplenishmentNeedSchema = z.object({
  needId: z.string(),
  materialId: z.string(),
  materialDescription: z.string(),
  storageLocationId: z.string(),
  currentStockQuantity: z.number().min(0),
  reorderPoint: z.number().min(0),
  targetQuantity: z.number().min(0),
  uom: z.string(),
  urgency: z.enum(['critical', 'high', 'medium', 'low']),
  openPurchaseOrderId: z.string().optional(),
  expectedDelivery: z.string().datetime().optional(),
})

export type ReplenishmentNeed = z.infer<typeof ReplenishmentNeedSchema>

// ---------------------------------------------------------------------------
// LocationCapacity
// ---------------------------------------------------------------------------

export const LocationCapacitySchema = z.object({
  locationId: z.string(),
  locationName: z.string(),
  zoneId: z.string(),
  zoneName: z.string(),
  totalCapacityUnits: z.number().min(0),
  usedCapacityUnits: z.number().min(0),
  utilizationPercent: z.number().min(0).max(100),
  locationType: z.enum(['bin', 'shelf', 'rack', 'floor', 'bulk-area', 'staging-lane']),
  isBlocked: z.boolean(),
  blockReason: z.string().optional(),
})

export type LocationCapacity = z.infer<typeof LocationCapacitySchema>

// ---------------------------------------------------------------------------
// NearExpiryBatch
// ---------------------------------------------------------------------------

export const NearExpiryBatchSchema = z.object({
  batchId: z.string(),
  materialId: z.string(),
  materialDescription: z.string(),
  storageLocationId: z.string(),
  expiryDate: z.string().datetime(),
  daysUntilExpiry: z.number(),
  quantity: z.number().min(0),
  uom: z.string(),
  urgency: z.enum(['expired', 'critical', 'warning', 'caution']),
  holdStatus: z.enum(['unrestricted', 'quality-hold', 'blocked']),
})

export type NearExpiryBatch = z.infer<typeof NearExpiryBatchSchema>

// ---------------------------------------------------------------------------
// WarehouseReconciliationException
// ---------------------------------------------------------------------------

export const WarehouseReconciliationExceptionSchema = z.object({
  exceptionId: z.string(),
  exceptionType: z.enum([
    'quantity-mismatch',
    'location-mismatch',
    'status-mismatch',
    'missing-in-wms',
    'missing-in-im',
    'duplicate-posting',
  ]),
  materialId: z.string(),
  materialDescription: z.string(),
  batchId: z.string().optional(),
  storageLocationId: z.string(),
  imQuantity: z.number().optional(),
  wmsQuantity: z.number().optional(),
  discrepancyQuantity: z.number().optional(),
  uom: z.string(),
  detectedAt: z.string().datetime(),
  ageHours: z.number().min(0),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  resolution: z.enum(['open', 'in-progress', 'resolved', 'escalated']),
})

export type WarehouseReconciliationException = z.infer<typeof WarehouseReconciliationExceptionSchema>

// ---------------------------------------------------------------------------
// Warehouse360Overview
// ---------------------------------------------------------------------------

export const Warehouse360OverviewSchema = z.object({
  plantId: z.string(),
  warehouseId: z.string(),
  inboundDueCount: z.number().int().min(0),
  inboundOverdueCount: z.number().int().min(0),
  outboundDueCount: z.number().int().min(0),
  outboundOverdueCount: z.number().int().min(0),
  stagingOpenCount: z.number().int().min(0),
  stagingOverdueCount: z.number().int().min(0),
  nearExpiryCount: z.number().int().min(0),
  reconciliationExceptionCount: z.number().int().min(0),
  blockedStockCount: z.number().int().min(0),
  source: z.string().optional(),
  warnings: z.array(z.string()).optional(),
})

export type Warehouse360Overview = z.infer<typeof Warehouse360OverviewSchema>

// ---------------------------------------------------------------------------
// Warehouse360InboundItem
// ---------------------------------------------------------------------------

export const Warehouse360InboundItemSchema = z.object({
  documentType: z.enum(['PO', 'STO', 'unknown']),
  purchaseOrderId: z.string().nullable().optional(),
  stockTransportOrderId: z.string().nullable().optional(),
  itemId: z.string().nullable().optional(),
  vendorId: z.string().nullable().optional(),
  supplyingPlantId: z.string().nullable().optional(),
  materialId: z.string(),
  materialDescription: z.string().nullable().optional(),
  batchId: z.string().nullable().optional(),
  plantId: z.string().nullable().optional(),
  storageLocation: z.string().nullable().optional(),
  warehouseNumber: z.string().nullable().optional(),
  expectedDate: z.string().nullable().optional(),
  receivedDate: z.string().nullable().optional(),
  quantity: z.number().nullable().optional(),
  unitOfMeasure: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  exceptionReason: z.string().nullable().optional(),
})

export type Warehouse360InboundItem = z.infer<typeof Warehouse360InboundItemSchema>

// ---------------------------------------------------------------------------
// Warehouse360OutboundItem
// ---------------------------------------------------------------------------

export const Warehouse360OutboundItemSchema = z.object({
  deliveryId: z.string().nullable().optional(),
  deliveryItemId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  salesOrderId: z.string().nullable().optional(),
  materialId: z.string(),
  materialDescription: z.string().nullable().optional(),
  batchId: z.string().nullable().optional(),
  plantId: z.string().nullable().optional(),
  storageLocation: z.string().nullable().optional(),
  warehouseNumber: z.string().nullable().optional(),
  plannedGoodsIssueDate: z.string().nullable().optional(),
  actualGoodsIssueDate: z.string().nullable().optional(),
  quantity: z.number().nullable().optional(),
  unitOfMeasure: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  exceptionReason: z.string().nullable().optional(),
})

export type Warehouse360OutboundItem = z.infer<typeof Warehouse360OutboundItemSchema>

// ---------------------------------------------------------------------------
// Warehouse360StagingItem
// ---------------------------------------------------------------------------

export const Warehouse360StagingItemSchema = z.object({
  processOrderId: z.string().nullable().optional(),
  reservationId: z.string().nullable().optional(),
  reservationItemId: z.string().nullable().optional(),
  materialId: z.string(),
  materialDescription: z.string().nullable().optional(),
  batchId: z.string().nullable().optional(),
  plantId: z.string().nullable().optional(),
  storageLocation: z.string().nullable().optional(),
  warehouseNumber: z.string().nullable().optional(),
  requirementDate: z.string().nullable().optional(),
  requiredQuantity: z.number().nullable().optional(),
  stagedQuantity: z.number().nullable().optional(),
  openQuantity: z.number().nullable().optional(),
  unitOfMeasure: z.string().nullable().optional(),
  stagingStatus: z.string().nullable().optional(),
  exceptionReason: z.string().nullable().optional(),
})

export type Warehouse360StagingItem = z.infer<typeof Warehouse360StagingItemSchema>

// ---------------------------------------------------------------------------
// Warehouse360ExceptionItem
// ---------------------------------------------------------------------------

export const Warehouse360ExceptionItemSchema = z.object({
  exceptionType: z.string().nullable().optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).nullable().optional(),
  materialId: z.string(),
  batchId: z.string().nullable().optional(),
  plantId: z.string().nullable().optional(),
  storageLocation: z.string().nullable().optional(),
  warehouseNumber: z.string().nullable().optional(),
  quantity: z.number().nullable().optional(),
  unitOfMeasure: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  daysToExpiry: z.number().nullable().optional(),
  documentId: z.string().nullable().optional(),
  processOrderId: z.string().nullable().optional(),
  deliveryId: z.string().nullable().optional(),
  purchaseOrderId: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  recommendedReviewAction: z.string().nullable().optional(),
})

export type Warehouse360ExceptionItem = z.infer<typeof Warehouse360ExceptionItemSchema>

