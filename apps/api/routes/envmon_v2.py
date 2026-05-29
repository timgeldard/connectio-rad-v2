"""EnvMon V2 routes — production envmon-consumer endpoints.

Databricks-api only — Unity Catalog enforces per-user plant visibility via
OAuth-as-user. Missing token → 401. Missing config → 503. No mock fallback.

Routes:
  GET    /api/envmon/v2/site-summary?plant_id&time_window_days=
  GET    /api/envmon/v2/floors?plant_id=
  GET    /api/envmon/v2/floors/{plant_id}/{floor_id}/svg     (raw SVG bytes)
  POST   /api/envmon/v2/floors                                (upsert)
  POST   /api/envmon/v2/floors/{plant_id}/{floor_id}/svg     (multipart upload)
  GET    /api/envmon/v2/sub-areas?plant_id&floor_id?=
  POST   /api/envmon/v2/sub-areas                             (upsert)
  DELETE /api/envmon/v2/sub-areas/{area_id}
  GET    /api/envmon/v2/locations?plant_id&floor_id?=&time_window_days=
  GET    /api/envmon/v2/locations/unmapped?plant_id=
  POST   /api/envmon/v2/coordinates                            (upsert with PIP)
  DELETE /api/envmon/v2/coordinates/{func_loc_id}
  GET    /api/envmon/v2/lots?func_loc_id&time_window_days=
  GET    /api/envmon/v2/lots/{lot_id}
  GET    /api/envmon/v2/trends?func_loc_id&mic_name&window_days=
  GET    /api/envmon/v2/mics?func_loc_id?=&plant_id?=
"""
from __future__ import annotations

import json
import os

from fastapi import APIRouter, Body, Header, HTTPException, Request, Response

from shared.query_service.volume_storage import (
    get_volume_file,
    put_volume_file,
    sanitise_svg,
)

from adapters.envmon.envmon_v2_adapter import (
    CoordinateUpsert,
    EnvMonV2Repository,
    FloorsRequest,
    FloorUpsert,
    LocationsRequest,
    LotsRequest,
    MicsRequest,
    SiteSummaryV2Request,
    SubAreaUpsert,
    SubAreasRequest,
    TrendsRequest,
    UnmappedRequest,
)
from routes._databricks import (
    build_databricks_repository,
    build_user_identity,
    require_databricks_config,
    run_repository_fetch,
    run_repository_write,
    set_databricks_response_headers,
)


router = APIRouter()


def _require_databricks_mode() -> None:
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="EnvMon v2 endpoints require BACKEND_ADAPTER_MODE=databricks-api",
        )


def _repo(token: str | None, user: str | None, email: str | None) -> EnvMonV2Repository:
    _require_databricks_mode()
    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(token, user, email)
    repository = build_databricks_repository(identity, host, warehouse_id)
    return EnvMonV2Repository(repository)


# ─── Reads ──────────────────────────────────────────────────────────────────


@router.get("/envmon/v2/site-summary")
async def site_summary(
    response: Response,
    plant_id: str,
    time_window_days: int = 30,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> dict:
    repo = _repo(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    result, spec = await run_repository_fetch(
        lambda: repo.fetch_site_summary(
            SiteSummaryV2Request(plant_id=plant_id, time_window_days=time_window_days)
        )
    )
    set_databricks_response_headers(response, spec)
    return result


@router.get("/envmon/v2/floors")
async def floors(
    response: Response,
    plant_id: str,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> dict:
    repo = _repo(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    result, spec = await run_repository_fetch(
        lambda: repo.fetch_floors(FloorsRequest(plant_id=plant_id))
    )
    set_databricks_response_headers(response, spec)
    return result


@router.get("/envmon/v2/sub-areas")
async def sub_areas(
    response: Response,
    plant_id: str,
    floor_id: str | None = None,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> dict:
    repo = _repo(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    result, spec = await run_repository_fetch(
        lambda: repo.fetch_sub_areas(SubAreasRequest(plant_id=plant_id, floor_id=floor_id))
    )
    set_databricks_response_headers(response, spec)
    return result


@router.get("/envmon/v2/locations")
async def locations(
    response: Response,
    plant_id: str,
    floor_id: str | None = None,
    time_window_days: int = 90,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> dict:
    repo = _repo(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    result, spec = await run_repository_fetch(
        lambda: repo.fetch_locations(
            LocationsRequest(plant_id=plant_id, floor_id=floor_id, time_window_days=time_window_days)
        )
    )
    set_databricks_response_headers(response, spec)
    return result


@router.get("/envmon/v2/locations/unmapped")
async def locations_unmapped(
    response: Response,
    plant_id: str,
    time_window_days: int = 180,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> dict:
    repo = _repo(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    result, spec = await run_repository_fetch(
        lambda: repo.fetch_unmapped(
            UnmappedRequest(plant_id=plant_id, time_window_days=time_window_days)
        )
    )
    set_databricks_response_headers(response, spec)
    return result


@router.get("/envmon/v2/lots")
async def lots(
    response: Response,
    func_loc_id: str,
    time_window_days: int = 90,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> dict:
    repo = _repo(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    result, spec = await run_repository_fetch(
        lambda: repo.fetch_lots(LotsRequest(func_loc_id=func_loc_id, time_window_days=time_window_days))
    )
    set_databricks_response_headers(response, spec)
    return result


@router.get("/envmon/v2/lots/{lot_id}")
async def lot_detail(
    lot_id: str,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> dict:
    repo = _repo(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    result, spec = await run_repository_fetch(lambda: repo.fetch_lot_detail(lot_id))
    set_databricks_response_headers(response, spec)
    return result


@router.get("/envmon/v2/trends")
async def trends(
    response: Response,
    func_loc_id: str,
    mic_name: str,
    window_days: int = 90,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> dict:
    repo = _repo(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    result, spec = await run_repository_fetch(
        lambda: repo.fetch_trends(
            TrendsRequest(func_loc_id=func_loc_id, mic_name=mic_name, window_days=window_days)
        )
    )
    set_databricks_response_headers(response, spec)
    return result


@router.get("/envmon/v2/mics")
async def mics(
    response: Response,
    func_loc_id: str | None = None,
    plant_id: str | None = None,
    window_days: int = 180,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> dict:
    repo = _repo(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    result, spec = await run_repository_fetch(
        lambda: repo.fetch_mics(
            MicsRequest(func_loc_id=func_loc_id, plant_id=plant_id, window_days=window_days)
        )
    )
    set_databricks_response_headers(response, spec)
    return result


# ─── Writes (PR-4 admin) ────────────────────────────────────────────────────


@router.post("/envmon/v2/floors")
async def upsert_floor(
    response: Response,
    payload: dict = Body(...),
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> dict:
    repo = _repo(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    req = FloorUpsert(
        plant_id=str(payload.get("plantId") or ""),
        floor_id=str(payload.get("floorId") or ""),
        floor_name=str(payload.get("floorName") or ""),
        svg_width=int(payload.get("svgWidth") or 0),
        svg_height=int(payload.get("svgHeight") or 0),
        sort_order=int(payload.get("sortOrder") or 0),
        is_active=bool(payload.get("isActive", True)),
    )
    if not req.plant_id or not req.floor_id or req.svg_width <= 0 or req.svg_height <= 0:
        raise HTTPException(status_code=422, detail="plantId, floorId, svgWidth, svgHeight are required")
    affected, spec = await run_repository_write(lambda: repo.write_floor(req))
    set_databricks_response_headers(response, spec)
    return {"ok": True, "affectedRows": affected}


@router.post("/envmon/v2/sub-areas")
async def upsert_sub_area(
    response: Response,
    payload: dict = Body(...),
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> dict:
    pts = payload.get("polygonPts") or []
    if not isinstance(pts, list) or len(pts) < 3:
        raise HTTPException(status_code=422, detail="polygonPts must have at least 3 points")
    normalised = []
    for p in pts:
        if not isinstance(p, (list, tuple)) or len(p) < 2:
            raise HTTPException(status_code=422, detail="polygonPts entries must be [x,y]")
        x, y = float(p[0]), float(p[1])
        if not (0.0 <= x <= 100.0) or not (0.0 <= y <= 100.0):
            raise HTTPException(status_code=422, detail="polygonPts must be percentages in 0..100")
        normalised.append([x, y])
    repo = _repo(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    req = SubAreaUpsert(
        area_id=str(payload.get("areaId") or ""),
        plant_id=str(payload.get("plantId") or ""),
        floor_id=str(payload.get("floorId") or ""),
        l4_code=str(payload.get("l4Code") or ""),
        display_name=str(payload.get("displayName") or ""),
        polygon_pts_json=json.dumps(normalised, separators=(",", ":")),
    )
    if not req.area_id or not req.plant_id or not req.floor_id or not req.l4_code or not req.display_name:
        raise HTTPException(status_code=422, detail="areaId, plantId, floorId, l4Code, displayName are required")
    affected, spec = await run_repository_write(lambda: repo.write_sub_area(req))
    set_databricks_response_headers(response, spec)
    return {"ok": True, "affectedRows": affected}


@router.delete("/envmon/v2/sub-areas/{area_id}")
async def delete_sub_area(
    area_id: str,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> dict:
    repo = _repo(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    affected, spec = await run_repository_write(lambda: repo.delete_sub_area(area_id))
    set_databricks_response_headers(response, spec)
    return {"ok": True, "affectedRows": affected}


def _point_in_polygon(x: float, y: float, polygon: list[list[float]]) -> bool:
    """Ray-casting point-in-polygon for the server-side pin constraint."""
    inside = False
    n = len(polygon)
    if n < 3:
        return False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i][0], polygon[i][1]
        xj, yj = polygon[j][0], polygon[j][1]
        intersect = ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi)
        if intersect:
            inside = not inside
        j = i
    return inside


@router.post("/envmon/v2/coordinates")
async def upsert_coordinate(
    response: Response,
    payload: dict = Body(...),
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> dict:
    repo = _repo(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    func_loc_id = str(payload.get("funcLocId") or "")
    plant_id = str(payload.get("plantId") or "")
    floor_id = str(payload.get("floorId") or "")
    area_id = str(payload.get("areaId") or "")
    x_pct = float(payload.get("xPct") or 0.0)
    y_pct = float(payload.get("yPct") or 0.0)
    if not all([func_loc_id, plant_id, floor_id, area_id]):
        raise HTTPException(
            status_code=422,
            detail="funcLocId, plantId, floorId, areaId are required",
        )
    if not (0.0 <= x_pct <= 100.0) or not (0.0 <= y_pct <= 100.0):
        raise HTTPException(status_code=422, detail="xPct and yPct must be in 0..100")

    # Server-side point-in-polygon check against em_sub_areas.
    sub_areas_result, _ = await run_repository_fetch(
        lambda: repo.fetch_sub_areas(SubAreasRequest(plant_id=plant_id, floor_id=floor_id))
    )
    target = next(
        (a for a in sub_areas_result.get("subAreas", []) if a["areaId"] == area_id),
        None,
    )
    if target is None:
        raise HTTPException(
            status_code=422,
            detail=f"areaId {area_id!r} not found for plant {plant_id!r} / floor {floor_id!r}",
        )
    polygon = [[float(p[0]), float(p[1])] for p in target.get("polygonPts", [])]
    if not _point_in_polygon(x_pct, y_pct, polygon):
        raise HTTPException(
            status_code=422,
            detail="Pin must land inside the parent L4 polygon",
        )

    affected, spec = await run_repository_write(
        lambda: repo.write_coordinate(
            CoordinateUpsert(
                func_loc_id=func_loc_id,
                plant_id=plant_id,
                floor_id=floor_id,
                area_id=area_id,
                x_pct=x_pct,
                y_pct=y_pct,
            )
        )
    )
    set_databricks_response_headers(response, spec)
    return {"ok": True, "affectedRows": affected}


@router.delete("/envmon/v2/coordinates/{func_loc_id}")
async def delete_coordinate(
    func_loc_id: str,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> dict:
    repo = _repo(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    affected, spec = await run_repository_write(lambda: repo.delete_coordinate(func_loc_id))
    set_databricks_response_headers(response, spec)
    return {"ok": True, "affectedRows": affected}


# ─── SVG storage (UC Volume) ────────────────────────────────────────────────


_MAX_SVG_BYTES = 2 * 1024 * 1024  # 2 MB


def _svg_volume_path(plant_id: str, floor_id: str) -> str:
    catalog = os.getenv("TRACE_CATALOG", "")
    schema = os.getenv("TRACE_SCHEMA", "gold")
    if not catalog:
        raise HTTPException(status_code=503, detail="TRACE_CATALOG not configured")
    return f"/Volumes/{catalog}/{schema}/envmon_floor_svgs/{plant_id}/{floor_id}.svg"


@router.get("/envmon/v2/floors/{plant_id}/{floor_id}/svg")
async def get_floor_svg(
    plant_id: str,
    floor_id: str,
    x_forwarded_access_token: str | None = Header(default=None),
) -> Response:
    """Stream the uploaded SVG underlay for a floor from the UC Volume.

    Returns 404 if no SVG has been uploaded for this (plant, floor). The
    browser never sees the raw Volume path — the API mediates so Unity
    Catalog enforces access via the user's OAuth identity.
    """
    _require_databricks_mode()
    host, _ = require_databricks_config()
    volume_path = _svg_volume_path(plant_id, floor_id)
    try:
        body = await get_volume_file(
            databricks_host=host,
            volume_path=volume_path,
            oauth_token=x_forwarded_access_token,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="No SVG uploaded for this floor") from exc
    return Response(content=body, media_type="image/svg+xml")


@router.post("/envmon/v2/floors/{plant_id}/{floor_id}/svg")
async def upload_floor_svg(
    plant_id: str,
    floor_id: str,
    request: Request,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> dict:
    """Accept an SVG upload and persist to the envmon_floor_svgs UC Volume.

    Accepts either multipart/form-data (a ``svg`` part) or a raw
    ``image/svg+xml`` body. Sanitises (strips ``<script>`` + ``on*`` handlers)
    before writing. Enforces a 2 MB ceiling. On success, updates
    ``em_floors.svg_path`` so the floor row records that an underlay exists.
    """
    _require_databricks_mode()
    host, _ = require_databricks_config()
    content_type = request.headers.get("content-type", "").lower()

    if "multipart/form-data" in content_type:
        form = await request.form()
        upload = form.get("svg")
        if upload is None or not hasattr(upload, "read"):
            raise HTTPException(status_code=422, detail="Missing 'svg' file in multipart payload")
        svg_bytes = await upload.read()  # type: ignore[attr-defined]
    else:
        svg_bytes = await request.body()
    if not svg_bytes:
        raise HTTPException(status_code=422, detail="SVG upload is empty")

    try:
        clean = sanitise_svg(svg_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    volume_path = _svg_volume_path(plant_id, floor_id)
    try:
        bytes_written = await put_volume_file(
            databricks_host=host,
            volume_path=volume_path,
            body=clean,
            oauth_token=x_forwarded_access_token,
        )
    except Exception as exc:  # narrow translation via run_repository_write is overkill for files API
        raise HTTPException(status_code=502, detail=f"Volume upload failed: {exc}") from exc

    # Update em_floors.svg_path so Site/Floor know to render the underlay.
    repo = _repo(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    from adapters.envmon.envmon_v2_adapter import (
        FloorsRequest,
        FloorUpsert,
    )
    floors_result, _ = await run_repository_fetch(
        lambda: repo.fetch_floors(FloorsRequest(plant_id=plant_id))
    )
    existing = next(
        (f for f in floors_result.get("floors", []) if f["floorId"] == floor_id),
        None,
    )
    if existing is not None:
        # Re-upsert with the SVG path stamped. (Schema currently keeps svg_path
        # NULL on INSERT in upsert_floor; this update path stamps it via a
        # follow-up MERGE with the same key.)
        from shared.query_service.write_spec import WriteSpec
        from shared.query_service.object_resolver import resolve_domain_object

        floors_tbl = resolve_domain_object("envmon", "em_floors")
        spec = WriteSpec(
            name="envmon.update_floor_svg_path",
            module="envmon",
            endpoint="/api/envmon/v2/floors/{plant_id}/{floor_id}/svg",
            sql=f"""
            UPDATE {floors_tbl}
            SET svg_path = :svg_path,
                updated_by = CURRENT_USER(),
                updated_at = CURRENT_TIMESTAMP()
            WHERE plant_id = :plant_id AND floor_id = :floor_id
            """,
            params={"svg_path": volume_path, "plant_id": plant_id, "floor_id": floor_id},
            tags=["envmon", "write", "floors", "svg-path"],
        )
        await run_repository_write(lambda: repo._repo.execute_write(lambda: spec))  # type: ignore[attr-defined]
        _ = FloorUpsert  # silence import-not-used

    response.headers["X-Adapter-Mode"] = "databricks-api"
    return {
        "plantId": plant_id,
        "floorId": floor_id,
        "svgPath": volume_path,
        "bytes": bytes_written,
    }
