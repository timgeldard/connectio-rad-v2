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

  // Defensively filter for points with valid numbers
  const validPoints = series?.points?.filter(
    (p): p is ControlChartPoint & { value: number } =>
      p != null && typeof p.value === 'number' && !isNaN(p.value)
  ) ?? []

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {series && (
        <div style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 6 }}>
            {series.characteristicName} — {series.chartType.toUpperCase()} ({series.unitOfMeasure}) · {validPoints.length} points
          </div>

          {validPoints.length === 0 ? (
            <div
              style={{ padding: '24px 0', textAlign: 'center', color: 'var(--shell-fg-3)', fontSize: 12 }}
              role="status"
            >
              No measurement data found for this characteristic.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 12 }}>
                {(series.upperControlLimit != null || series.centerLine != null || series.lowerControlLimit != null) && (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginRight: 4 }}>Control Limits:</span>
                    {series.upperControlLimit != null && <ChartStat label="UCL" value={series.upperControlLimit.toFixed(2)} color="var(--sunset, #F24A00)" />}
                    {series.centerLine != null && <ChartStat label="CL" value={series.centerLine.toFixed(2)} color="var(--shell-fg-2)" />}
                    {series.lowerControlLimit != null && <ChartStat label="LCL" value={series.lowerControlLimit.toFixed(2)} color="var(--sunset, #F24A00)" />}
                  </div>
                )}
                {(series.upperSpecLimit != null || series.lowerSpecLimit != null) && (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', borderLeft: '1px solid var(--shell-line)', paddingLeft: 16 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginRight: 4 }}>Specification Limits:</span>
                    {series.upperSpecLimit != null && <ChartStat label="USL" value={series.upperSpecLimit.toFixed(2)} color="#D32F2F" />}
                    {series.lowerSpecLimit != null && <ChartStat label="LSL" value={series.lowerSpecLimit.toFixed(2)} color="#D32F2F" />}
                  </div>
                )}
              </div>

              {series.upperControlLimit == null && series.lowerControlLimit == null && series.centerLine == null ? (
                <div
                  style={{ padding: '6px 10px', marginBottom: 8, background: 'var(--shell-warn-bg, rgba(199, 130, 28, 0.05))', border: '1px solid var(--shell-warn-border, rgba(199, 130, 28, 0.2))', borderRadius: 4, fontSize: 11, color: 'var(--shell-warn, #C7821C)', lineHeight: 1.4 }}
                  role="status"
                >
                  Control limits not calculated (minimum samples/configuration required) — cannot evaluate process control state.
                </div>
              ) : series.approvalState !== 'approved' ? (
                <div
                  style={{ padding: '6px 10px', marginBottom: 8, background: 'var(--shell-warn-bg, rgba(199, 130, 28, 0.05))', border: '1px solid var(--shell-warn-border, rgba(199, 130, 28, 0.3))', borderRadius: 4, fontSize: 11, color: 'var(--shell-warn, #C7821C)', lineHeight: 1.4 }}
                  role="status"
                >
                  <span style={{ fontWeight: 600, display: 'block', marginBottom: 2 }}>
                    ⚠️ Control-limit approval source not verified ({series.approvalState?.replace(/-/g, ' ') || 'unknown'})
                  </span>
                  Do not use this chart for operational process-control decisions until approved limits are validated.
                  {series.limitProvenance && (
                    <span style={{ display: 'block', marginTop: 2, fontSize: 10, opacity: 0.8 }}>
                      Source: {series.limitProvenance.replace(/-/g, ' ')}
                    </span>
                  )}
                </div>
              ) : null}

              {validPoints.length > 0 && validPoints.length < 3 && (series.upperControlLimit != null || series.lowerControlLimit != null || series.centerLine != null) && (
                <div
                  style={{ padding: '4px 8px', marginBottom: 8, background: 'var(--shell-warn-bg, rgba(199, 130, 28, 0.05))', border: '1px solid var(--shell-warn, #C7821C)', borderRadius: 4, fontSize: 11, color: 'var(--shell-warn, #C7821C)' }}
                  role="status"
                >
                  Fewer than 3 samples — control limits are indicative only.
                </div>
              )}

              <ChartPlaceholder series={{ ...series, points: validPoints }} />

              <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
                <LegendItem color={STATUS_COLOR['in-control']} label="No signals returned" />
                <LegendItem color={STATUS_COLOR['warning']} label="Warning" />
                <LegendItem color={STATUS_COLOR['out-of-control']} label="Active SPC signal" />
              </div>
            </>
          )}
        </div>
      )}
    </EvidencePanel>
  )
}

const STATUS_COLOR: Record<string, string> = {
  'out-of-control': 'var(--shell-bad, #C73315)',
  'warning': 'var(--shell-warn, #C7821C)',
  'in-control': 'var(--shell-good, #1F8B4C)',
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

function formatPointDate(ts: string | null | undefined): string {
  if (!ts) return 'N/A'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return 'N/A'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function ChartPlaceholder({ series }: { series: ControlChartSeries }) {
  const all = series.points.map(p => p.value)
  
  // Defensively build list of existing limit values to avoid Math.min/max returning NaN
  const limitValues = [
    series.lowerControlLimit,
    series.upperControlLimit,
    series.centerLine,
    series.lowerSpecLimit,
    series.upperSpecLimit,
  ].filter((v): v is number => v != null)

  const rawMin = Math.min(...all, ...limitValues)
  const rawMax = Math.max(...all, ...limitValues)
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

  const uclText = series.upperControlLimit != null ? `UCL ${series.upperControlLimit.toFixed(1)}` : 'UCL N/A'
  const clText = series.centerLine != null ? `CL ${series.centerLine.toFixed(1)}` : 'CL N/A'
  const lclText = series.lowerControlLimit != null ? `LCL ${series.lowerControlLimit.toFixed(1)}` : 'LCL N/A'

  return (
    <div
      style={{ background: 'var(--shell-surface-2)', borderRadius: 4, overflowX: 'auto' }}
      role="img"
      aria-label={`Control chart for ${series.characteristicName} — ${n} data points, UCL ${series.upperControlLimit?.toFixed(2) ?? 'N/A'}, CL ${series.centerLine?.toFixed(2) ?? 'N/A'}, LCL ${series.lowerControlLimit?.toFixed(2) ?? 'N/A'}`}
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
        {series.upperControlLimit != null && (
          <g>
            <line x1={PAD_L} y1={toY(series.upperControlLimit)} x2={PAD_L + plotW} y2={toY(series.upperControlLimit)} stroke="var(--sunset, #F24A00)" strokeWidth={1} strokeDasharray="4 3" />
            <text x={PAD_L + plotW + 3} y={toY(series.upperControlLimit) + 3} fontSize={8} fill="var(--sunset, #F24A00)">{uclText}</text>
          </g>
        )}

        {/* CL */}
        {series.centerLine != null && (
          <g>
            <line x1={PAD_L} y1={toY(series.centerLine)} x2={PAD_L + plotW} y2={toY(series.centerLine)} stroke="var(--shell-fg-3)" strokeWidth={1} />
            <text x={PAD_L + plotW + 3} y={toY(series.centerLine) + 3} fontSize={8} fill="var(--shell-fg-3)">{clText}</text>
          </g>
        )}

        {/* LCL */}
        {series.lowerControlLimit != null && (
          <g>
            <line x1={PAD_L} y1={toY(series.lowerControlLimit)} x2={PAD_L + plotW} y2={toY(series.lowerControlLimit)} stroke="var(--sunset, #F24A00)" strokeWidth={1} strokeDasharray="4 3" />
            <text x={PAD_L + plotW + 3} y={toY(series.lowerControlLimit) + 3} fontSize={8} fill="var(--sunset, #F24A00)">{lclText}</text>
          </g>
        )}

        {/* Spec limits */}
        {series.upperSpecLimit != null && (
          <g>
            <line x1={PAD_L} y1={toY(series.upperSpecLimit)} x2={PAD_L + plotW} y2={toY(series.upperSpecLimit)} stroke="#D32F2F" strokeWidth={1} strokeDasharray="2 4" />
            <text x={PAD_L + plotW + 3} y={toY(series.upperSpecLimit) + 3} fontSize={8} fill="#D32F2F">USL {series.upperSpecLimit.toFixed(1)}</text>
          </g>
        )}
        {series.lowerSpecLimit != null && (
          <g>
            <line x1={PAD_L} y1={toY(series.lowerSpecLimit)} x2={PAD_L + plotW} y2={toY(series.lowerSpecLimit)} stroke="#D32F2F" strokeWidth={1} strokeDasharray="2 4" />
            <text x={PAD_L + plotW + 3} y={toY(series.lowerSpecLimit) + 3} fontSize={8} fill="#D32F2F">LSL {series.lowerSpecLimit.toFixed(1)}</text>
          </g>
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
