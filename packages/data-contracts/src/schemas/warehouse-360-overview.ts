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
