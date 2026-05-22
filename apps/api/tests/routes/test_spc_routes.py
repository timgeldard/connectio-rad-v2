"""Route tests for GET /api/spc/subgroups — databricks-api mode only.

Legacy-api mode (or default) returns 503. P999 sentinel returns 422.
Missing OAuth → 401. Missing catalog config → 503.
Capability, Nelson stored flags, and signals are hard-wired to their
unavailable values (False / True) — never invented.

Browser UAT: pending. Production readiness: blocked.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx
import pytest
from httpx import ASGITransport

from main import app


def _make_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


_HEADERS_WITH_TOKEN = {
    "x-forwarded-access-token": "user-bearer-token",
    "x-forwarded-user": "user123",
    "x-forwarded-email": "user@example.com",
}

_SUBGROUPS_URL = (
    "/api/spc/subgroups"
    "?material_id=20642328"
    "&plant_id=P523"
    "&mic_id=0010"
    "&operation_id=00000001"
    "&date_from=2024-01-01"
    "&date_to=2026-05-22"
    "&limit=10"
)

_FAKE_SUBGROUP_ROW = {
    "batch_id": "B0001",
    "batch_date": "2025-03-15",
    "subgroup_mean": 7.5,
    "subgroup_range": 0.3,
    "sample_count": 5,
    "lsl_spec": 7.2,
    "usl_spec": 7.8,
    "mic_name": "pH",
}


# ---------------------------------------------------------------------------
# Wrong adapter mode — legacy-api should 503
# ---------------------------------------------------------------------------

class TestSpcSubgroupsWrongMode:
    async def test_returns_503_when_mode_is_legacy_api(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.get(_SUBGROUPS_URL, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503

    async def test_returns_503_when_mode_is_default(self, monkeypatch) -> None:
        """Default mode (no env var set) must return 503 — no silent mode switch."""
        monkeypatch.delenv("BACKEND_ADAPTER_MODE", raising=False)
        async with _make_client() as client:
            response = await client.get(_SUBGROUPS_URL, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503

    async def test_does_not_call_databricks_in_legacy_mode(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        called: list[bool] = []

        async def _mock(*args, **kwargs):
            called.append(True)
            return []

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            _mock,
        ):
            async with _make_client() as client:
                await client.get(_SUBGROUPS_URL, headers=_HEADERS_WITH_TOKEN)

        assert called == []


# ---------------------------------------------------------------------------
# Databricks-api mode — infrastructure failures
# ---------------------------------------------------------------------------

class TestSpcSubgroupsDatabricksMode:
    def _databricks_env(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("TRACE_SCHEMA", "gold")

    async def test_returns_503_when_databricks_host_missing(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.delenv("DATABRICKS_HOST", raising=False)
        monkeypatch.delenv("SQL_WAREHOUSE_ID", raising=False)
        async with _make_client() as client:
            response = await client.get(_SUBGROUPS_URL, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503

    async def test_returns_503_when_catalog_missing(self, monkeypatch) -> None:
        """DatabricksConfigError from missing SPC_CATALOG+TRACE_CATALOG must map to 503."""
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
        monkeypatch.delenv("TRACE_CATALOG", raising=False)
        monkeypatch.delenv("SPC_CATALOG", raising=False)
        async with _make_client() as client:
            response = await client.get(_SUBGROUPS_URL, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503

    async def test_returns_401_when_oauth_token_missing(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
        ):
            async with _make_client() as client:
                response = await client.get(_SUBGROUPS_URL)
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# P999 sentinel
# ---------------------------------------------------------------------------

class TestSpcSubgroupsP999Sentinel:
    async def test_p999_plant_returns_422(self, monkeypatch) -> None:
        """P999 test sentinel must be rejected before any Databricks query."""
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")

        url = (
            "/api/spc/subgroups"
            "?material_id=20642328"
            "&plant_id=P999"
            "&mic_id=0010"
            "&operation_id=00000001"
            "&date_from=2024-01-01"
            "&date_to=2026-05-22"
        )
        async with _make_client() as client:
            response = await client.get(url, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_p999_does_not_query_databricks(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")

        called: list[bool] = []

        async def _mock(*args, **kwargs):
            called.append(True)
            return []

        url = (
            "/api/spc/subgroups"
            "?material_id=20642328&plant_id=P999&mic_id=0010"
            "&operation_id=00000001&date_from=2024-01-01&date_to=2026-05-22"
        )
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            _mock,
        ):
            async with _make_client() as client:
                await client.get(url, headers=_HEADERS_WITH_TOKEN)

        assert called == []


# ---------------------------------------------------------------------------
# Limit clamping
# ---------------------------------------------------------------------------

class TestSpcSubgroupsLimitClamping:
    def _databricks_env(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("TRACE_SCHEMA", "gold")

    async def test_limit_clamped_to_max_subgroups(self, monkeypatch) -> None:
        """Limit exceeding MAX_SUBGROUPS is clamped, not rejected — returns 200."""
        from adapters.spc.spc_databricks_adapter import MAX_SUBGROUPS

        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[],
        ):
            url = (
                f"/api/spc/subgroups"
                f"?material_id=20642328&plant_id=P523&mic_id=0010"
                f"&operation_id=00000001&date_from=2024-01-01&date_to=2026-05-22"
                f"&limit={MAX_SUBGROUPS + 9999}"
            )
            async with _make_client() as client:
                response = await client.get(url, headers=_HEADERS_WITH_TOKEN)

        # Oversized limit is clamped internally — route returns 200, not 422
        assert response.status_code == 200

    async def test_limit_zero_rejected_by_validation(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        url = (
            "/api/spc/subgroups"
            "?material_id=20642328&plant_id=P523&mic_id=0010"
            "&operation_id=00000001&date_from=2024-01-01&date_to=2026-05-22"
            "&limit=0"
        )
        async with _make_client() as client:
            response = await client.get(url, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Required filter validation
# ---------------------------------------------------------------------------

class TestSpcSubgroupsRequiredFilters:
    def _databricks_env(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")

    async def test_missing_material_id_returns_422(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        url = (
            "/api/spc/subgroups"
            "?plant_id=P523&mic_id=0010&operation_id=00000001"
            "&date_from=2024-01-01&date_to=2026-05-22"
        )
        async with _make_client() as client:
            response = await client.get(url, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_missing_plant_id_returns_422(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        url = (
            "/api/spc/subgroups"
            "?material_id=20642328&mic_id=0010&operation_id=00000001"
            "&date_from=2024-01-01&date_to=2026-05-22"
        )
        async with _make_client() as client:
            response = await client.get(url, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_missing_mic_id_returns_422(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        url = (
            "/api/spc/subgroups"
            "?material_id=20642328&plant_id=P523&operation_id=00000001"
            "&date_from=2024-01-01&date_to=2026-05-22"
        )
        async with _make_client() as client:
            response = await client.get(url, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_missing_operation_id_returns_422(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        url = (
            "/api/spc/subgroups"
            "?material_id=20642328&plant_id=P523&mic_id=0010"
            "&date_from=2024-01-01&date_to=2026-05-22"
        )
        async with _make_client() as client:
            response = await client.get(url, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_missing_date_from_returns_422(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        url = (
            "/api/spc/subgroups"
            "?material_id=20642328&plant_id=P523&mic_id=0010"
            "&operation_id=00000001&date_to=2026-05-22"
        )
        async with _make_client() as client:
            response = await client.get(url, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_missing_date_to_returns_422(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        url = (
            "/api/spc/subgroups"
            "?material_id=20642328&plant_id=P523&mic_id=0010"
            "&operation_id=00000001&date_from=2024-01-01"
        )
        async with _make_client() as client:
            response = await client.get(url, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Response shape and contract compliance
# ---------------------------------------------------------------------------

class TestSpcSubgroupsResponseShape:
    def _databricks_env(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("TRACE_SCHEMA", "gold")

    async def test_200_with_row_returns_dict(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_SUBGROUP_ROW],
        ):
            async with _make_client() as client:
                response = await client.get(_SUBGROUPS_URL, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        assert isinstance(response.json(), dict)

    async def test_response_has_required_top_level_keys(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_SUBGROUP_ROW],
        ):
            async with _make_client() as client:
                response = await client.get(_SUBGROUPS_URL, headers=_HEADERS_WITH_TOKEN)
        data = response.json()
        for key in ("materialId", "plantId", "micId", "micName", "operationId",
                    "points", "lockedLimits", "capabilityAvailable",
                    "nelsonStoredFlagsAvailable", "signalsClientSideOnly"):
            assert key in data, f"Missing key: {key}"

    async def test_capability_available_is_false(self, monkeypatch) -> None:
        """capabilityAvailable must always be False — Cp/Cpk unavailable in source."""
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_SUBGROUP_ROW],
        ):
            async with _make_client() as client:
                response = await client.get(_SUBGROUPS_URL, headers=_HEADERS_WITH_TOKEN)
        assert response.json()["capabilityAvailable"] is False

    async def test_nelson_stored_flags_available_is_false(self, monkeypatch) -> None:
        """nelsonStoredFlagsAvailable must always be False — MV absent in UAT."""
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_SUBGROUP_ROW],
        ):
            async with _make_client() as client:
                response = await client.get(_SUBGROUPS_URL, headers=_HEADERS_WITH_TOKEN)
        assert response.json()["nelsonStoredFlagsAvailable"] is False

    async def test_signals_client_side_only_is_true(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_SUBGROUP_ROW],
        ):
            async with _make_client() as client:
                response = await client.get(_SUBGROUPS_URL, headers=_HEADERS_WITH_TOKEN)
        assert response.json()["signalsClientSideOnly"] is True

    async def test_locked_limits_is_null(self, monkeypatch) -> None:
        """Slice 1: lockedLimits always null — spc_locked_limits deferred."""
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_SUBGROUP_ROW],
        ):
            async with _make_client() as client:
                response = await client.get(_SUBGROUPS_URL, headers=_HEADERS_WITH_TOKEN)
        assert response.json()["lockedLimits"] is None

    async def test_operation_id_not_work_centre_id(self, monkeypatch) -> None:
        """operationId (inspection op) must not be exposed as workCentreId."""
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_SUBGROUP_ROW],
        ):
            async with _make_client() as client:
                response = await client.get(_SUBGROUPS_URL, headers=_HEADERS_WITH_TOKEN)
        data = response.json()
        assert "workCentreId" not in data
        assert data["operationId"] == "00000001"

    async def test_no_mock_fallback_on_query_error(self, monkeypatch) -> None:
        """Databricks error must propagate as 502 — never fall back to mock data."""
        from shared.query_service.errors import DatabricksQueryError

        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksQueryError("spc.get_subgroups", "Warehouse offline"),
        ):
            async with _make_client() as client:
                response = await client.get(_SUBGROUPS_URL, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 502

    async def test_permission_error_returns_403(self, monkeypatch) -> None:
        from shared.query_service.errors import DatabricksPermissionError

        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksPermissionError("spc.get_subgroups"),
        ):
            async with _make_client() as client:
                response = await client.get(_SUBGROUPS_URL, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 403

    async def test_empty_rows_returns_200_with_empty_points(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[],
        ):
            async with _make_client() as client:
                response = await client.get(_SUBGROUPS_URL, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        assert response.json()["points"] == []

    async def test_points_have_required_keys(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_SUBGROUP_ROW],
        ):
            async with _make_client() as client:
                response = await client.get(_SUBGROUPS_URL, headers=_HEADERS_WITH_TOKEN)
        points = response.json()["points"]
        assert len(points) == 1
        p = points[0]
        for key in ("batchId", "batchDate", "subgroupMean", "subgroupRange",
                    "sampleCount", "lslSpec", "uslSpec"):
            assert key in p, f"Missing point key: {key}"

    async def test_no_status_field_in_points(self, monkeypatch) -> None:
        """No in-control/warning/out-of-control — signals are client-side only."""
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_SUBGROUP_ROW],
        ):
            async with _make_client() as client:
                response = await client.get(_SUBGROUPS_URL, headers=_HEADERS_WITH_TOKEN)
        for p in response.json()["points"]:
            assert "status" not in p

    async def test_sets_x_query_name_header(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_SUBGROUP_ROW],
        ):
            async with _make_client() as client:
                response = await client.get(_SUBGROUPS_URL, headers=_HEADERS_WITH_TOKEN)
        assert response.headers.get("x-query-name") == "spc.get_subgroups"

    async def test_response_model_schema_registered(self) -> None:
        """OpenAPI schema must reference SPCSubgroupResponse — confirms response_model wired."""
        async with _make_client() as client:
            response = await client.get("/openapi.json")
        schema = response.json()
        path_item = schema["paths"].get("/api/spc/subgroups", {})
        get_op = path_item.get("get", {})
        response_200 = get_op.get("responses", {}).get("200", {})
        content = response_200.get("content", {})
        json_schema = content.get("application/json", {}).get("schema", {})
        ref = json_schema.get("$ref", "")
        assert "SPCSubgroupResponse" in ref or "SPCSubgroupResponse" in str(json_schema)

    async def test_no_v1_snake_case_field_names_in_response(self, monkeypatch) -> None:
        """V1 column names must not leak into the JSON payload.

        The source MV uses different column names than V1 (e.g. batch_date not
        sample_timestamp). Verify none of the old V1 names appear in the response.
        """
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_SUBGROUP_ROW],
        ):
            async with _make_client() as client:
                response = await client.get(_SUBGROUPS_URL, headers=_HEADERS_WITH_TOKEN)
        body_str = response.text
        v1_field_names = [
            "result_value",
            "sample_id",
            "sample_timestamp",
            "unit_of_measure",
            "subgroup_sd",
            "subgroup_mean",   # snake_case V1 form — response uses camelCase subgroupMean
            "subgroup_range",  # snake_case V1 form — response uses camelCase subgroupRange
        ]
        for field in v1_field_names:
            assert field not in body_str, f"V1 field name leaked into response: {field}"
