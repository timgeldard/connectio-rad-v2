import type { WorkspaceRegistration } from '@connectio/product-model'

/**
 * Static Phase 0 workspace registry.
 *
 * Each entry is a minimal {@link WorkspaceRegistration} stub. Domain-integration
 * packages (e.g. `@connectio-di/traceability`) will extend or replace these
 * entries in Phase 1 once the dynamic manifest API is available.
 *
 * Lifecycle values follow the product model:
 * - `'live'`          — fully available, shown in nav by default
 * - `'concept-lab'`   — gated, hidden from navigation unless explicitly enabled
 */
export const workspaceRegistry: readonly WorkspaceRegistration[] = [
  {
    workspaceId: 'traceability-workspace',
    displayName: 'Traceability',
    description: 'Traceability workspace — Phase 0 stub',
    domainId: 'traceability',
    ownerDomain: 'traceability',
    lifecycle: 'live',
    supportedRoles: [],
    requiredPermissions: [],
    supportedScopes: ['batch'],
    scopePolicy: {
      supportedLevels: ['batch'],
      defaultLevel: 'batch',
      autoElevate: false,
    },
    defaultViews: [
      { viewId: 'trace', displayName: 'Trace', lifecycle: 'live', sortOrder: 0, defaultPanels: [] },
      { viewId: 'lineage', displayName: 'Lineage', lifecycle: 'live', sortOrder: 1, defaultPanels: [] },
    ],
    defaultPanels: [],
    route: '/traceability',
    personalizationPolicy: {
      allowPanelReorder: false,
      allowPanelHide: false,
      allowSavedFilters: false,
      allowDefaultScopeOverride: false,
    },
    drillThroughDefinitions: [],
    telemetryId: 'traceability.workspace',
  },
  {
    workspaceId: 'quality-workspace',
    displayName: 'Quality',
    description: 'Quality workspace — Phase 0 stub',
    domainId: 'quality',
    ownerDomain: 'quality',
    lifecycle: 'concept-lab',
    supportedRoles: [],
    requiredPermissions: [],
    supportedScopes: ['plant'],
    scopePolicy: {
      supportedLevels: ['plant'],
      defaultLevel: 'plant',
      autoElevate: false,
    },
    defaultViews: [
      { viewId: 'overview', displayName: 'Overview', lifecycle: 'concept-lab', sortOrder: 0, defaultPanels: [] },
    ],
    defaultPanels: [],
    route: '/quality',
    personalizationPolicy: {
      allowPanelReorder: false,
      allowPanelHide: false,
      allowSavedFilters: false,
      allowDefaultScopeOverride: false,
    },
    drillThroughDefinitions: [],
    telemetryId: 'quality.workspace',
  },
  {
    workspaceId: 'operations-workspace',
    displayName: 'Operations',
    description: 'Operations workspace — Phase 0 stub',
    domainId: 'operations',
    ownerDomain: 'operations',
    lifecycle: 'concept-lab',
    supportedRoles: [],
    requiredPermissions: [],
    supportedScopes: ['plant'],
    scopePolicy: {
      supportedLevels: ['plant'],
      defaultLevel: 'plant',
      autoElevate: false,
    },
    defaultViews: [
      { viewId: 'overview', displayName: 'Overview', lifecycle: 'concept-lab', sortOrder: 0, defaultPanels: [] },
    ],
    defaultPanels: [],
    route: '/operations',
    personalizationPolicy: {
      allowPanelReorder: false,
      allowPanelHide: false,
      allowSavedFilters: false,
      allowDefaultScopeOverride: false,
    },
    drillThroughDefinitions: [],
    telemetryId: 'operations.workspace',
  },
]
