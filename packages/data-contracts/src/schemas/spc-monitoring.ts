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
])

// ---------------------------------------------------------------------------
// SPCMonitoringContext
// ---------------------------------------------------------------------------

export const SPCMonitoringContextSchema = z.object({
  plantId: z.string(),
  plantName: z.string(),
  materialId: z.string(),
  materialDescription: z.string(),
  batchId: z.string().optional(),
  workCentreId: z.string().optional(),
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
  centerLine: z.number(),
  upperControlLimit: z.number(),
  lowerControlLimit: z.number(),
  upperSpecLimit: z.number().optional(),
  lowerSpecLimit: z.number().optional(),
  unitOfMeasure: z.string(),
  confidence: z.number().min(0).max(1),
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
