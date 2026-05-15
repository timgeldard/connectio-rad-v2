import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { ControlChartSeries, ControlChartPoint } from '@connectio/data-contracts'
import { useControlChartSeries } from '../adapters/spc-monitoring-queries.js'
import type { SPCMonitoringAdapterRequest } from '../adapters/spc-monitoring-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'control-chart',
  displayName: 'Control Chart',
  description: 'Time-series control chart with UCL, LCL, centreline, and spec limits. Out-of-control points highlighted.',
  ownerDomain: 'spc',
  sourceOwnership: { domainId: 'spc', systemName: 'spc', legacyAppId: 'spc' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['spc-monitoring'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 120, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [{ permissionId: 'spc.read', displayName: 'SPC Read' }],
}

export interface ControlChartPanelProps {
  readonly request: SPCMonitoringAdapterRequest
}

const STATUS_COLOR: Record<string, string> = {
  'out-of-control': '#D32F2F',
  'warning': '#D97706',
  'in-control': '#388E3C',
}

export function ControlChartPanel({ request }: ControlChartPanelProps) {
  const { data: result, isLoading } = useControlChartSeries(request)
  const lastRefreshedAt = result?.ok ? result.fetchedAt : null
  const { displayState, markReady, markError } = useEvidencePanel({
    panelId: registration.panelId,
    staleAfterSeconds: registration.freshnessPolicy.staleAfterSeconds,
    lastRefreshedAt,
  })

  useEffect(() => {
    if (isLoading) return
    if (result?.ok) markReady()
    else if (result && !result.ok) markError()
  }, [isLoading, result, markReady, markError])

  const series: ControlChartSeries | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
    >
      {series && (
        <div style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
            <ChartStat label="UCL" value={series.upperControlLimit.toFixed(2)} color="var(--sunset, #F24A00)" />
            <ChartStat label="CL" value={series.centerLine.toFixed(2)} color="var(--shell-fg-2)" />
            <ChartStat label="LCL" value={series.lowerControlLimit.toFixed(2)} color="var(--sunset, #F24A00)" />
            {series.upperSpecLimit != null && <ChartStat label="USL" value={series.upperSpecLimit.toFixed(2)} color="#D32F2F" />}
            {series.lowerSpecLimit != null && <ChartStat label="LSL" value={series.lowerSpecLimit.toFixed(2)} color="#D32F2F" />}
          </div>

          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 6 }}>
            {series.characteristicName} — {series.chartType.toUpperCase()} ({series.unitOfMeasure}) · {series.points.length} points
          </div>

          {/* Production-shaped ASCII chart placeholder — upgrade path: replace with recharts/nivo */}
          <ChartPlaceholder series={series} />

          <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
            <LegendItem color={STATUS_COLOR['in-control']} label="In control" />
            <LegendItem color={STATUS_COLOR['warning']} label="Warning" />
            <LegendItem color={STATUS_COLOR['out-of-control']} label="Out of control" />
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}

function ChartStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: 10, color: 'var(--shell-fg-3)' }}>{label}</span>
    </div>
  )
}

function ChartPlaceholder({ series }: { series: ControlChartSeries }) {
  const all = series.points.map(p => p.value)
  const min = Math.min(...all, series.lowerControlLimit)
  const max = Math.max(...all, series.upperControlLimit)
  const range = max - min || 1

  const HEIGHT = 80
  const WIDTH = 320
  const PAD = 8

  function toY(v: number) {
    return PAD + (1 - (v - min) / range) * (HEIGHT - PAD * 2)
  }

  const plotW = WIDTH - PAD * 2
  const step = series.points.length > 1 ? plotW / (series.points.length - 1) : 0

  return (
    <div
      style={{ background: 'var(--shell-surface-2)', borderRadius: 4, padding: 4, overflowX: 'auto' }}
      role="img"
      aria-label={`Control chart for ${series.characteristicName} — ${series.points.length} data points, UCL ${series.upperControlLimit}, CL ${series.centerLine}, LCL ${series.lowerControlLimit}`}
    >
      <svg width={WIDTH} height={HEIGHT} style={{ display: 'block' }}>
        {/* UCL */}
        <line x1={PAD} y1={toY(series.upperControlLimit)} x2={WIDTH - PAD} y2={toY(series.upperControlLimit)} stroke="var(--sunset, #F24A00)" strokeWidth={1} strokeDasharray="4 3" />
        {/* CL */}
        <line x1={PAD} y1={toY(series.centerLine)} x2={WIDTH - PAD} y2={toY(series.centerLine)} stroke="var(--shell-fg-3)" strokeWidth={1} />
        {/* LCL */}
        <line x1={PAD} y1={toY(series.lowerControlLimit)} x2={WIDTH - PAD} y2={toY(series.lowerControlLimit)} stroke="var(--sunset, #F24A00)" strokeWidth={1} strokeDasharray="4 3" />

        {/* Line connecting points */}
        {series.points.length > 1 && (
          <polyline
            fill="none"
            stroke="var(--shell-fg-2)"
            strokeWidth={1.5}
            points={series.points.map((p, i) => `${PAD + i * step},${toY(p.value)}`).join(' ')}
          />
        )}

        {/* Data points */}
        {series.points.map((p: ControlChartPoint, i: number) => (
          <circle
            key={p.pointId}
            cx={PAD + i * step}
            cy={toY(p.value)}
            r={4}
            fill={STATUS_COLOR[p.status] ?? '#888'}
          >
            <title>{`${series.characteristicName}: ${p.value} (${p.status})`}</title>
          </circle>
        ))}
      </svg>
    </div>
  )
}
