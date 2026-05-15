import { z } from 'zod'

// ---------------------------------------------------------------------------
// MaintenanceReliabilityContext
// ---------------------------------------------------------------------------

export const MaintenanceReliabilityContextSchema = z.object({
  plantId: z.string(),
  plantName: z.string(),
  openWorkOrders: z.number().int().min(0),
  overduePreventiveMaintenance: z.number().int().min(0),
  equipmentAvailabilityPercent: z.number().min(0).max(100),
  maintenanceBacklogHours: z.number().min(0),
  lastUpdatedAt: z.string().datetime(),
})

export type MaintenanceReliabilityContext = z.infer<typeof MaintenanceReliabilityContextSchema>

// ---------------------------------------------------------------------------
// MaintenanceKpiSummary
// ---------------------------------------------------------------------------

export const MaintenanceKpiSummarySchema = z.object({
  plantId: z.string(),
  openWorkOrders: z.number().int().min(0),
  overdueWorkOrders: z.number().int().min(0),
  criticalWorkOrders: z.number().int().min(0),
  completedThisShift: z.number().int().min(0),
  overduePreventiveMaintenance: z.number().int().min(0),
  equipmentAvailabilityPercent: z.number().min(0).max(100),
  targetAvailabilityPercent: z.number().min(0).max(100),
  maintenanceBacklogHours: z.number().min(0),
  confidence: z.number().min(0).max(1),
})

export type MaintenanceKpiSummary = z.infer<typeof MaintenanceKpiSummarySchema>

// ---------------------------------------------------------------------------
// WorkOrder
// ---------------------------------------------------------------------------

export const WorkOrderSchema = z.object({
  workOrderId: z.string(),
  title: z.string(),
  equipmentId: z.string(),
  equipmentDescription: z.string(),
  lineId: z.string().optional(),
  workOrderType: z.enum(['corrective', 'preventive', 'predictive', 'emergency', 'inspection']),
  status: z.enum(['open', 'in-progress', 'on-hold', 'completed', 'cancelled']),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  plannedStart: z.string().datetime().optional(),
  plannedFinish: z.string().datetime().optional(),
  actualStart: z.string().datetime().optional(),
  estimatedHours: z.number().min(0),
  assignedTechnician: z.string().optional(),
  productionImpact: z.enum(['line-down', 'reduced-capacity', 'no-impact', 'risk-only']),
})

export type WorkOrder = z.infer<typeof WorkOrderSchema>

// ---------------------------------------------------------------------------
// PreventiveMaintenanceTask
// ---------------------------------------------------------------------------

export const PreventiveMaintenanceTaskSchema = z.object({
  taskId: z.string(),
  title: z.string(),
  equipmentId: z.string(),
  equipmentDescription: z.string(),
  frequency: z.enum(['daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'annually']),
  dueDate: z.string().datetime(),
  status: z.enum(['upcoming', 'due-today', 'overdue', 'completed', 'deferred']),
  daysOverdue: z.number().int().min(0),
  estimatedHours: z.number().min(0),
  assignedTechnician: z.string().optional(),
  linkedWorkOrderId: z.string().optional(),
})

export type PreventiveMaintenanceTask = z.infer<typeof PreventiveMaintenanceTaskSchema>

// ---------------------------------------------------------------------------
// EquipmentAvailability
// ---------------------------------------------------------------------------

export const EquipmentAvailabilitySchema = z.object({
  equipmentId: z.string(),
  equipmentDescription: z.string(),
  lineId: z.string().optional(),
  availabilityPercent: z.number().min(0).max(100),
  targetPercent: z.number().min(0).max(100),
  plannedDowntimeMinutes: z.number().min(0),
  unplannedDowntimeMinutes: z.number().min(0),
  currentStatus: z.enum(['running', 'planned-down', 'unplanned-down', 'standby', 'maintenance']),
  openWorkOrderCount: z.number().int().min(0),
})

export type EquipmentAvailability = z.infer<typeof EquipmentAvailabilitySchema>

// ---------------------------------------------------------------------------
// ReliabilityMetric
// ---------------------------------------------------------------------------

export const ReliabilityMetricSchema = z.object({
  equipmentId: z.string(),
  equipmentDescription: z.string(),
  mtbfHours: z.number().min(0),
  mttrHours: z.number().min(0),
  failureCount: z.number().int().min(0),
  oeeImpactPercent: z.number().min(0).max(100),
  trendDirection: z.enum(['improving', 'stable', 'degrading']),
  periodDays: z.number().int().min(1),
})

export type ReliabilityMetric = z.infer<typeof ReliabilityMetricSchema>

// ---------------------------------------------------------------------------
// MaintenanceBacklogItem
// ---------------------------------------------------------------------------

export const MaintenanceBacklogItemSchema = z.object({
  backlogId: z.string(),
  title: z.string(),
  equipmentId: z.string(),
  equipmentDescription: z.string(),
  deferredFrom: z.string().datetime(),
  deferredReason: z.string(),
  estimatedHours: z.number().min(0),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  productionImpact: z.enum(['line-down', 'reduced-capacity', 'no-impact', 'risk-only']),
  targetCompletionDate: z.string().datetime().optional(),
})

export type MaintenanceBacklogItem = z.infer<typeof MaintenanceBacklogItemSchema>
