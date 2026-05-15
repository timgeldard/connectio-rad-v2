import type { CSSProperties } from 'react'
import { StockOverviewPanel } from '../panels/stock-overview-panel.js'
import { LocationCapacityPanel } from '../panels/location-capacity-panel.js'
import type { Warehouse360AdapterRequest } from '../adapters/warehouse-360-adapter.js'

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export interface StockStatusViewProps {
  readonly request: Warehouse360AdapterRequest
}

export function StockStatusView({ request }: StockStatusViewProps) {
  return (
    <div style={GRID}>
      <StockOverviewPanel request={request} />
      <LocationCapacityPanel request={request} />
    </div>
  )
}
