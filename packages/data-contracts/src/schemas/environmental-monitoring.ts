import { z } from 'zod'

const SeveritySchema = z.enum(['low', 'medium', 'high', 'critical'])

// ---------------------------------------------------------------------------
// EnvMonContext
// ---------------------------------------------------------------------------

export const EnvMonContextSchema = z.object({
  regionId: z.string(),
  plantId: z.string(),
  plantName: z.string(),
  monitoringPeriodStart: z.string().date(),
  monitoringPeriodEnd: z.string().date(),
  totalZones: z.number().int().min(0),
  activeAlerts: z.number().int().min(0),
  openCorrectiveActions: z.number().int().min(0),
  overallRiskStatus: z.enum(['compliant', 'elevated', 'non-compliant', 'unknown']),
  lastSampleDate: z.string().date().optional(),
  lastUpdatedAt: z.string().datetime(),
})

export type EnvMonContext = z.infer<typeof EnvMonContextSchema>

// ---------------------------------------------------------------------------
// EnvMonSiteSummary
// ---------------------------------------------------------------------------

export const EnvMonSiteSummarySchema = z.object({
  plantId: z.string(),
  plantName: z.string(),
  zonesMonitored: z.number().int().min(0),
  zonesWithAlerts: z.number().int().min(0),
  positiveCount: z.number().int().min(0),
  positiveRate: z.number().min(0).max(100),
  openCorrectiveActions: z.number().int().min(0),
  overdueActions: z.number().int().min(0),
  complianceRate: z.number().min(0).max(100),
  riskStatus: z.enum(['compliant', 'elevated', 'non-compliant', 'unknown']),
  highestSeverity: SeveritySchema,
  confidence: z.number().min(0).max(1),
})

export type EnvMonSiteSummary = z.infer<typeof EnvMonSiteSummarySchema>

// ---------------------------------------------------------------------------
// EnvMonZone
// ---------------------------------------------------------------------------

export const EnvMonZoneSchema = z.object({
  zoneId: z.string(),
  zoneName: z.string(),
  plantId: z.string(),
  areaType: z.enum(['production', 'storage', 'packaging', 'utility', 'corridor', 'other']),
  hygieneZone: z.enum(['zone-1', 'zone-2', 'zone-3', 'zone-4']),
  status: z.enum(['compliant', 'alert', 'overdue', 'corrective-action', 'suspended']),
  lastSampleDate: z.string().date().optional(),
  nextScheduledSample: z.string().date().optional(),
  consecutivePositives: z.number().int().min(0),
  openAlerts: z.number().int().min(0),
})

export type EnvMonZone = z.infer<typeof EnvMonZoneSchema>

// ---------------------------------------------------------------------------
// EnvMonAlert
// ---------------------------------------------------------------------------

export const EnvMonAlertSchema = z.object({
  alertId: z.string(),
  zoneId: z.string(),
  zoneName: z.string(),
  plantId: z.string(),
  testType: z.enum(['swab', 'air-sample', 'surface-contact', 'rinse-water', 'other']),
  organism: z.string(),
  severity: SeveritySchema,
  detectedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
  status: z.enum(['open', 'investigating', 'corrective-action', 'resolved', 'escalated']),
  correctiveActionId: z.string().optional(),
  description: z.string(),
  owner: z.string(),
})

export type EnvMonAlert = z.infer<typeof EnvMonAlertSchema>

// ---------------------------------------------------------------------------
// EnvMonSwabResult
// ---------------------------------------------------------------------------

export const EnvMonSwabResultSchema = z.object({
  sampleId: z.string(),
  zoneId: z.string(),
  zoneName: z.string(),
  plantId: z.string(),
  vectorId: z.string().optional(),
  testType: z.enum(['swab', 'air-sample', 'surface-contact', 'rinse-water', 'other']),
  organism: z.string(),
  result: z.enum(['negative', 'positive', 'borderline', 'pending']),
  cfu: z.number().min(0).optional(),
  cfuLimit: z.number().min(0).optional(),
  sampleDate: z.string().date(),
  analysedAt: z.string().datetime().optional(),
  analyst: z.string().optional(),
  lotId: z.string().optional(),
})

export type EnvMonSwabResult = z.infer<typeof EnvMonSwabResultSchema>

// ---------------------------------------------------------------------------
// EnvMonTrend
// ---------------------------------------------------------------------------

export const EnvMonTrendSchema = z.object({
  date: z.string().date(),
  plantId: z.string(),
  samplesCollected: z.number().int().min(0),
  positiveCount: z.number().int().min(0),
  positiveRate: z.number().min(0).max(100),
  newAlerts: z.number().int().min(0),
  resolvedAlerts: z.number().int().min(0),
  openAlerts: z.number().int().min(0),
  complianceRate: z.number().min(0).max(100),
})

export type EnvMonTrend = z.infer<typeof EnvMonTrendSchema>

// ---------------------------------------------------------------------------
// EnvMonHeatmapCell
// ---------------------------------------------------------------------------

export const EnvMonHeatmapCellSchema = z.object({
  zoneId: z.string(),
  zoneName: z.string(),
  areaType: z.string(),
  hygieneZone: z.enum(['zone-1', 'zone-2', 'zone-3', 'zone-4']),
  riskScore: z.number().min(0).max(100),
  positiveCount: z.number().int().min(0),
  sampleCount: z.number().int().min(0),
  lastTestDate: z.string().date().optional(),
  status: z.enum(['compliant', 'alert', 'overdue', 'corrective-action', 'suspended']),
})

export type EnvMonHeatmapCell = z.infer<typeof EnvMonHeatmapCellSchema>

// ---------------------------------------------------------------------------
// EnvMonCorrectiveAction
// ---------------------------------------------------------------------------

export const EnvMonCorrectiveActionSchema = z.object({
  actionId: z.string(),
  alertId: z.string(),
  zoneId: z.string(),
  zoneName: z.string(),
  plantId: z.string(),
  title: z.string(),
  description: z.string(),
  actionType: z.enum(['deep-clean', 'retest', 'equipment-check', 'process-review', 'personnel-training', 'other']),
  severity: SeveritySchema,
  status: z.enum(['open', 'in-progress', 'pending-verification', 'closed', 'overdue']),
  assignee: z.string(),
  dueDate: z.string().date(),
  closedAt: z.string().datetime().optional(),
  verifiedBy: z.string().optional(),
  recurrence: z.boolean(),
})

export type EnvMonCorrectiveAction = z.infer<typeof EnvMonCorrectiveActionSchema>

// ---------------------------------------------------------------------------
// EnvMonSwabVector
// ---------------------------------------------------------------------------

export const EnvMonSwabVectorSchema = z.object({
  vectorId: z.string(),
  vectorName: z.string(),
  plantId: z.string(),
  zoneIds: z.array(z.string()),
  frequency: z.enum(['daily', 'weekly', 'bi-weekly', 'monthly', 'quarterly']),
  nextDueDate: z.string().date().optional(),
  lastCompletedDate: z.string().date().optional(),
  status: z.enum(['on-schedule', 'overdue', 'in-progress', 'suspended']),
  pointCount: z.number().int().min(0),
  assignedTeam: z.string().optional(),
})

export type EnvMonSwabVector = z.infer<typeof EnvMonSwabVectorSchema>

// ---------------------------------------------------------------------------
// EnvMonKpiSummary
// ---------------------------------------------------------------------------

export const EnvMonKpiSummarySchema = z.object({
  plantId: z.string(),
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
  zonesMonitored: z.number().int().min(0),
  samplesCollected: z.number().int().min(0),
  positiveRate: z.number().min(0).max(100),
  alertsOpen: z.number().int().min(0),
  alertsResolved: z.number().int().min(0),
  correctiveActionsOpen: z.number().int().min(0),
  correctiveActionsOverdue: z.number().int().min(0),
  complianceRate: z.number().min(0).max(100),
  trendDirection: z.enum(['improving', 'stable', 'deteriorating', 'unknown']),
  confidence: z.number().min(0).max(1),
})

export type EnvMonKpiSummary = z.infer<typeof EnvMonKpiSummarySchema>
