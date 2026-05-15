import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { EnvMonAdapter } from './envmon-adapter.js'
import {
  EnvMonContextSchema,
  EnvMonSiteSummarySchema,
  EnvMonZoneSchema,
  EnvMonAlertSchema,
  EnvMonSwabResultSchema,
  EnvMonTrendSchema,
  EnvMonHeatmapCellSchema,
  EnvMonCorrectiveActionSchema,
  EnvMonSwabVectorSchema,
} from '@connectio/data-contracts'

const fixedNow = () => '2024-03-08T15:00:00.000Z'
const adapter = new EnvMonAdapter({ now: fixedNow })
const request = { regionId: 'EU-WEST', plantId: 'IE10' }

describe('EnvMonAdapter', () => {
  it('getEnvMonContext returns ok: true with valid contract data', async () => {
    const result = await adapter.getEnvMonContext(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = EnvMonContextSchema.safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getEnvMonSiteSummary returns ok: true with valid contract data', async () => {
    const result = await adapter.getEnvMonSiteSummary(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = EnvMonSiteSummarySchema.safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getEnvMonZones returns ok: true with valid contract data', async () => {
    const result = await adapter.getEnvMonZones(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(EnvMonZoneSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getEnvMonAlerts returns ok: true with valid contract data', async () => {
    const result = await adapter.getEnvMonAlerts(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(EnvMonAlertSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getEnvMonSwabResults returns ok: true with valid contract data', async () => {
    const result = await adapter.getEnvMonSwabResults(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(EnvMonSwabResultSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getEnvMonTrends returns ok: true with valid contract data', async () => {
    const result = await adapter.getEnvMonTrends(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(EnvMonTrendSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getEnvMonHeatmap returns ok: true with valid contract data', async () => {
    const result = await adapter.getEnvMonHeatmap(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(EnvMonHeatmapCellSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getEnvMonCorrectiveActions returns ok: true with valid contract data', async () => {
    const result = await adapter.getEnvMonCorrectiveActions(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(EnvMonCorrectiveActionSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getEnvMonSwabVectors returns ok: true with valid contract data', async () => {
    const result = await adapter.getEnvMonSwabVectors(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(EnvMonSwabVectorSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('site summary confidence is within valid range [0,1]', async () => {
    const result = await adapter.getEnvMonSiteSummary(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.confidence).toBeGreaterThanOrEqual(0)
    expect(result.data.confidence).toBeLessThanOrEqual(1)
  })

  it('mock context shows elevated risk status', async () => {
    const result = await adapter.getEnvMonContext(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.overallRiskStatus).toBe('elevated')
  })

  it('mock context reports 3 active alerts', async () => {
    const result = await adapter.getEnvMonContext(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.activeAlerts).toBe(3)
  })
})
