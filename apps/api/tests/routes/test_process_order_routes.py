"""Route tests for POST /api/por/order-header — legacy-api and databricks-api modes."""
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

_FAKE_ROW = {
    "process_order_id": "000000100001",
    "order_type": "PI01",
    "material_id": "000000000000001234",
    "material_description": "Test Product",
    "plant_id": "IE01",
    "planned_quantity": 100.0,
    "confirmed_quantity": 0.0,
    "uom": "KG",
    "planned_start": "2024-01-15T06:00:00",
    "planned_finish": "2024-01-15T18:00:00",
    "order_status_raw": "REL",
}


# ---------------------------------------------------------------------------
# Legacy-api mode (default)
# ---------------------------------------------------------------------------

class TestOrderHeaderLegacyMode:
    async def test_returns_503_when_v1_url_not_configured(self) -> None:
        """V1_POH_API_BASE_URL is not set in test env — must return 503."""
        async with _make_client() as client:
            response = await client.post(
                "/api/por/order-header",
                json={"process_order_id": "100001"},
            )
        assert response.status_code == 503

    async def test_legacy_mode_does_not_call_databricks_client(
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
                # Will 503 because V1 URL not set — but databricks client must not be called
                await client.post(
                    "/api/por/order-header",
                    json={"process_order_id": "100001"},
                )

        assert called == []


# ---------------------------------------------------------------------------
# Databricks-api mode
# ---------------------------------------------------------------------------

class TestOrderHeaderDatabricksMode:
    async def test_returns_503_when_databricks_host_missing(
        self, monkeypatch
    ) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.delenv("DATABRICKS_HOST", raising=False)
        monkeypatch.delenv("SQL_WAREHOUSE_ID", raising=False)

        async with _make_client() as client:
            response = await client.post(
                "/api/por/order-header",
                json={"process_order_id": "100001"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 503
        assert "DATABRICKS_HOST" in response.json()["detail"]

    async def test_returns_503_when_warehouse_id_missing(
        self, monkeypatch
    ) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.delenv("SQL_WAREHOUSE_ID", raising=False)

        async with _make_client() as client:
            response = await client.post(
                "/api/por/order-header",
                json={"process_order_id": "100001"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 503

    async def test_returns_401_when_oauth_token_missing(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
        ):
            async with _make_client() as client:
                response = await client.post(
                    "/api/por/order-header",
                    json={"process_order_id": "100001"},
                    # No x-forwarded-access-token header
                )
        assert response.status_code == 401

    async def test_returns_404_when_no_rows(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[],
        ):
            async with _make_client() as client:
                response = await client.post(
                    "/api/por/order-header",
                    json={"process_order_id": "NOTEXIST"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 404

    async def test_returns_200_with_mapped_data(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_ROW],
        ):
            async with _make_client() as client:
                response = await client.post(
                    "/api/por/order-header",
                    json={"process_order_id": "000000100001"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        data = response.json()
        assert data["processOrderId"] == "000000100001"
        assert data["materialId"] == "000000000000001234"
        assert data["plantId"] == "IE01"
        assert data["orderStatus"] == "released"

    async def test_sets_x_data_source_header(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_ROW],
        ):
            async with _make_client() as client:
                response = await client.post(
                    "/api/por/order-header",
                    json={"process_order_id": "000000100001"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.headers.get("x-data-source") == "databricks-api"

    async def test_sets_x_adapter_mode_header(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_ROW],
        ):
            async with _make_client() as client:
                response = await client.post(
                    "/api/por/order-header",
                    json={"process_order_id": "000000100001"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.headers.get("x-adapter-mode") == "databricks-api"

    async def test_sets_x_query_name_header(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_ROW],
        ):
            async with _make_client() as client:
                response = await client.post(
                    "/api/por/order-header",
                    json={"process_order_id": "000000100001"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.headers.get("x-query-name") is not None
        assert "process_order_header" in response.headers.get("x-query-name", "")

    async def test_source_is_databricks_api(self, monkeypatch) -> None:
        """Source badge on the POH spec must be 'databricks-api'."""
        from adapters.poh.poh_databricks_adapter import (
            ProcessOrderHeaderRequest,
            get_process_order_header_spec,
        )
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert spec.source_badge == "databricks-api"

    async def test_uses_process_order_id_from_request(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")

        captured_sql_params: list[dict] = []

        async def capture_execute(self_inner, *, sql, params, oauth_token, **kwargs):
            captured_sql_params.append(params)
            return [_FAKE_ROW]

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            capture_execute,
        ):
            async with _make_client() as client:
                await client.post(
                    "/api/por/order-header",
                    json={"process_order_id": "999888"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert captured_sql_params[0]["process_order_id"] == "999888"

    async def test_does_not_fall_back_to_legacy_on_query_error(
        self, monkeypatch
    ) -> None:
        from shared.query_service.errors import DatabricksQueryError

        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksQueryError("test.query", "Warehouse down"),
        ):
            async with _make_client() as client:
                response = await client.post(
                    "/api/por/order-header",
                    json={"process_order_id": "100001"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        # Must return 502 — not fall back to 503 (legacy) or 200 (mock)
        assert response.status_code == 502
