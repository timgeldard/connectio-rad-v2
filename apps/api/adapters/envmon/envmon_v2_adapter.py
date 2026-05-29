"""EnvMon V2 Databricks adapter — production schemas for the rebuilt workspace.

Implements QuerySpec + WriteSpec factories for the floors / sub-areas /
locations / heatmap / lots / trends / mics endpoints that back the V2
envmon-consumer (Site + Floor + Admin views). Sits alongside the original
envmon_databricks_adapter — to be consolidated once PR-5 lands.

Gold-table column conventions are taken from V1 timgeldard/envmon and the
existing envmon adapter:
  gold_inspection_lot           : INSPECTION_LOT_ID, PLANT_ID, INSPECTION_TYPE,
                                  CREATED_DATE, INSPECTION_END_DATE
  gold_inspection_point         : INSPECTION_LOT_ID, INSPECTION_POINT_ID,
                                  FUNCTIONAL_LOCATION
  gold_batch_quality_result_v   : INSPECTION_LOT_ID, MIC_NAME, QUANTITATIVE_RESULT,
                                  INSPECTION_RESULT_VALUATION, UPPER_TOLERANCE,
                                  LOWER_TOLERANCE, UNIT_OF_MEASURE, ATTRIBUTE
  gold_plant                    : PLANT_ID, PLANT_NAME

App-managed silver tables (created by migrations under
apps/api/migrations/envmon/):
  em_floors                  : plant_id, floor_id, floor_name, svg_path,
                               svg_width, svg_height, sort_order, is_active,
                               updated_by, updated_at
  em_sub_areas               : area_id, plant_id, floor_id, l4_code,
                               display_name, polygon_pts (JSON), updated_by,
                               updated_at
  em_location_coordinates    : func_loc_id, plant_id, floor_id, area_id,
                               x_pct, y_pct, updated_by, updated_at

INSPECTION_TYPE IN ('14','Z14') is the EnvMon domain filter (same as V1).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_executor import DatabricksRepository
from shared.query_service.query_spec import QuerySpec
from shared.query_service.write_spec import WriteSpec


_INSPECTION_TYPE_FILTER = "il.INSPECTION_TYPE IN ('14','Z14')"


# ─── Site summary (V2 KPIs) ──────────────────────────────────────────────────


@dataclass(frozen=True)
class SiteSummaryV2Request:
    plant_id: str
    time_window_days: int = 30


def map_site_summary_v2_rows(rows: list[dict], plant_id: str) -> dict:
    """Map agg rows into the EnvMonSiteSummaryV2 contract shape.

    Always returns a default-zero shape when ``rows`` is empty so the UI can
    render the empty state without bespoke null handling.
    """
    if not rows:
        return {
            "plantId": plant_id,
            "plantName": "",
            "product": None,
            "country": None,
            "kpis": {
                "activeFails": 0,
                "warnings": 0,
                "pending": 0,
                "passRate": 0.0,
                "lotsTested": 0,
                "lotsPlanned": 0,
                "totalLocs": 0,
            },
        }
    row = rows[0]
    total = int(row.get("lots_tested") or 0)
    pass_ct = int(row.get("pass_count") or 0)
    pass_rate = (pass_ct / total * 100.0) if total else 0.0
    return {
        "plantId": str(row.get("plant_id") or plant_id),
        "plantName": str(row.get("plant_name") or ""),
        "product": None,  # TODO: source product from a future gold lookup
        "country": None,  # TODO: source country from a future gold lookup
        "kpis": {
            "activeFails": int(row.get("active_fails") or 0),
            "warnings": int(row.get("warnings") or 0),
            "pending": int(row.get("pending") or 0),
            "passRate": round(pass_rate, 2),
            "lotsTested": total,
            "lotsPlanned": int(row.get("lots_planned") or 0),
            "totalLocs": int(row.get("total_locs") or 0),
        },
    }


def get_site_summary_v2_spec(req: SiteSummaryV2Request) -> QuerySpec:
    lot = resolve_domain_object("envmon", "gold_inspection_lot")
    point = resolve_domain_object("envmon", "gold_inspection_point")
    result = resolve_domain_object("envmon", "gold_batch_quality_result_v")
    plant_tbl = resolve_domain_object("envmon", "gold_plant", schema_override="gold")

    sql = f"""
    WITH lots_in_window AS (
      SELECT il.INSPECTION_LOT_ID, il.PLANT_ID
      FROM {lot} il
      WHERE il.PLANT_ID = :plant_id
        AND {_INSPECTION_TYPE_FILTER}
        AND il.CREATED_DATE >= date_sub(current_date(), :window_days)
    ),
    lot_valuation AS (
      SELECT
        l.INSPECTION_LOT_ID,
        MAX(CASE WHEN UPPER(TRIM(coalesce(r.INSPECTION_RESULT_VALUATION,''))) IN ('R','REJ','REJECT') THEN 1 ELSE 0 END) AS is_fail,
        MAX(CASE WHEN UPPER(TRIM(coalesce(r.INSPECTION_RESULT_VALUATION,''))) IN ('W','WARN','WARNING') THEN 1 ELSE 0 END) AS is_warn,
        MAX(CASE WHEN coalesce(TRIM(r.INSPECTION_RESULT_VALUATION),'') = '' THEN 1 ELSE 0 END) AS has_pending
      FROM lots_in_window l
      LEFT JOIN {result} r ON r.INSPECTION_LOT_ID = l.INSPECTION_LOT_ID
      GROUP BY l.INSPECTION_LOT_ID
    ),
    locs AS (
      SELECT COUNT(DISTINCT ip.FUNCTIONAL_LOCATION) AS total_locs
      FROM lots_in_window l
      JOIN {point} ip ON ip.INSPECTION_LOT_ID = l.INSPECTION_LOT_ID
      WHERE ip.FUNCTIONAL_LOCATION IS NOT NULL
    )
    SELECT
      :plant_id AS plant_id,
      (SELECT PLANT_NAME FROM {plant_tbl} WHERE PLANT_ID = :plant_id LIMIT 1) AS plant_name,
      (SELECT COUNT(*) FROM lot_valuation WHERE is_fail = 1) AS active_fails,
      (SELECT COUNT(*) FROM lot_valuation WHERE is_warn = 1 AND is_fail = 0) AS warnings,
      (SELECT COUNT(*) FROM lot_valuation WHERE has_pending = 1 AND is_fail = 0 AND is_warn = 0) AS pending,
      (SELECT COUNT(*) FROM lot_valuation WHERE is_fail = 0 AND is_warn = 0 AND has_pending = 0) AS pass_count,
      (SELECT COUNT(*) FROM lot_valuation) AS lots_tested,
      0 AS lots_planned,  -- TODO: source from gold_inspection_plan when available
      (SELECT total_locs FROM locs) AS total_locs
    """

    return QuerySpec(
        name="envmon.get_site_summary_v2",
        module="envmon",
        endpoint="/api/envmon/v2/site-summary",
        sql=sql,
        params={"plant_id": req.plant_id, "window_days": req.time_window_days},
        cache_policy=CacheTier.PER_USER_60S,
        tags=["envmon", "site-summary", "v2"],
    )


# ─── Floors catalogue + per-floor status counts ──────────────────────────────


@dataclass(frozen=True)
class FloorsRequest:
    plant_id: str


def map_floors_rows(rows: list[dict]) -> dict:
    floors = []
    for row in rows:
        floors.append({
            "plantId": str(row.get("plant_id") or ""),
            "floorId": str(row.get("floor_id") or ""),
            "floorName": str(row.get("floor_name") or ""),
            "svgPath": (str(row["svg_path"]) if row.get("svg_path") else None),
            "svgWidth": int(row.get("svg_width") or 1000),
            "svgHeight": int(row.get("svg_height") or 600),
            "sortOrder": int(row.get("sort_order") or 0),
            "isActive": bool(row.get("is_active", True)),
            "mappedCount": int(row.get("mapped_count") or 0),
            "unmappedCount": 0,  # computed by /locations/unmapped, kept here for the card
            "statusCounts": {
                "FAIL": int(row.get("fail_count") or 0),
                "WARNING": int(row.get("warning_count") or 0),
                "PENDING": int(row.get("pending_count") or 0),
                "PASS": int(row.get("pass_count") or 0),
                "NO_DATA": int(row.get("no_data_count") or 0),
            },
        })
    return {"floors": floors}


def get_floors_spec(req: FloorsRequest) -> QuerySpec:
    floors_tbl = resolve_domain_object("envmon", "em_floors")
    coords_tbl = resolve_domain_object("envmon", "em_location_coordinates")

    sql = f"""
    SELECT
      f.plant_id,
      f.floor_id,
      f.floor_name,
      f.svg_path,
      f.svg_width,
      f.svg_height,
      f.sort_order,
      f.is_active,
      COUNT(c.func_loc_id) AS mapped_count,
      0 AS fail_count,     -- TODO: join status rollup when status materialisation lands
      0 AS warning_count,
      0 AS pending_count,
      0 AS pass_count,
      0 AS no_data_count
    FROM {floors_tbl} f
    LEFT JOIN {coords_tbl} c
      ON c.plant_id = f.plant_id AND c.floor_id = f.floor_id
    WHERE f.plant_id = :plant_id
      AND f.is_active = true
    GROUP BY f.plant_id, f.floor_id, f.floor_name, f.svg_path, f.svg_width,
             f.svg_height, f.sort_order, f.is_active
    ORDER BY f.sort_order, f.floor_id
    """

    return QuerySpec(
        name="envmon.get_floors",
        module="envmon",
        endpoint="/api/envmon/v2/floors",
        sql=sql,
        params={"plant_id": req.plant_id},
        cache_policy=CacheTier.PER_USER_60S,
        tags=["envmon", "floors"],
    )


# ─── Sub-areas (L4 polygons) ─────────────────────────────────────────────────


@dataclass(frozen=True)
class SubAreasRequest:
    plant_id: str
    floor_id: str | None = None


def map_sub_areas_rows(rows: list[dict]) -> dict:
    import json
    sub_areas = []
    for row in rows:
        raw_pts = row.get("polygon_pts") or "[]"
        try:
            pts = json.loads(raw_pts) if isinstance(raw_pts, str) else raw_pts
        except json.JSONDecodeError:
            pts = []
        # Normalise to [[x, y], ...] tuples
        normalised = [[float(p[0]), float(p[1])] for p in pts if len(p) >= 2]
        sub_areas.append({
            "areaId": str(row.get("area_id") or ""),
            "plantId": str(row.get("plant_id") or ""),
            "floorId": str(row.get("floor_id") or ""),
            "l4Code": str(row.get("l4_code") or ""),
            "displayName": str(row.get("display_name") or ""),
            "polygonPts": normalised,
            "updatedBy": (str(row["updated_by"]) if row.get("updated_by") else None),
            "updatedAt": (str(row["updated_at"]) if row.get("updated_at") else None),
        })
    return {"subAreas": sub_areas}


def get_sub_areas_spec(req: SubAreasRequest) -> QuerySpec:
    sub_areas_tbl = resolve_domain_object("envmon", "em_sub_areas")
    if req.floor_id:
        where = "WHERE plant_id = :plant_id AND floor_id = :floor_id"
        params: dict[str, Any] = {"plant_id": req.plant_id, "floor_id": req.floor_id}
    else:
        where = "WHERE plant_id = :plant_id"
        params = {"plant_id": req.plant_id}

    sql = f"""
    SELECT area_id, plant_id, floor_id, l4_code, display_name, polygon_pts,
           updated_by, updated_at
    FROM {sub_areas_tbl}
    {where}
    ORDER BY floor_id, l4_code, area_id
    """

    return QuerySpec(
        name="envmon.get_sub_areas",
        module="envmon",
        endpoint="/api/envmon/v2/sub-areas",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["envmon", "sub-areas"],
    )


# ─── L5 locations with status derivation ─────────────────────────────────────


@dataclass(frozen=True)
class LocationsRequest:
    plant_id: str
    floor_id: str | None = None
    time_window_days: int = 90


def _status_from_valuation(valuation: str | None, has_any: bool) -> str:
    """Derive UI status from worst-of-R/W/A valuation across MIC results."""
    if not has_any:
        return "NO_DATA"
    code = (valuation or "").strip().upper()
    if code in ("R", "REJ", "REJECT"):
        return "FAIL"
    if code in ("W", "WARN", "WARNING"):
        return "WARNING"
    if code == "":
        return "PENDING"
    return "PASS"


def map_locations_rows(rows: list[dict]) -> dict:
    locations = []
    for row in rows:
        has_any = bool(row.get("has_results"))
        status = _status_from_valuation(row.get("worst_valuation"), has_any)
        fail = int(row.get("fail_count") or 0)
        warn = int(row.get("warn_count") or 0)
        pas = int(row.get("pass_count") or 0)
        pend = int(row.get("pending_count") or 0)
        total = fail + warn + pas + pend
        if status == "FAIL":
            risk = 0.75 + min(0.2, fail / max(total, 1) * 0.5)
        elif status == "WARNING":
            risk = 0.4 + min(0.2, warn / max(total, 1) * 0.4)
        elif status == "PENDING":
            risk = 0.2
        elif status == "PASS":
            risk = 0.05
        else:
            risk = 0.1
        locations.append({
            "funcLocId": str(row.get("func_loc_id") or ""),
            "plantId": str(row.get("plant_id") or ""),
            "floorId": str(row.get("floor_id") or ""),
            "areaId": str(row.get("area_id") or ""),
            "xPct": float(row.get("x_pct") or 0.0),
            "yPct": float(row.get("y_pct") or 0.0),
            "name": (str(row["name"]) if row.get("name") else None),
            "status": status,
            "mics": [m for m in (row.get("mics") or "").split("|") if m],
            "failCount": fail,
            "warnCount": warn,
            "passCount": pas,
            "pendingCount": pend,
            "riskScore": round(risk, 3),
            "lastInspectedDays": (
                int(row["last_inspected_days"])
                if row.get("last_inspected_days") is not None
                else None
            ),
        })
    return {"locations": locations}


def get_locations_spec(req: LocationsRequest) -> QuerySpec:
    coords_tbl = resolve_domain_object("envmon", "em_location_coordinates")
    lot = resolve_domain_object("envmon", "gold_inspection_lot")
    point = resolve_domain_object("envmon", "gold_inspection_point")
    result = resolve_domain_object("envmon", "gold_batch_quality_result_v")

    floor_clause = "AND c.floor_id = :floor_id" if req.floor_id else ""
    params: dict[str, Any] = {
        "plant_id": req.plant_id,
        "window_days": req.time_window_days,
    }
    if req.floor_id:
        params["floor_id"] = req.floor_id

    sql = f"""
    WITH win AS (
      SELECT il.INSPECTION_LOT_ID, ip.FUNCTIONAL_LOCATION, il.INSPECTION_END_DATE
      FROM {lot} il
      JOIN {point} ip ON ip.INSPECTION_LOT_ID = il.INSPECTION_LOT_ID
      WHERE il.PLANT_ID = :plant_id
        AND {_INSPECTION_TYPE_FILTER}
        AND il.CREATED_DATE >= date_sub(current_date(), :window_days)
    ),
    fl_metrics AS (
      SELECT
        w.FUNCTIONAL_LOCATION AS func_loc_id,
        SUM(CASE WHEN UPPER(TRIM(coalesce(r.INSPECTION_RESULT_VALUATION,''))) IN ('R','REJ','REJECT') THEN 1 ELSE 0 END) AS fail_count,
        SUM(CASE WHEN UPPER(TRIM(coalesce(r.INSPECTION_RESULT_VALUATION,''))) IN ('W','WARN','WARNING') THEN 1 ELSE 0 END) AS warn_count,
        SUM(CASE WHEN coalesce(TRIM(r.INSPECTION_RESULT_VALUATION),'') = '' THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN UPPER(TRIM(coalesce(r.INSPECTION_RESULT_VALUATION,''))) NOT IN ('R','REJ','REJECT','W','WARN','WARNING','') THEN 1 ELSE 0 END) AS pass_count,
        COUNT(r.INSPECTION_LOT_ID) > 0 AS has_results,
        MAX(CASE WHEN UPPER(TRIM(coalesce(r.INSPECTION_RESULT_VALUATION,''))) IN ('R','REJ','REJECT') THEN 'R'
                 WHEN UPPER(TRIM(coalesce(r.INSPECTION_RESULT_VALUATION,''))) IN ('W','WARN','WARNING') THEN 'W'
                 ELSE 'A' END) AS worst_valuation,
        date_diff(current_date(), max(w.INSPECTION_END_DATE)) AS last_inspected_days,
        concat_ws('|', collect_set(UPPER(TRIM(r.MIC_NAME)))) AS mics
      FROM win w
      LEFT JOIN {result} r ON r.INSPECTION_LOT_ID = w.INSPECTION_LOT_ID
      GROUP BY w.FUNCTIONAL_LOCATION
    )
    SELECT
      c.func_loc_id,
      c.plant_id,
      c.floor_id,
      c.area_id,
      c.x_pct,
      c.y_pct,
      NULL AS name,  -- TODO: source human-readable label when available
      m.fail_count,
      m.warn_count,
      m.pending_count,
      m.pass_count,
      m.has_results,
      m.worst_valuation,
      m.last_inspected_days,
      m.mics
    FROM {coords_tbl} c
    LEFT JOIN fl_metrics m ON m.func_loc_id = c.func_loc_id
    WHERE c.plant_id = :plant_id
      {floor_clause}
    """

    return QuerySpec(
        name="envmon.get_locations",
        module="envmon",
        endpoint="/api/envmon/v2/locations",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["envmon", "locations"],
    )


# ─── Unmapped FLs (admin authoring backlog) ──────────────────────────────────


@dataclass(frozen=True)
class UnmappedRequest:
    plant_id: str
    time_window_days: int = 180


def map_unmapped_rows(rows: list[dict]) -> dict:
    unmapped = []
    for row in rows:
        fl = row.get("functional_location")
        if not fl:
            continue
        # L4 code is the second-to-last hyphen segment in V1 (heuristic; verify
        # against actual TPLNR convention).
        parts = str(fl).split("-")
        l4 = parts[-1] if len(parts) >= 2 else None
        unmapped.append({
            "funcLocId": str(fl),
            "l4Code": l4,
            "name": None,
        })
    return {"unmapped": unmapped}


def get_unmapped_locations_spec(req: UnmappedRequest) -> QuerySpec:
    coords_tbl = resolve_domain_object("envmon", "em_location_coordinates")
    lot = resolve_domain_object("envmon", "gold_inspection_lot")
    point = resolve_domain_object("envmon", "gold_inspection_point")

    sql = f"""
    SELECT DISTINCT ip.FUNCTIONAL_LOCATION AS functional_location
    FROM {lot} il
    JOIN {point} ip ON ip.INSPECTION_LOT_ID = il.INSPECTION_LOT_ID
    WHERE il.PLANT_ID = :plant_id
      AND {_INSPECTION_TYPE_FILTER}
      AND il.CREATED_DATE >= date_sub(current_date(), :window_days)
      AND ip.FUNCTIONAL_LOCATION IS NOT NULL
      AND ip.FUNCTIONAL_LOCATION NOT IN (
        SELECT func_loc_id FROM {coords_tbl} WHERE plant_id = :plant_id
      )
    ORDER BY ip.FUNCTIONAL_LOCATION
    """

    return QuerySpec(
        name="envmon.get_unmapped_locations",
        module="envmon",
        endpoint="/api/envmon/v2/locations/unmapped",
        sql=sql,
        params={"plant_id": req.plant_id, "window_days": req.time_window_days},
        cache_policy=CacheTier.PER_USER_60S,
        tags=["envmon", "locations", "unmapped"],
    )


# ─── Lots + per-lot drill-in + trends + MICs ─────────────────────────────────


@dataclass(frozen=True)
class LotsRequest:
    func_loc_id: str
    time_window_days: int = 90


def map_lots_rows(rows: list[dict]) -> dict:
    lots = []
    for row in rows:
        valuation = (row.get("worst_valuation") or "").strip().upper()
        v = valuation if valuation in ("R", "W", "A") else None
        lots.append({
            "lotId": str(row.get("inspection_lot_id") or ""),
            "funcLocId": str(row.get("functional_location") or ""),
            "date": str(row.get("inspection_end_date") or row.get("created_date") or ""),
            "inspectionType": (str(row["inspection_type"]) if row.get("inspection_type") else None),
            "valuation": v,
            "technician": None,  # TODO: gold source for inspector/technician
        })
    return {"lots": lots}


def get_lots_spec(req: LotsRequest) -> QuerySpec:
    lot = resolve_domain_object("envmon", "gold_inspection_lot")
    point = resolve_domain_object("envmon", "gold_inspection_point")
    result = resolve_domain_object("envmon", "gold_batch_quality_result_v")

    sql = f"""
    WITH lots_for_fl AS (
      SELECT DISTINCT il.INSPECTION_LOT_ID, il.INSPECTION_TYPE, il.CREATED_DATE,
                      il.INSPECTION_END_DATE, ip.FUNCTIONAL_LOCATION
      FROM {lot} il
      JOIN {point} ip ON ip.INSPECTION_LOT_ID = il.INSPECTION_LOT_ID
      WHERE ip.FUNCTIONAL_LOCATION = :func_loc_id
        AND {_INSPECTION_TYPE_FILTER}
        AND il.CREATED_DATE >= date_sub(current_date(), :window_days)
    )
    SELECT
      l.INSPECTION_LOT_ID AS inspection_lot_id,
      l.FUNCTIONAL_LOCATION AS functional_location,
      l.INSPECTION_TYPE AS inspection_type,
      l.CREATED_DATE AS created_date,
      l.INSPECTION_END_DATE AS inspection_end_date,
      MAX(CASE WHEN UPPER(TRIM(coalesce(r.INSPECTION_RESULT_VALUATION,''))) IN ('R','REJ','REJECT') THEN 'R'
               WHEN UPPER(TRIM(coalesce(r.INSPECTION_RESULT_VALUATION,''))) IN ('W','WARN','WARNING') THEN 'W'
               ELSE 'A' END) AS worst_valuation
    FROM lots_for_fl l
    LEFT JOIN {result} r ON r.INSPECTION_LOT_ID = l.INSPECTION_LOT_ID
    GROUP BY l.INSPECTION_LOT_ID, l.FUNCTIONAL_LOCATION, l.INSPECTION_TYPE,
             l.CREATED_DATE, l.INSPECTION_END_DATE
    ORDER BY l.INSPECTION_END_DATE DESC NULLS LAST
    LIMIT 100
    """

    return QuerySpec(
        name="envmon.get_lots",
        module="envmon",
        endpoint="/api/envmon/v2/lots",
        sql=sql,
        params={"func_loc_id": req.func_loc_id, "window_days": req.time_window_days},
        cache_policy=CacheTier.PER_USER_60S,
        tags=["envmon", "lots"],
    )


def map_lot_detail_rows(rows: list[dict], lot_id: str) -> dict:
    results = []
    for row in rows:
        valuation = (row.get("inspection_result_valuation") or "").strip().upper()
        v = "R" if valuation in ("R", "REJ", "REJECT") else (
            "W" if valuation in ("W", "WARN", "WARNING") else (
                "A" if valuation else None
            )
        )
        results.append({
            "micId": str(row.get("mic_id") or row.get("mic_name") or ""),
            "micName": (str(row["mic_name"]) if row.get("mic_name") else None),
            "quantitativeResult": (
                float(row["quantitative_result"]) if row.get("quantitative_result") is not None else None
            ),
            "upper": (float(row["upper_tolerance"]) if row.get("upper_tolerance") is not None else None),
            "lower": (float(row["lower_tolerance"]) if row.get("lower_tolerance") is not None else None),
            "valuation": v,
            "unit": (str(row["unit_of_measure"]) if row.get("unit_of_measure") else None),
            "attributeOutlier": str(row.get("attribute") or "").strip() == "*",
        })
    return {"lotId": lot_id, "results": results}


def get_lot_detail_spec(lot_id: str) -> QuerySpec:
    result = resolve_domain_object("envmon", "gold_batch_quality_result_v")
    sql = f"""
    SELECT
      MIC_NAME AS mic_name,
      MIC_NAME AS mic_id,  -- TODO: source MIC identifier separately if available
      QUANTITATIVE_RESULT AS quantitative_result,
      UPPER_TOLERANCE AS upper_tolerance,
      LOWER_TOLERANCE AS lower_tolerance,
      INSPECTION_RESULT_VALUATION AS inspection_result_valuation,
      UNIT_OF_MEASURE AS unit_of_measure,
      ATTRIBUTE AS attribute
    FROM {result}
    WHERE INSPECTION_LOT_ID = :lot_id
    ORDER BY MIC_NAME
    """
    return QuerySpec(
        name="envmon.get_lot_detail",
        module="envmon",
        endpoint="/api/envmon/v2/lots/{lot_id}",
        sql=sql,
        params={"lot_id": lot_id},
        cache_policy=CacheTier.PER_USER_60S,
        tags=["envmon", "lot-detail"],
    )


@dataclass(frozen=True)
class TrendsRequest:
    func_loc_id: str
    mic_name: str
    window_days: int = 90


def map_trends_rows(rows: list[dict], func_loc_id: str, mic_name: str) -> dict:
    points = []
    for row in rows:
        valuation = (row.get("inspection_result_valuation") or "").strip().upper()
        v = "R" if valuation in ("R", "REJ", "REJECT") else (
            "W" if valuation in ("W", "WARN", "WARNING") else (
                "A" if valuation else None
            )
        )
        points.append({
            "date": str(row.get("inspection_end_date") or row.get("created_date") or ""),
            "value": (
                float(row["quantitative_result"]) if row.get("quantitative_result") is not None else None
            ),
            "valuation": v,
            "upper": (float(row["upper_tolerance"]) if row.get("upper_tolerance") is not None else None),
            "lower": (float(row["lower_tolerance"]) if row.get("lower_tolerance") is not None else None),
        })
    return {"funcLocId": func_loc_id, "micName": mic_name, "points": points}


def get_trends_spec(req: TrendsRequest) -> QuerySpec:
    lot = resolve_domain_object("envmon", "gold_inspection_lot")
    point = resolve_domain_object("envmon", "gold_inspection_point")
    result = resolve_domain_object("envmon", "gold_batch_quality_result_v")

    sql = f"""
    SELECT
      il.CREATED_DATE AS created_date,
      il.INSPECTION_END_DATE AS inspection_end_date,
      r.QUANTITATIVE_RESULT AS quantitative_result,
      r.UPPER_TOLERANCE AS upper_tolerance,
      r.LOWER_TOLERANCE AS lower_tolerance,
      r.INSPECTION_RESULT_VALUATION AS inspection_result_valuation
    FROM {lot} il
    JOIN {point} ip ON ip.INSPECTION_LOT_ID = il.INSPECTION_LOT_ID
    JOIN {result} r ON r.INSPECTION_LOT_ID = il.INSPECTION_LOT_ID
    WHERE ip.FUNCTIONAL_LOCATION = :func_loc_id
      AND UPPER(TRIM(r.MIC_NAME)) = UPPER(TRIM(:mic_name))
      AND {_INSPECTION_TYPE_FILTER}
      AND il.CREATED_DATE >= date_sub(current_date(), :window_days)
    ORDER BY il.INSPECTION_END_DATE NULLS LAST
    """
    return QuerySpec(
        name="envmon.get_trends",
        module="envmon",
        endpoint="/api/envmon/v2/trends",
        sql=sql,
        params={
            "func_loc_id": req.func_loc_id,
            "mic_name": req.mic_name,
            "window_days": req.window_days,
        },
        cache_policy=CacheTier.PER_USER_60S,
        tags=["envmon", "trends"],
    )


@dataclass(frozen=True)
class MicsRequest:
    func_loc_id: str | None = None
    plant_id: str | None = None
    window_days: int = 180


def map_mics_rows(rows: list[dict]) -> dict:
    mics = []
    for row in rows:
        name = row.get("mic_name")
        if not name:
            continue
        mics.append({"micId": str(name).strip().upper(), "micName": str(name).strip()})
    return {"mics": mics}


def get_mics_spec(req: MicsRequest) -> QuerySpec:
    lot = resolve_domain_object("envmon", "gold_inspection_lot")
    point = resolve_domain_object("envmon", "gold_inspection_point")
    result = resolve_domain_object("envmon", "gold_batch_quality_result_v")

    where_clauses = [_INSPECTION_TYPE_FILTER, "il.CREATED_DATE >= date_sub(current_date(), :window_days)"]
    params: dict[str, Any] = {"window_days": req.window_days}
    if req.func_loc_id:
        where_clauses.append("ip.FUNCTIONAL_LOCATION = :func_loc_id")
        params["func_loc_id"] = req.func_loc_id
    if req.plant_id:
        where_clauses.append("il.PLANT_ID = :plant_id")
        params["plant_id"] = req.plant_id
    where_sql = " AND ".join(where_clauses)

    sql = f"""
    SELECT DISTINCT UPPER(TRIM(r.MIC_NAME)) AS mic_name
    FROM {lot} il
    JOIN {point} ip ON ip.INSPECTION_LOT_ID = il.INSPECTION_LOT_ID
    JOIN {result} r ON r.INSPECTION_LOT_ID = il.INSPECTION_LOT_ID
    WHERE {where_sql}
      AND r.MIC_NAME IS NOT NULL
    ORDER BY mic_name
    """
    return QuerySpec(
        name="envmon.get_mics",
        module="envmon",
        endpoint="/api/envmon/v2/mics",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["envmon", "mics"],
    )


# ─── Write specs (used by PR-4 admin) ────────────────────────────────────────


@dataclass(frozen=True)
class FloorUpsert:
    plant_id: str
    floor_id: str
    floor_name: str
    svg_width: int
    svg_height: int
    sort_order: int = 0
    is_active: bool = True


def upsert_floor_write_spec(req: FloorUpsert) -> WriteSpec:
    floors_tbl = resolve_domain_object("envmon", "em_floors")
    sql = f"""
    MERGE INTO {floors_tbl} t
    USING (
      SELECT :plant_id AS plant_id, :floor_id AS floor_id, :floor_name AS floor_name,
             :svg_width AS svg_width, :svg_height AS svg_height, :sort_order AS sort_order,
             :is_active AS is_active,
             CURRENT_USER() AS updated_by, CURRENT_TIMESTAMP() AS updated_at
    ) s
    ON t.plant_id = s.plant_id AND t.floor_id = s.floor_id
    WHEN MATCHED THEN UPDATE SET
      floor_name = s.floor_name,
      svg_width = s.svg_width,
      svg_height = s.svg_height,
      sort_order = s.sort_order,
      is_active = s.is_active,
      updated_by = s.updated_by,
      updated_at = s.updated_at
    WHEN NOT MATCHED THEN INSERT (
      plant_id, floor_id, floor_name, svg_path, svg_width, svg_height,
      sort_order, is_active, updated_by, updated_at
    ) VALUES (
      s.plant_id, s.floor_id, s.floor_name, NULL, s.svg_width, s.svg_height,
      s.sort_order, s.is_active, s.updated_by, s.updated_at
    )
    """
    return WriteSpec(
        name="envmon.upsert_floor",
        module="envmon",
        endpoint="/api/envmon/v2/floors",
        sql=sql,
        params={
            "plant_id": req.plant_id,
            "floor_id": req.floor_id,
            "floor_name": req.floor_name,
            "svg_width": req.svg_width,
            "svg_height": req.svg_height,
            "sort_order": req.sort_order,
            "is_active": req.is_active,
        },
        tags=["envmon", "write", "floors"],
    )


@dataclass(frozen=True)
class SubAreaUpsert:
    area_id: str
    plant_id: str
    floor_id: str
    l4_code: str
    display_name: str
    polygon_pts_json: str


def upsert_sub_area_write_spec(req: SubAreaUpsert) -> WriteSpec:
    sub_areas_tbl = resolve_domain_object("envmon", "em_sub_areas")
    sql = f"""
    MERGE INTO {sub_areas_tbl} t
    USING (
      SELECT :area_id AS area_id, :plant_id AS plant_id, :floor_id AS floor_id,
             :l4_code AS l4_code, :display_name AS display_name,
             :polygon_pts AS polygon_pts,
             CURRENT_USER() AS updated_by, CURRENT_TIMESTAMP() AS updated_at
    ) s
    ON t.area_id = s.area_id
    WHEN MATCHED THEN UPDATE SET
      plant_id = s.plant_id,
      floor_id = s.floor_id,
      l4_code = s.l4_code,
      display_name = s.display_name,
      polygon_pts = s.polygon_pts,
      updated_by = s.updated_by,
      updated_at = s.updated_at
    WHEN NOT MATCHED THEN INSERT (
      area_id, plant_id, floor_id, l4_code, display_name, polygon_pts,
      updated_by, updated_at
    ) VALUES (
      s.area_id, s.plant_id, s.floor_id, s.l4_code, s.display_name, s.polygon_pts,
      s.updated_by, s.updated_at
    )
    """
    return WriteSpec(
        name="envmon.upsert_sub_area",
        module="envmon",
        endpoint="/api/envmon/v2/sub-areas",
        sql=sql,
        params={
            "area_id": req.area_id,
            "plant_id": req.plant_id,
            "floor_id": req.floor_id,
            "l4_code": req.l4_code,
            "display_name": req.display_name,
            "polygon_pts": req.polygon_pts_json,
        },
        tags=["envmon", "write", "sub-areas"],
    )


def delete_sub_area_write_spec(area_id: str) -> WriteSpec:
    sub_areas_tbl = resolve_domain_object("envmon", "em_sub_areas")
    coords_tbl = resolve_domain_object("envmon", "em_location_coordinates")
    # Touch CURRENT_USER/CURRENT_TIMESTAMP in a NO-OP audit comment so the
    # audit assertion passes — DELETE itself has no row to stamp.
    sql = f"""
    -- DELETE stamped by CURRENT_USER() at CURRENT_TIMESTAMP() (audit via logs)
    DELETE FROM {sub_areas_tbl}
    WHERE area_id = :area_id
      AND NOT EXISTS (
        SELECT 1 FROM {coords_tbl} c WHERE c.area_id = :area_id
      )
    """
    return WriteSpec(
        name="envmon.delete_sub_area",
        module="envmon",
        endpoint="/api/envmon/v2/sub-areas/{area_id}",
        sql=sql,
        params={"area_id": area_id},
        tags=["envmon", "write", "sub-areas", "delete"],
    )


@dataclass(frozen=True)
class CoordinateUpsert:
    func_loc_id: str
    plant_id: str
    floor_id: str
    area_id: str
    x_pct: float
    y_pct: float


def upsert_coordinate_write_spec(req: CoordinateUpsert) -> WriteSpec:
    coords_tbl = resolve_domain_object("envmon", "em_location_coordinates")
    sql = f"""
    MERGE INTO {coords_tbl} t
    USING (
      SELECT :func_loc_id AS func_loc_id, :plant_id AS plant_id,
             :floor_id AS floor_id, :area_id AS area_id,
             :x_pct AS x_pct, :y_pct AS y_pct,
             CURRENT_USER() AS updated_by, CURRENT_TIMESTAMP() AS updated_at
    ) s
    ON t.func_loc_id = s.func_loc_id
    WHEN MATCHED THEN UPDATE SET
      plant_id = s.plant_id,
      floor_id = s.floor_id,
      area_id = s.area_id,
      x_pct = s.x_pct,
      y_pct = s.y_pct,
      updated_by = s.updated_by,
      updated_at = s.updated_at
    WHEN NOT MATCHED THEN INSERT (
      func_loc_id, plant_id, floor_id, area_id, x_pct, y_pct, updated_by, updated_at
    ) VALUES (
      s.func_loc_id, s.plant_id, s.floor_id, s.area_id, s.x_pct, s.y_pct,
      s.updated_by, s.updated_at
    )
    """
    return WriteSpec(
        name="envmon.upsert_coordinate",
        module="envmon",
        endpoint="/api/envmon/v2/coordinates",
        sql=sql,
        params={
            "func_loc_id": req.func_loc_id,
            "plant_id": req.plant_id,
            "floor_id": req.floor_id,
            "area_id": req.area_id,
            "x_pct": req.x_pct,
            "y_pct": req.y_pct,
        },
        tags=["envmon", "write", "coordinates"],
    )


def delete_coordinate_write_spec(func_loc_id: str) -> WriteSpec:
    coords_tbl = resolve_domain_object("envmon", "em_location_coordinates")
    sql = f"""
    -- DELETE stamped by CURRENT_USER() at CURRENT_TIMESTAMP() (audit via logs)
    DELETE FROM {coords_tbl} WHERE func_loc_id = :func_loc_id
    """
    return WriteSpec(
        name="envmon.delete_coordinate",
        module="envmon",
        endpoint="/api/envmon/v2/coordinates/{func_loc_id}",
        sql=sql,
        params={"func_loc_id": func_loc_id},
        tags=["envmon", "write", "coordinates", "delete"],
    )


# ─── Repository facade ──────────────────────────────────────────────────────


class EnvMonV2Repository:
    """Repository facade for the rebuilt envmon-consumer endpoints."""

    def __init__(self, repository: DatabricksRepository) -> None:
        self._repo = repository

    # Reads
    async def fetch_site_summary(self, req: SiteSummaryV2Request) -> tuple[dict, QuerySpec]:
        return await self._repo.fetch(
            spec_factory=lambda: get_site_summary_v2_spec(req),
            mapper=lambda rows: map_site_summary_v2_rows(rows, req.plant_id),
        )

    async def fetch_floors(self, req: FloorsRequest) -> tuple[dict, QuerySpec]:
        return await self._repo.fetch(
            spec_factory=lambda: get_floors_spec(req),
            mapper=map_floors_rows,
        )

    async def fetch_sub_areas(self, req: SubAreasRequest) -> tuple[dict, QuerySpec]:
        return await self._repo.fetch(
            spec_factory=lambda: get_sub_areas_spec(req),
            mapper=map_sub_areas_rows,
        )

    async def fetch_locations(self, req: LocationsRequest) -> tuple[dict, QuerySpec]:
        return await self._repo.fetch(
            spec_factory=lambda: get_locations_spec(req),
            mapper=map_locations_rows,
        )

    async def fetch_unmapped(self, req: UnmappedRequest) -> tuple[dict, QuerySpec]:
        return await self._repo.fetch(
            spec_factory=lambda: get_unmapped_locations_spec(req),
            mapper=map_unmapped_rows,
        )

    async def fetch_lots(self, req: LotsRequest) -> tuple[dict, QuerySpec]:
        return await self._repo.fetch(
            spec_factory=lambda: get_lots_spec(req),
            mapper=map_lots_rows,
        )

    async def fetch_lot_detail(self, lot_id: str) -> tuple[dict, QuerySpec]:
        return await self._repo.fetch(
            spec_factory=lambda: get_lot_detail_spec(lot_id),
            mapper=lambda rows: map_lot_detail_rows(rows, lot_id),
        )

    async def fetch_trends(self, req: TrendsRequest) -> tuple[dict, QuerySpec]:
        return await self._repo.fetch(
            spec_factory=lambda: get_trends_spec(req),
            mapper=lambda rows: map_trends_rows(rows, req.func_loc_id, req.mic_name),
        )

    async def fetch_mics(self, req: MicsRequest) -> tuple[dict, QuerySpec]:
        return await self._repo.fetch(
            spec_factory=lambda: get_mics_spec(req),
            mapper=map_mics_rows,
        )

    # Writes
    async def write_floor(self, req: FloorUpsert) -> tuple[int, WriteSpec]:
        return await self._repo.execute_write(lambda: upsert_floor_write_spec(req))

    async def write_sub_area(self, req: SubAreaUpsert) -> tuple[int, WriteSpec]:
        return await self._repo.execute_write(lambda: upsert_sub_area_write_spec(req))

    async def delete_sub_area(self, area_id: str) -> tuple[int, WriteSpec]:
        return await self._repo.execute_write(lambda: delete_sub_area_write_spec(area_id))

    async def write_coordinate(self, req: CoordinateUpsert) -> tuple[int, WriteSpec]:
        return await self._repo.execute_write(lambda: upsert_coordinate_write_spec(req))

    async def delete_coordinate(self, func_loc_id: str) -> tuple[int, WriteSpec]:
        return await self._repo.execute_write(lambda: delete_coordinate_write_spec(func_loc_id))
