# EnvMon app-managed tables — migrations

App-owned silver tables that back the envmon-consumer workspace. They are
**not** SAP gold tables — they are V2-application state authored by the
admin UI and read by every envmon screen.

| Migration | Object | Purpose |
|---|---|---|
| `001_create_em_floors.sql` | `em_floors` | Per-plant floor catalogue with optional SVG underlay. |
| `002_create_em_sub_areas.sql` | `em_sub_areas` | L4 custom polygons drawn by admins to enclose swab points. |
| `003_create_em_location_coordinates.sql` | `em_location_coordinates` | L5 swab-point pins (SAP TPLNR → floor + L4 polygon + percentage X/Y). |
| `004_create_envmon_floor_svgs_volume.sql` | `envmon_floor_svgs` UC Volume | Storage for uploaded SVG floor underlays. |

All identifiers use the standard envmon resolution: `${TRACE_CATALOG}.${TRACE_SCHEMA}` for tables, same for the Volume.

## Applying

Run each file in order via the Databricks SQL editor (or `databricks sql -f`) against the target environment's warehouse. `CREATE TABLE IF NOT EXISTS` / `CREATE VOLUME IF NOT EXISTS` make every script idempotent — safe to re-run.

## Coordinate convention

`x_pct` and `y_pct` are percentages of the floor SVG viewBox (`0.0–100.0`).
Pixels are deliberately not stored so markers remain anchored regardless of
client viewport size or eventual SVG re-render.

## Audit fields

Every table carries `updated_by` (`CURRENT_USER()` at write time) and
`updated_at` (`CURRENT_TIMESTAMP()`). Writes that omit these are rejected by
`shared.query_service.write_spec.assert_write_spec_has_audit`.
