"""Route tests for the Warehouse360 endpoints under /api/warehouse360/*."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx
import pytest
from httpx import ASGITransport

from main import app


# ---------------------------------------------------------------------------
# Helpers & Headers
# ---------------------------------------------------------------------------

def _make_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


_HEADERS_WITH_TOKEN = {
    "x-forwarded-access-token": "user-bearer-token",
    "x-forwarded-user": "user123",
    "x-forwarded-email": "user@example.com",
}


# ---------------------------------------------------------------------------
# Databricks Environment Setup Fixture
# ---------------------------------------------------------------------------

@pytest.fixture
def wh360_databricks_env(monkeypatch) -> None:
    monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
    monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
    monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
    monkeypatch.setenv("WH360_CATALOG", "wh360_uat_catalog")
    monkeypatch.setenv("WH360_SCHEMA", "wh360_uat_schema")


# ---------------------------------------------------------------------------
# Overview Endpoint Tests
# ---------------------------------------------------------------------------

class TestWarehouseOverviewRoute:
    async def test_returns_401_when_unauthenticated(self, wh360_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/warehouse360/overview",
                params={"warehouse_id": "WH01"},
            )
        assert response.status_code == 401

    async def test_returns_503_when_wh360_catalog_missing(self, monkeypatch, wh360_databricks_env) -> None:
        monkeypatch.delenv("WH360_CATALOG", raising=False)
        async with _make_client() as client:
            response = await client.get(
                "/api/warehouse360/overview",
                params={"warehouse_id": "WH01"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 503

    async def test_returns_200_with_mapped_overview(self, wh360_databricks_env) -> None:
        fake_row = {
            "orders_total": 24,
            "orders_red": 2,
            "orders_amber": 5,
            "trs_open": 9573882,
            "tos_open": 0,
            "deliveries_today": 12,
            "deliveries_at_risk": 3,
            "inbound_open": 18671,
            "bins_blocked": 16614,
            "bins_total": 352027,
            "bin_util_pct": "56.8",
        }

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[fake_row],
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/warehouse360/overview",
                    params={"warehouse_id": "104"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        data = response.json()
        assert data["warehouseId"] == "104"
        assert data["ordersTotal"] == 24
        assert data["inboundOpen"] == 18671
        assert data["binUtilPct"] == 56.8
        assert response.headers.get("x-data-source") == "databricks-api"
        assert response.headers.get("x-adapter-mode") == "databricks-api"
        assert "warehouse360.get_overview" in response.headers.get("x-query-name", "")


# ---------------------------------------------------------------------------
# Inbound Endpoint Tests
# ---------------------------------------------------------------------------

class TestWarehouseInboundRoute:
    async def test_returns_401_when_unauthenticated(self, wh360_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/warehouse360/inbound",
                params={"warehouse_id": "WH01"},
            )
        assert response.status_code == 401

    async def test_returns_200_with_mapped_inbound_items(self, wh360_databricks_env) -> None:
        # Row shape matches actual wh360_inbound_v columns
        # (verified in docs/data-layer/warehouse360-inbound-source-verification.md).
        fake_rows = [
            {
                "po_id": "0045001234",
                "po_item": "00010",
                "doc_type": "PO",
                "doc_cat": "F",
                "vendor_id": "0008100123",
                "vendor_name": "Dairy Supplier Ltd",
                "plant_id": "IE10",
                "storage_loc": "SL01",
                "material_id": "000000000000821034",
                "material_name": "Raw Milk",
                "ordered_qty": 25000.0,
                "gr_qty": 0.0,
                "open_qty": 25000.0,
                "uom": "L",
                "delivery_date": "2026-05-18",
                "po_date": "2026-05-10",
                "delivery_complete": "N",
                "qa_lot_id": None,
                "qa_status": None,
            }
        ]

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=fake_rows,
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/warehouse360/inbound",
                    params={"warehouse_id": "WH01"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        item = data[0]
        assert item["documentType"] == "PO"
        assert item["purchaseOrderId"] == "0045001234"
        assert item["materialId"] == "000000000000821034"
        assert item["quantity"] == 25000.0
        assert item["unitOfMeasure"] == "L"
        # Document status derived from delivery_complete (not invented).
        assert item["status"] == "open"
        # Source-truthful absence of fields the view does not carry.
        assert item["warehouseNumber"] is None
        assert item["stockTransportOrderId"] is None
        assert item["supplyingPlantId"] is None
        assert item["exceptionReason"] is None
        assert item["batchId"] is None
        assert response.headers.get("x-query-name") == "warehouse360.get_inbound"


# ---------------------------------------------------------------------------
# Outbound Endpoint Tests
# ---------------------------------------------------------------------------

class TestWarehouseOutboundRoute:
    async def test_returns_401_when_unauthenticated(self, wh360_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/warehouse360/outbound",
                params={"warehouse_id": "WH01"},
            )
        assert response.status_code == 401

    async def test_returns_200_with_mapped_outbound_items(self, wh360_databricks_env) -> None:
        fake_rows = [
            {
                "delivery_id": "0080047212",
                "delivery_item_id": "000010",
                "customer_id": "0003829100",
                "sales_order_id": "0010034921",
                "material_id": "000000000000481234",
                "material_description": "Emmental Block",
                "batch_id": "0000045612",
                "plant_id": "IE10",
                "storage_location": "SL02",
                "warehouse_number": "WH01",
                "planned_goods_issue_date": "2026-05-18 15:00:00",
                "actual_goods_issue_date": None,
                "quantity": 960.0,
                "unit_of_measure": "KG",
                "status": "OPEN",
                "exception_reason": "",
            }
        ]

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=fake_rows,
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/warehouse360/outbound",
                    params={"warehouse_id": "WH01"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["deliveryId"] == "0080047212"
        assert data[0]["materialId"] == "000000000000481234"
        assert response.headers.get("x-query-name") == "warehouse360.get_outbound"


# ---------------------------------------------------------------------------
# Staging Endpoint Tests
# ---------------------------------------------------------------------------

class TestWarehouseStagingRoute:
    async def test_returns_401_when_unauthenticated(self, wh360_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/warehouse360/staging",
                params={"warehouse_id": "WH01"},
            )
        assert response.status_code == 401

    async def test_returns_200_with_mapped_staging_items(self, wh360_databricks_env) -> None:
        fake_rows = [
            {
                "process_order_id": "000700123456",
                "reservation_id": "0000123456",
                "reservation_item_id": "0001",
                "material_id": "000000000000840123",
                "material_description": "Starter Culture",
                "batch_id": "0000987654",
                "plant_id": "IE10",
                "storage_location": "SL03",
                "warehouse_number": "WH01",
                "requirement_date": "2026-05-18 08:30:00",
                "required_quantity": 2.5,
                "staged_quantity": 2.0,
                "open_quantity": 0.5,
                "unit_of_measure": "KG",
                "staging_status": "PARTIAL",
                "exception_reason": "",
            }
        ]

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=fake_rows,
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/warehouse360/staging",
                    params={"warehouse_id": "WH01"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["processOrderId"] == "000700123456"
        assert data[0]["materialId"] == "000000000000840123"
        assert response.headers.get("x-query-name") == "warehouse360.get_staging"


# ---------------------------------------------------------------------------
# Exceptions Endpoint Tests
# ---------------------------------------------------------------------------

class TestWarehouseExceptionsRoute:
    async def test_returns_401_when_unauthenticated(self, wh360_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/warehouse360/exceptions",
                params={"warehouse_id": "WH01"},
            )
        assert response.status_code == 401

    async def test_returns_200_with_mapped_exceptions(self, wh360_databricks_env) -> None:
        fake_rows = [
            {
                "exception_type": "quantity-mismatch",
                "severity": "high",
                "material_id": "MAT01",
                "batch_id": "B01",
                "plant_id": "IE10",
                "storage_location": "SL01",
                "warehouse_number": "WH01",
                "quantity": 20.0,
                "unit_of_measure": "KG",
                "expiry_date": "2026-06-18",
                "days_to_expiry": 31,
                "document_id": "DOC01",
                "process_order_id": "",
                "delivery_id": "",
                "purchase_order_id": "",
                "reason": "Mismatch",
                "recommended_review_action": "Count",
            }
        ]

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=fake_rows,
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/warehouse360/exceptions",
                    params={"warehouse_id": "WH01"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["severity"] == "low"  # deterministic days_to_expiry mapping overrides raw string
        assert data[0]["materialId"] == "MAT01"
        assert response.headers.get("x-query-name") == "warehouse360.get_exceptions"

    async def test_returns_502_on_databricks_query_error(self, wh360_databricks_env) -> None:
        from shared.query_service.errors import DatabricksQueryError

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksQueryError("warehouse360.get_exceptions", "Warehouse failed"),
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/warehouse360/exceptions",
                    params={"warehouse_id": "WH01"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 502


class TestWarehouse360ParameterValidation:
    async def test_empty_warehouse_id_returns_422(self, wh360_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/warehouse360/overview",
                params={"warehouse_id": "   "},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 422
        assert "warehouse_id cannot be empty" in response.json()["detail"]

    async def test_limit_out_of_bounds_low_returns_422(self, wh360_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/warehouse360/inbound",
                params={"warehouse_id": "WH01", "limit": 0},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 422
        assert "limit must be between 1 and 500" in response.json()["detail"]

    async def test_limit_out_of_bounds_high_returns_422(self, wh360_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/warehouse360/outbound",
                params={"warehouse_id": "WH01", "limit": 501},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 422
        assert "limit must be between 1 and 500" in response.json()["detail"]

    async def test_successful_filtering_params_forwarding(self, wh360_databricks_env) -> None:
        fake_rows = []
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=fake_rows,
        ) as mock_exec:
            async with _make_client() as client:
                response = await client.get(
                    "/api/warehouse360/inbound",
                    params={
                        "warehouse_id": "WH01",
                        "plant_id": "PL10",
                        "date_from": "2026-05-01",
                        "date_to": "2026-05-31",
                        "limit": 150,
                    },
                    headers=_HEADERS_WITH_TOKEN,
                )
            assert response.status_code == 200
            # Verify the QuerySpec execution received the correct filtered parameters
            mock_exec.assert_called_once()
            args, kwargs = mock_exec.call_args
            called_sql = kwargs.get("sql") or args[0]
            called_params = kwargs.get("params") or args[1]
            assert called_params["plant_id"] == "PL10"
            assert called_params["date_from"] == "2026-05-01"
            assert called_params["date_to"] == "2026-05-31"


class TestWarehouse360ResponseModelEnforcement:
    """Verify response_model is wired for inbound/outbound/staging/exceptions via OpenAPI schema."""

    async def _get_route_schema_ref(self, path: str) -> str | None:
        async with _make_client() as client:
            resp = await client.get("/openapi.json")
        schema = resp.json()
        path_item = schema["paths"].get(path, {})
        resp_200 = path_item.get("get", {}).get("responses", {}).get("200", {})
        items = resp_200.get("content", {}).get("application/json", {}).get("schema", {}).get("items", {})
        return items.get("$ref")

    async def test_inbound_response_model_is_wired(self) -> None:
        ref = await self._get_route_schema_ref("/api/warehouse360/inbound")
        assert ref is not None and "Warehouse360InboundItem" in ref

    async def test_outbound_response_model_is_wired(self) -> None:
        ref = await self._get_route_schema_ref("/api/warehouse360/outbound")
        assert ref is not None and "Warehouse360OutboundItem" in ref

    async def test_staging_response_model_is_wired(self) -> None:
        ref = await self._get_route_schema_ref("/api/warehouse360/staging")
        assert ref is not None and "Warehouse360StagingItem" in ref

    async def test_exceptions_response_model_is_wired(self) -> None:
        ref = await self._get_route_schema_ref("/api/warehouse360/exceptions")
        assert ref is not None and "Warehouse360ExceptionItem" in ref


