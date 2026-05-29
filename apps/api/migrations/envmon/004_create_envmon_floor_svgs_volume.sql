-- Migration 004: create envmon_floor_svgs Unity Catalog Volume
--
-- Storage for SVG floor underlays uploaded by admins via the envmon
-- coordinate-authoring UI. Path convention enforced by the API:
--
--     /Volumes/<TRACE_CATALOG>/<TRACE_SCHEMA>/envmon_floor_svgs/<plant_id>/<floor_id>.svg
--
-- The API streams SVGs back to the browser through GET
-- /api/envmon/floors/{plant_id}/{floor_id}/svg — clients never see a raw UC
-- path. Files are stored as-is; the API sanitises on upload (removes script
-- tags, strips external references) and enforces a 2 MB ceiling.
--
-- Safe to run repeatedly — CREATE VOLUME IF NOT EXISTS is idempotent.
CREATE VOLUME IF NOT EXISTS `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`envmon_floor_svgs`
COMMENT 'EnvMon App: uploaded SVG floor-plan underlays (one per plant+floor)';
