-- Migration 002: create em_sub_areas
--
-- L4 custom polygons. Each row is one closed polygon authored on a specific
-- (plant_id, floor_id) by an admin. Polygons enclose the L5 swab points
-- (em_location_coordinates) and constrain where new pins can be dropped:
-- the API performs a point-in-polygon check on every coordinate upsert.
--
-- polygon_pts is a JSON array of [x_pct, y_pct] pairs in viewBox percentages
-- (0.0–100.0). Stored as STRING for flexibility; can be promoted to a STRUCT
-- once the access patterns stabilise. The API validates: ≥3 distinct points,
-- simple polygon (no self-intersection), all coordinates within 0–100.
--
-- Safe to run repeatedly — CREATE TABLE IF NOT EXISTS is idempotent.
CREATE TABLE IF NOT EXISTS `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_sub_areas` (
    area_id      STRING NOT NULL COMMENT 'App-generated UUID — stable across renames',
    plant_id     STRING NOT NULL COMMENT 'SAP plant code; matches em_floors.plant_id',
    floor_id     STRING NOT NULL COMMENT 'Floor identifier; matches em_floors.floor_id',
    l4_code      STRING NOT NULL COMMENT 'L4 hierarchy code (e.g. MIX, FIL, DRN, RTE)',
    display_name STRING NOT NULL COMMENT 'Human-readable area label',
    polygon_pts  STRING NOT NULL COMMENT 'JSON: [[x_pct, y_pct], ...] in % of the floor viewBox',
    updated_by   STRING NOT NULL COMMENT 'Databricks identity that last edited (CURRENT_USER())',
    updated_at   TIMESTAMP NOT NULL COMMENT 'Server timestamp of last edit (CURRENT_TIMESTAMP())'
)
USING DELTA
COMMENT 'EnvMon App: L4 custom polygon definitions per (plant, floor)'
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'false',
    'delta.autoOptimize.optimizeWrite' = 'true',
    'delta.autoOptimize.autoCompact' = 'true'
);
