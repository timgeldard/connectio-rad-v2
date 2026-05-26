import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

/** Active trace request resolved by the designed search experience. */
export interface ResolvedTraceConsumerRequest {
  readonly materialId: string
  readonly batchId: string
  readonly plantId: string
}

/** Structured criteria parsed from a two-part SAP material + batch search. */
export interface TraceConsumerCombinedSearchCriteria {
  readonly materialId: string
  readonly batchId: string
}

/** Search fixture row used by the Trace Consumer POC search flow. */
export interface TraceConsumerSearchItem {
  readonly materialId: string
  readonly materialDescription: string
  readonly batchId: string
  readonly plantId: string
  readonly plantName: string
  readonly processOrderId?: string | null
  readonly latestPostingDate?: string | null
  readonly quantity?: number | null
  readonly uom?: string | null
  readonly matchTypes?: readonly TraceConsumerSearchMatchType[]
}

export type TraceConsumerSearchMatchType =
  | 'material-id'
  | 'description'
  | 'batch-id'
  | 'process-order-id'

/** Plant option shown when a material/batch exists in more than one plant. */
export interface TraceConsumerPlantOption {
  readonly id: string
  readonly name: string
}

/** Batch search result grouped for the designed picker. */
export interface TraceConsumerMatchedBatch {
  readonly batchId: string
  readonly materialId: string
  readonly materialDescription: string
  readonly processOrderId?: string | null
  readonly latestPostingDate?: string | null
  readonly quantity?: number | null
  readonly uom?: string | null
  readonly matchTypes: readonly TraceConsumerSearchMatchType[]
  readonly plants: TraceConsumerPlantOption[]
}

/** Material search result grouped for the designed picker. */
export interface TraceConsumerMatchedMaterial {
  readonly materialId: string
  readonly description: string
  readonly batchId: string
  readonly processOrderId?: string | null
  readonly latestPostingDate?: string | null
  readonly quantity?: number | null
  readonly uom?: string | null
  readonly matchTypes: readonly TraceConsumerSearchMatchType[]
  readonly plants: TraceConsumerPlantOption[]
}

/** Search steps in the designed Trace Consumer journey. */
export type TraceConsumerSearchStep =
  | 'idle'
  | 'batches-for-material'
  | 'materials-for-batch'
  | 'select-plant'
  | 'no-results'

/** Primary tabs in the designed Trace Consumer investigation canvas. */
export type TraceConsumerTab =
  | 'lineage'
  | 'timeline'
  | 'risks'
  | 'insights'
  | 'passport'

export type TraceConsumerSearchResult =
  | {
      readonly step: 'batches-for-material'
      readonly batches: TraceConsumerMatchedBatch[]
      readonly selectedMaterial: { readonly id: string; readonly description: string } | null
    }
  | {
      readonly step: 'materials-for-batch'
      readonly materials: TraceConsumerMatchedMaterial[]
      readonly selectedBatch: string | null
    }
  | {
      readonly step: 'select-plant'
      readonly materialId: string
      readonly batchId: string
      readonly plants: readonly TraceConsumerPlantOption[]
    }
  | {
      readonly step: 'resolved'
      readonly request: ResolvedTraceConsumerRequest
    }
  | {
      readonly step: 'missing-plant'
      readonly message: string
    }
  | {
      readonly step: 'no-results'
    }

export type TraceConsumerSelectionResult =
  | {
      readonly step: 'select-plant'
      readonly materialId: string
      readonly batchId: string
      readonly plants: readonly TraceConsumerPlantOption[]
    }
  | {
      readonly step: 'resolved'
      readonly request: ResolvedTraceConsumerRequest
    }
  | {
      readonly step: 'missing-plant'
      readonly message: string
    }

/** Convert the designed-app request into the existing Trace2 query contract. */
export function createTraceConsumerAdapterRequest(
  request: ResolvedTraceConsumerRequest,
): Trace2AdapterRequest {
  return {
    materialId: request.materialId,
    batchId: request.batchId,
    plantId: request.plantId,
    investigationId: 'consumer-trace',
    direction: 'both',
    maxDepth: 2,
    maxEdges: 100,
  }
}

export function parseTraceConsumerCombinedSearch(
  rawQuery: string,
): TraceConsumerCombinedSearchCriteria | null {
  const tokens = rawQuery
    .trim()
    .split(/[\s/,]+/)
    .map(token => token.trim())
    .filter(Boolean)

  if (tokens.length !== 2) return null
  if (!tokens.every(token => /\d/.test(token))) return null

  return {
    materialId: tokens[0],
    batchId: tokens[1],
  }
}

export function resolveTraceConsumerSelection(
  materialId: string,
  batchId: string,
  plants: readonly TraceConsumerPlantOption[],
): TraceConsumerSelectionResult {
  const validPlants = plants.filter(plant => plant.id.trim())

  if (validPlants.length > 1) {
    return {
      step: 'select-plant',
      materialId,
      batchId,
      plants: validPlants,
    }
  }

  if (validPlants.length === 1) {
    return {
      step: 'resolved',
      request: {
        materialId,
        batchId,
        plantId: validPlants[0].id,
      },
    }
  }

  return {
    step: 'missing-plant',
    message: `Plant context is required before launching trace for material ${materialId} and batch ${batchId}.`,
  }
}

/** Resolve free-text search input into the next designed-app search state. */
export function resolveTraceConsumerSearch(
  rawQuery: string,
  searchItems: readonly TraceConsumerSearchItem[],
): TraceConsumerSearchResult {
  const query = rawQuery.trim()
  if (!query) return { step: 'no-results' }

  const combinedCriteria = parseTraceConsumerCombinedSearch(query)
  if (combinedCriteria) {
    return resolveCombinedMaterialBatchSearch(combinedCriteria, searchItems)
  }

  const matchedItems = searchItems
    .map(item => ({ item, matchTypes: getTraceConsumerMatchTypes(item, query) }))
    .filter(entry => entry.matchTypes.length > 0)

  const itemsByMaterial = matchedItems.filter(
    entry =>
      entry.matchTypes.includes('material-id') ||
      entry.matchTypes.includes('description'),
  )
  const itemsByBatchContext = matchedItems.filter(
    entry =>
      entry.matchTypes.includes('batch-id') ||
      entry.matchTypes.includes('process-order-id'),
  )

  if (itemsByMaterial.length > 0) {
    const batchesMap: Record<string, TraceConsumerMatchedBatch> = {}
    itemsByMaterial.forEach(({ item, matchTypes }) => {
      const key = `${item.materialId}:${item.batchId}`
      if (!batchesMap[key]) {
        batchesMap[key] = {
          batchId: item.batchId,
          materialId: item.materialId,
          materialDescription: item.materialDescription,
          processOrderId: item.processOrderId,
          latestPostingDate: item.latestPostingDate,
          quantity: item.quantity,
          uom: item.uom,
          matchTypes,
          plants: [],
        }
      }
      const plantId = item.plantId.trim()
      if (plantId && !batchesMap[key].plants.some(plant => plant.id === plantId)) {
        batchesMap[key].plants.push({ id: plantId, name: item.plantName || plantId })
      }
    })
    const batches = Object.values(batchesMap).sort(compareMatchedBatches)
    const materialIds = new Set(batches.map(batch => batch.materialId))
    return {
      step: 'batches-for-material',
      batches,
      selectedMaterial:
        materialIds.size === 1
          ? {
              id: batches[0].materialId,
              description: batches[0].materialDescription,
            }
          : null,
    }
  }

  if (itemsByBatchContext.length > 0) {
    const materialsMap: Record<string, TraceConsumerMatchedMaterial> = {}
    itemsByBatchContext.forEach(({ item, matchTypes }) => {
      const key = `${item.materialId}:${item.batchId}`
      if (!materialsMap[key]) {
        materialsMap[key] = {
          materialId: item.materialId,
          description: item.materialDescription,
          batchId: item.batchId,
          processOrderId: item.processOrderId,
          latestPostingDate: item.latestPostingDate,
          quantity: item.quantity,
          uom: item.uom,
          matchTypes,
          plants: [],
        }
      }
      const plantId = item.plantId.trim()
      if (plantId && !materialsMap[key].plants.some(plant => plant.id === plantId)) {
        materialsMap[key].plants.push({ id: plantId, name: item.plantName || plantId })
      }
    })
    const materials = Object.values(materialsMap).sort(compareMatchedMaterials)
    const batchIds = new Set(materials.map(material => material.batchId))
    return {
      step: 'materials-for-batch',
      materials,
      selectedBatch: batchIds.size === 1 ? materials[0].batchId : null,
    }
  }

  return { step: 'no-results' }
}

function resolveCombinedMaterialBatchSearch(
  criteria: TraceConsumerCombinedSearchCriteria,
  searchItems: readonly TraceConsumerSearchItem[],
): TraceConsumerSearchResult {
  const exactItems = searchItems
    .filter(item =>
      identifiersMatch(item.materialId, criteria.materialId) &&
      identifiersMatch(item.batchId, criteria.batchId),
    )
    .sort(compareSearchItems)

  if (exactItems.length === 0) return { step: 'no-results' }

  const first = exactItems[0]
  const plants = uniquePlants(exactItems)
  return resolveTraceConsumerSelection(first.materialId, first.batchId, plants)
}

function getTraceConsumerMatchTypes(
  item: TraceConsumerSearchItem,
  query: string,
): readonly TraceConsumerSearchMatchType[] {
  if (item.matchTypes?.length) return item.matchTypes

  const matchTypes: TraceConsumerSearchMatchType[] = []
  if (matchesQuery(item.materialId, query)) matchTypes.push('material-id')
  if (matchesQuery(item.materialDescription, query)) matchTypes.push('description')
  if (matchesQuery(item.batchId, query)) matchTypes.push('batch-id')
  if (matchesQuery(item.processOrderId ?? '', query)) matchTypes.push('process-order-id')
  return matchTypes
}

function uniquePlants(items: readonly TraceConsumerSearchItem[]): TraceConsumerPlantOption[] {
  const plants: TraceConsumerPlantOption[] = []
  items.forEach(item => {
    const plantId = item.plantId.trim()
    if (!plantId) return
    if (!plants.some(plant => plant.id === plantId)) {
      plants.push({ id: plantId, name: item.plantName || plantId })
    }
  })
  return plants
}

function identifiersMatch(value: string, expected: string): boolean {
  return value.trim().toLowerCase() === expected.trim().toLowerCase()
}

function compareSearchItems(a: TraceConsumerSearchItem, b: TraceConsumerSearchItem): number {
  return (
    compareDatesDesc(a.latestPostingDate, b.latestPostingDate) ||
    compareNumbersDesc(a.quantity, b.quantity) ||
    a.batchId.localeCompare(b.batchId) ||
    a.materialId.localeCompare(b.materialId) ||
    a.plantId.localeCompare(b.plantId)
  )
}

function compareMatchedBatches(a: TraceConsumerMatchedBatch, b: TraceConsumerMatchedBatch): number {
  return (
    compareDatesDesc(a.latestPostingDate, b.latestPostingDate) ||
    compareNumbersDesc(a.quantity, b.quantity) ||
    a.batchId.localeCompare(b.batchId) ||
    a.materialId.localeCompare(b.materialId)
  )
}

function compareMatchedMaterials(a: TraceConsumerMatchedMaterial, b: TraceConsumerMatchedMaterial): number {
  return (
    compareDatesDesc(a.latestPostingDate, b.latestPostingDate) ||
    compareNumbersDesc(a.quantity, b.quantity) ||
    a.batchId.localeCompare(b.batchId) ||
    a.materialId.localeCompare(b.materialId)
  )
}

function compareDatesDesc(a: string | null | undefined, b: string | null | undefined): number {
  const aTime = toTime(a)
  const bTime = toTime(b)
  if (aTime === null && bTime === null) return 0
  if (aTime === null) return 1
  if (bTime === null) return -1
  return bTime - aTime
}

function compareNumbersDesc(a: number | null | undefined, b: number | null | undefined): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return b - a
}

function toTime(value: string | null | undefined): number | null {
  if (!value) return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : time
}

function matchesQuery(value: string, rawQuery: string): boolean {
  const query = rawQuery.trim()
  if (!value || !query) return false

  if (!query.includes('*') && !query.includes('%')) {
    return value.toLowerCase().includes(query.toLowerCase())
  }

  const regex = new RegExp(
    `^${query.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*')}$`,
    'i',
  )
  return regex.test(value)
}
