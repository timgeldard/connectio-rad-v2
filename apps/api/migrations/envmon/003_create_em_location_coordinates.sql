-- Migration 003: create em_location_coordinates
--
-- L5 swab-point pins. Maps each SAP functional location (TPLNR) to a single
-- percentage-coordinate position on a (plant_id, floor_id) inside a parent
-- L4 polygon (area_id).
--
-- The L5-in-L4 containment is enforced at write time: every upsert runs a
-- server-side point-in-polygon test against em_sub_areas.polygon_pts. The
-- column is NOT NULL — pins cannot exist without a parent area.
--
-- One row per functional location: a TPLNR can only be in one place at a
-- time, so the natural key is (func_loc_id). MERGE patterns in the API
-- guarantee idempotency.
--
-- Safe to run repeatedly — CREATE TABLE IF NOT EXISTS is idempotent.
CREATE TABLE IF NOT EXISTS `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_location_coordinates` (
    func_loc_id  STRING NOT NULL COMMENT 'SAP functional location (TPLNR) — natural primary key',
    plant_id     STRING NOT NULL COMMENT 'SAP plant code; matches em_floors.plant_id',
    floor_id     STRING NOT NULL COMMENT 'Floor identifier; matches em_floors.floor_id',
    area_id      STRING NOT NULL COMMENT 'Parent L4 polygon (em_sub_areas.area_id) — required',
    x_pct        DOUBLE NOT NULL COMMENT 'X position as percentage of floor viewBox width (0.0–100.0)',
    y_pct        DOUBLE NOT NULL COMMENT 'Y position as percentage of floor viewBox height (0.0–100.0)',
    updated_by   STRING NOT NULL COMMENT 'Databricks identity that last edited (CURRENT_USER())',
    updated_at   TIMESTAMP NOT NULL COMMENT 'Server timestamp of last edit (CURRENT_TIMESTAMP())'
)
USING DELTA
COMMENT 'EnvMon App: SAP functional location → floor + L4 polygon + X/Y percentage'
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'false',
    'delta.autoOptimize.optimizeWrite' = 'true',
    'delta.autoOptimize.autoCompact' = 'true'
);
