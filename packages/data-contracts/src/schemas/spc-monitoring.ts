import { z } from 'zod'

const SeveritySchema = z.enum(['low', 'medium', 'high', 'critical'])

const ChartTypeSchema = z.enum([
  'xbar-r',
  'xbar-s',
  'individuals',
  'p-chart',
  'np-chart',
  'c-chart',
  'u-chart',
  'ewma',
  'cusum',
])

const LimitProvenanceSchema = z.enum([
  'mock-fixture',
  'calculated-from-sample',
  'imported-from-approved-source',
  'unknown',
])

const ApprovalStateSchema = z.enum([
  'approved',
  'not-approved',
  'pending-validation',
  'unavailable',
])

// ---------------------------------------------------------------------------
// MonitoredSPCCharacteristic
// ---------------------------------------------------------------------------

export const MonitoredSPCCharacteristicSchema = z.object({
  characteristicId: z.string(),
  characteristicName: z.string(),
  micId: z.string().optional(),
  chartType: ChartTypeSchema,
  batchCount: z.number().int().min(0),
  avgSamplesPerBatch: z.number().optional(),
  hasActiveSignal: z.boolean(),
  highestSignalSeverity: SeveritySchema.optional(),
  operationId: z.string().optional(),
  chartTypeSource: z.enum(['heuristic', 'override', 'manual']).optional(),
})

export type MonitoredSPCCharacteristic = z.infer<typeof MonitoredSPCCharacteristicSchema>

// ---------------------------------------------------------------------------
// SPCMonitoringContext
// ---------------------------------------------------------------------------

export const SPCMonitoringContextSchema = z.object({
  plantId: z.string(),
  plantName: z.string(),
  materialId: z.string(),
  materialDescription: z.string(),
  batchId: z.string().optional(),
  // workCentreId remains for legacy-bridge compatibility. The verified SPC
  // source has no SAP work-centre column; operationId below carries the
  // verified `operation_id` (sequential inspection-operation identifier).
  // See domain-integrations/spc/docs/spc-native-contract-alignment-audit.md
  // items 2.1, 2.2 and spc-v2-contract-mapping.md §5.
  workCentreId: z.string().optional(),
  operationId: z.string().optional(),
  characteristicId: z.string().optional(),
  chartType: ChartTypeSchema.optional(),
  activeSignals: z.number().int().min(0),
  highestSeverity: SeveritySchema,
  lastUpdatedAt: z.string().datetime(),
  activeScope: z.string().optional(),
  activeView: z.string().optional(),
})

export type SPCMonitoringContext = z.infer<typeof SPCMonitoringContextSchema>

// ---------------------------------------------------------------------------
// SPCSummary
// ---------------------------------------------------------------------------

export const SPCSummarySchema = z.object({
  chartsMonitored: z.number().int().min(0),
  activeSignals: z.number().int().min(0),
  outOfControlSignals: z.number().int().min(0),
  warningSignals: z.number().int().min(0),
  characteristicsAtRisk: z.number().int().min(0),
  highestSeverity: SeveritySchema,
  recommendedAction: z.string(),
  confidence: z.number().min(0).max(1),
})

export type SPCSummary = z.infer<typeof SPCSummarySchema>

// ---------------------------------------------------------------------------
// SPCSignal
// ---------------------------------------------------------------------------

export const SPCSignalSchema = z.object({
  signalId: z.string(),
  characteristicId: z.string(),
  characteristicName: z.string(),
  materialId: z.string(),
  batchId: z.string(),
  plantId: z.string(),
  chartType: ChartTypeSchema,
  rule: z.string(),
  ruleCode: z.string().optional().nullable(),
  severity: SeveritySchema,
  detectedAt: z.string().datetime(),
  samplePointId: z.string(),
  resultValue: z.number(),
  recommendedAction: z.string(),
  status: z.enum(['active', 'acknowledged', 'investigating', 'resolved', 'false-positive']),
})

export type SPCSignal = z.infer<typeof SPCSignalSchema>

// ---------------------------------------------------------------------------
// ControlChartPoint
// ---------------------------------------------------------------------------

export const ControlChartPointSchema = z.object({
  pointId: z.string(),
  timestamp: z.string().datetime(),
  value: z.number(),
  batchId: z.string().optional(),
  sampleId: z.string().optional(),
  signalIds: z.array(z.string()),
  status: z.enum(['in-control', 'warning', 'out-of-control']),
})

export type ControlChartPoint = z.infer<typeof ControlChartPointSchema>

// ---------------------------------------------------------------------------
// ControlChartSeries
// ---------------------------------------------------------------------------

export const ControlChartSeriesSchema = z.object({
  chartId: z.string(),
  chartType: ChartTypeSchema,
  characteristicId: z.string(),
  characteristicName: z.string(),
  points: z.array(ControlChartPointSchema),
  centerLine: z.number().optional(),
  upperControlLimit: z.number().optional(),
  lowerControlLimit: z.number().optional(),
  upperSpecLimit: z.number().optional(),
  lowerSpecLimit: z.number().optional(),
  unitOfMeasure: z.string(),
  confidence: z.number().min(0).max(1),
  limitProvenance: LimitProvenanceSchema.optional(),
  approvalState: ApprovalStateSchema.optional(),
  lockedLimits: z.boolean().optional(),
  lockedFrom: z.string().datetime().optional(),
  lockedTo: z.string().datetime().optional(),
})

export type ControlChartSeries = z.infer<typeof ControlChartSeriesSchema>

// ---------------------------------------------------------------------------
// CharacteristicCapability
// ---------------------------------------------------------------------------

export const CharacteristicCapabilitySchema = z.object({
  characteristicId: z.string(),
  characteristicName: z.string(),
  cp: z.number(),
  cpk: z.number(),
  pp: z.number(),
  ppk: z.number(),
  sampleCount: z.number().int().min(0),
  mean: z.number(),
  standardDeviation: z.number().min(0),
  confidence: z.number().min(0).max(1),
  interpretation: z.enum(['capable', 'marginal', 'not-capable', 'insufficient-data']),
  limitProvenance: LimitProvenanceSchema.optional(),
  approvalState: ApprovalStateSchema.optional(),
})

export type CharacteristicCapability = z.infer<typeof CharacteristicCapabilitySchema>

// ---------------------------------------------------------------------------
// SPCAlarmHistoryItem
// ---------------------------------------------------------------------------

export const SPCAlarmHistoryItemSchema = z.object({
  alarmId: z.string(),
  timestamp: z.string().datetime(),
  characteristicId: z.string(),
  rule: z.string(),
  ruleCode: z.string().optional(),
  severity: SeveritySchema,
  status: z.enum(['active', 'acknowledged', 'investigating', 'resolved', 'false-positive']),
  acknowledgedBy: z.string().optional(),
  acknowledgedAt: z.string().datetime().optional(),
  linkedBatchId: z.string().optional(),
})

export type SPCAlarmHistoryItem = z.infer<typeof SPCAlarmHistoryItemSchema>

// ---------------------------------------------------------------------------
// SPCRelatedBatch
// ---------------------------------------------------------------------------

export const SPCRelatedBatchSchema = z.object({
  batchId: z.string(),
  materialId: z.string(),
  plantId: z.string(),
  status: z.enum(['released', 'on-hold', 'rejected', 'under-review', 'awaiting-review']),
  relatedSignalCount: z.number().int().min(0),
  releaseImpact: z.enum(['blocking', 'risk', 'none']),
  drillThroughTarget: z.string().optional(),
})

export type SPCRelatedBatch = z.infer<typeof SPCRelatedBatchSchema>
