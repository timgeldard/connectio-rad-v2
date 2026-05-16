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

function formatPointDate(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function ChartPlaceholder({ series }: { series: ControlChartSeries }) {
  const all = series.points.map(p => p.value)
  const rawMin = Math.min(...all, series.lowerControlLimit)
  const rawMax = Math.max(...all, series.upperControlLimit)
  const yPad = ((rawMax - rawMin) || 1) * 0.12
  const yMin = rawMin - yPad
  const yMax = rawMax + yPad
  const yRange = yMax - yMin

  const W = 480
  const H = 180
  const PAD_L = 44
  const PAD_R = 48
  const PAD_T = 12
  const PAD_B = 24
  const plotW = W - PAD_L - PAD_R
  const plotH = H - PAD_T - PAD_B
  const n = series.points.length

  function toX(i: number) {
    return PAD_L + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2)
  }

  function toY(v: number) {
    return PAD_T + (1 - (v - yMin) / yRange) * plotH
  }

  const yTicks: number[] = Array.from({ length: 5 }, (_, i) => yMin + (yRange * i) / 4)

  const labelStep = Math.max(1, Math.round((n - 1) / 5))
  const xLabelSet = new Set<number>()
  for (let i = 0; i < n; i += labelStep) xLabelSet.add(i)
  if (n > 0) xLabelSet.add(n - 1)

  return (
    <div
      style={{ background: 'var(--shell-surface-2)', borderRadius: 4, overflowX: 'auto' }}
      role="img"
      aria-label={`Control chart for ${series.characteristicName} — ${n} data points, UCL ${series.upperControlLimit.toFixed(2)}, CL ${series.centerLine.toFixed(2)}, LCL ${series.lowerControlLimit.toFixed(2)}`}
    >
      <svg width={W} height={H} style={{ display: 'block' }}>
        {/* Y-axis grid lines and value labels */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line x1={PAD_L} y1={toY(tick)} x2={PAD_L + plotW} y2={toY(tick)} stroke="var(--shell-line)" strokeWidth={0.5} />
            <text x={PAD_L - 4} y={toY(tick) + 3} textAnchor="end" fontSize={9} fill="var(--shell-fg-3)">{tick.toFixed(1)}</text>
          </g>
        ))}

        {/* UCL */}
        <line x1={PAD_L} y1={toY(series.upperControlLimit)} x2={PAD_L + plotW} y2={toY(series.upperControlLimit)} stroke="var(--sunset, #F24A00)" strokeWidth={1} strokeDasharray="4 3" />
        <text x={PAD_L + plotW + 3} y={toY(series.upperControlLimit) + 3} fontSize={8} fill="var(--sunset, #F24A00)">UCL {series.upperControlLimit.toFixed(1)}</text>

        {/* CL */}
        <line x1={PAD_L} y1={toY(series.centerLine)} x2={PAD_L + plotW} y2={toY(series.centerLine)} stroke="var(--shell-fg-3)" strokeWidth={1} />
        <text x={PAD_L + plotW + 3} y={toY(series.centerLine) + 3} fontSize={8} fill="var(--shell-fg-3)">CL {series.centerLine.toFixed(1)}</text>

        {/* LCL */}
        <line x1={PAD_L} y1={toY(series.lowerControlLimit)} x2={PAD_L + plotW} y2={toY(series.lowerControlLimit)} stroke="var(--sunset, #F24A00)" strokeWidth={1} strokeDasharray="4 3" />
        <text x={PAD_L + plotW + 3} y={toY(series.lowerControlLimit) + 3} fontSize={8} fill="var(--sunset, #F24A00)">LCL {series.lowerControlLimit.toFixed(1)}</text>

        {/* Spec limits */}
        {series.upperSpecLimit != null && (
          <line x1={PAD_L} y1={toY(series.upperSpecLimit)} x2={PAD_L + plotW} y2={toY(series.upperSpecLimit)} stroke="#D32F2F" strokeWidth={1} strokeDasharray="2 4" />
        )}
        {series.lowerSpecLimit != null && (
          <line x1={PAD_L} y1={toY(series.lowerSpecLimit)} x2={PAD_L + plotW} y2={toY(series.lowerSpecLimit)} stroke="#D32F2F" strokeWidth={1} strokeDasharray="2 4" />
        )}

        {/* Data series line */}
        {n > 1 && (
          <polyline
            fill="none"
            stroke="var(--shell-fg-2)"
            strokeWidth={1.5}
            points={series.points.map((p: ControlChartPoint, i: number) => `${toX(i)},${toY(p.value)}`).join(' ')}
          />
        )}

        {/* Data points */}
        {series.points.map((p: ControlChartPoint, i: number) => (
          <circle key={p.pointId} cx={toX(i)} cy={toY(p.value)} r={5} fill={STATUS_COLOR[p.status] ?? '#888'}>
            <title>{`${formatPointDate(p.timestamp)} — ${series.characteristicName}: ${p.value} ${series.unitOfMeasure} (${p.status.replace(/-/g, ' ')})`}</title>
          </circle>
        ))}

        {/* X-axis date labels */}
        {series.points.map((p: ControlChartPoint, i: number) => {
          if (!xLabelSet.has(i)) return null
          return (
            <text key={p.pointId} x={toX(i)} y={H - 6} textAnchor="middle" fontSize={9} fill="var(--shell-fg-3)">
              {formatPointDate(p.timestamp)}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
