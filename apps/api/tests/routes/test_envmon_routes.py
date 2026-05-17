"""Route tests for GET /api/envmon/site-summary — databricks-api mode only.

No legacy-api fallback exists for EnvMon routes. Any mode other than
databricks-api returns 503.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx
import pytest
from httpx import ASGITransport

from main import app


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


_HEADERS_WITH_TOKEN = {
    "x-forwarded-access-token": "user-bearer-token",
    "x-forwarded-user": "user123",
    "x-forwarded-email": "user@example.com",
}

_SITE_SUMMARY_URL = (
    "/api/envmon/site-summary"
    "?plant_id=C061&period_start=2026-01-01&period_end=2026-05-17"
)

_FAKE_AGGREGATE_ROW = {
    "total_locs": 50,
    "active_fails": 3,
    "warnings": 2,
    "pending": 1,
    "pass_locs": 44,
    "lots_tested": 142,
}


# ---------------------------------------------------------------------------
# Wrong adapter mode
# ---------------------------------------------------------------------------

class TestEnvMonSiteSummaryWrongMode:
    async def test_returns_503_when_mode_is_legacy_api(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.get(_SITE_SUMMARY_URL, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503

    async def test_returns_503_when_mode_is_default(self, monkeypatch) -> None:
        """Default mode (no env var set) must return 503 — no silent mode switch."""
        monkeypatch.delenv("BACKEND_ADAPTER_MODE", raising=False)
        async with _make_client() as client:
            response = await client.get(_SITE_SUMMARY_URL, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503

    async def test_does_not_call_databricks_client_in_legacy_mode(
        self, monkeypatch
    ) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        called: list[bool] = []

        async def _mock_execute(*args, **kwargs):
            called.append(True)
            return []

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            _mock_execute,
        ):
            async with _make_client() as client:
                await client.get(_SITE_SUMMARY_URL, headers=_HEADERS_WITH_TOKEN)

        assert called == []


# ---------------------------------------------------------------------------
# Databricks-api mode — infrastructure failures
# ---------------------------------------------------------------------------

class TestEnvMonSiteSummaryDatabricksMode:
    def _databricks_env(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("TRACE_SCHEMA", "gold")

    async def test_returns_503_when_databricks_host_missing(
        self, monkeypatch
    ) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.delenv("DATABRICKS_HOST", raising=False)
        monkeypatch.delenv("SQL_WAREHOUSE_ID", raising=False)

        async with _make_client() as client:
            response = await client.get(_SITE_SUMMARY_URL, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503

    async def test_returns_503_when_trace_catalog_missing(
        self, monkeypatch
    ) -> None:
        """DatabricksConfigError from missing TRACE_CATALOG must map to 503."""
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
        monkeypatch.delenv("TRACE_CATALOG", raising=False)

        async with _make_client() as client:
            response = await client.get(_SITE_SUMMARY_URL, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503

    async def test_returns_401_when_oauth_token_missing(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
        ):
            async with _make_client() as client:
                response = await client.get(
                    _SITE_SUMMARY_URL
                    # No x-forwarded-access-token
                )
        assert response.status_code == 401

    async def test_returns_200_with_dict_shape(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_AGGREGATE_ROW],
        ):
            async with _make_client() as client:
                response = await client.get(
                    _SITE_SUMMARY_URL, headers=_HEADERS_WITH_TOKEN
                )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)

    async def test_200_response_has_plant_id(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_AGGREGATE_ROW],
        ):
            async with _make_client() as client:
                response = await client.get(
                    _SITE_SUMMARY_URL, headers=_HEADERS_WITH_TOKEN
                )

        assert response.json()["plantId"] == "C061"

    async def test_200_response_maps_zones_monitored(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_AGGREGATE_ROW],
        ):
            async with _make_client() as client:
                response = await client.get(
                    _SITE_SUMMARY_URL, headers=_HEADERS_WITH_TOKEN
                )

        assert response.json()["zonesMonitored"] == 50

    async def test_200_response_positive_rate_is_percentage(self, monkeypatch) -> None:
        """positiveRate must be 0–100 percentage, not 0–1 fraction."""
        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_AGGREGATE_ROW],
        ):
            async with _make_client() as client:
                response = await client.get(
                    _SITE_SUMMARY_URL, headers=_HEADERS_WITH_TOKEN
                )

        rate = response.json()["positiveRate"]
        assert 0.0 <= rate <= 100.0
        assert rate == pytest.approx(6.0, rel=1e-3)

    async def test_200_response_risk_status_non_compliant(self, monkeypatch) -> None:
        """3 active fails → riskStatus must be non-compliant."""
        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_AGGREGATE_ROW],
        ):
            async with _make_client() as client:
                response = await client.get(
                    _SITE_SUMMARY_URL, headers=_HEADERS_WITH_TOKEN
                )

        assert response.json()["riskStatus"] == "non-compliant"

    async def test_empty_rows_returns_200_with_default_shape(self, monkeypatch) -> None:
        """No data for plant/period → 200 with zero-value default, not 404."""
        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[],
        ):
            async with _make_client() as client:
                response = await client.get(
                    _SITE_SUMMARY_URL, headers=_HEADERS_WITH_TOKEN
                )

        assert response.status_code == 200
        data = response.json()
        assert data["plantId"] == "C061"
        assert data["zonesMonitored"] == 0
        assert data["riskStatus"] == "unknown"
        assert data["confidence"] == 0.0

    async def test_sets_x_data_source_header(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_AGGREGATE_ROW],
        ):
            async with _make_client() as client:
                response = await client.get(
                    _SITE_SUMMARY_URL, headers=_HEADERS_WITH_TOKEN
                )

        assert response.headers.get("x-data-source") == "databricks-api"

    async def test_sets_x_adapter_mode_header(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_AGGREGATE_ROW],
        ):
            async with _make_client() as client:
                response = await client.get(
                    _SITE_SUMMARY_URL, headers=_HEADERS_WITH_TOKEN
                )

        assert response.headers.get("x-adapter-mode") == "databricks-api"

    async def test_sets_x_query_name_header(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_AGGREGATE_ROW],
        ):
            async with _make_client() as client:
                response = await client.get(
                    _SITE_SUMMARY_URL, headers=_HEADERS_WITH_TOKEN
                )

        query_name = response.headers.get("x-query-name", "")
        assert "envmon" in query_name
        assert "site_summary" in query_name

    async def test_response_keys_match_contract_shape(self, monkeypatch) -> None:
        """Response keys must exactly match EnvMonSiteSummarySchema — catches future field drift."""
        self._databricks_env(monkeypatch)

        expected_keys = {
            "plantId", "plantName", "zonesMonitored", "zonesWithAlerts",
            "positiveCount", "positiveRate", "openCorrectiveActions",
            "overdueActions", "complianceRate", "riskStatus",
            "highestSeverity", "confidence",
        }

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_AGGREGATE_ROW],
        ):
            async with _make_client() as client:
                response = await client.get(
                    _SITE_SUMMARY_URL, headers=_HEADERS_WITH_TOKEN
                )

        assert set(response.json().keys()) == expected_keys

    async def test_does_not_fall_back_on_databricks_error(self, monkeypatch) -> None:
        from shared.query_service.errors import DatabricksQueryError

        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksQueryError("envmon.get_site_summary", "Warehouse offline"),
        ):
            async with _make_client() as client:
                response = await client.get(
                    _SITE_SUMMARY_URL, headers=_HEADERS_WITH_TOKEN
                )

        assert response.status_code == 502

    async def test_permission_error_returns_403(self, monkeypatch) -> None:
        from shared.query_service.errors import DatabricksPermissionError

        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksPermissionError("envmon.get_site_summary"),
        ):
            async with _make_client() as client:
                response = await client.get(
                    _SITE_SUMMARY_URL, headers=_HEADERS_WITH_TOKEN
                )

        assert response.status_code == 403

    async def test_rate_limit_error_returns_429(self, monkeypatch) -> None:
        from shared.query_service.errors import DatabricksRateLimitError

        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksRateLimitError("envmon.get_site_summary"),
        ):
            async with _make_client() as client:
                response = await client.get(
                    _SITE_SUMMARY_URL, headers=_HEADERS_WITH_TOKEN
                )

        assert response.status_code == 429
