-- Migration 001: create em_floors
--
-- Per-plant floor catalogue. Each row is one floor under one plant, with
-- optional SVG background underlay. Authored exclusively by the envmon
-- Admin view; consumed by every envmon screen for floor metadata + status
-- aggregates.
--
-- SVG underlays live in the envmon_floor_svgs Unity Catalog Volume; this
-- table only carries the path. The API streams the file on demand so the
-- browser never sees a raw UC Volume URL.
--
-- Safe to run repeatedly — CREATE TABLE IF NOT EXISTS is idempotent.
CREATE TABLE IF NOT EXISTS `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_floors` (
    plant_id    STRING  NOT NULL COMMENT 'SAP plant code (gold_plant.PLANT_ID)',
    floor_id    STRING  NOT NULL COMMENT 'Application floor identifier (e.g. F1, F2, F3)',
    floor_name  STRING  NOT NULL COMMENT 'Human-readable floor label (e.g. Ground — Processing)',
    svg_path    STRING            COMMENT 'UC Volume path to the SVG underlay; NULL when no background uploaded',
    svg_width   INT     NOT NULL COMMENT 'SVG viewBox width in pixels — used to scale percentage coords',
    svg_height  INT     NOT NULL COMMENT 'SVG viewBox height in pixels',
    sort_order  INT     NOT NULL COMMENT 'Display order for the floor card grid (ascending)',
    is_active   BOOLEAN NOT NULL COMMENT 'Soft-delete flag; FALSE hides the floor from all UIs',
    updated_by  STRING  NOT NULL COMMENT 'Databricks identity that last edited this row (CURRENT_USER())',
    updated_at  TIMESTAMP NOT NULL COMMENT 'Server timestamp of last edit (CURRENT_TIMESTAMP())'
)
USING DELTA
COMMENT 'EnvMon App: per-plant floor catalogue + SVG underlay metadata'
TBLPROPERTIES (
    'delta.enableChangeDataFeed' = 'false',
    'delta.autoOptimize.optimizeWrite' = 'true',
    'delta.autoOptimize.autoCompact' = 'true'
);
