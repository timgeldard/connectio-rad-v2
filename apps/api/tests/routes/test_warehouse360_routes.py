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
            "plant_id": "IE10",
            "warehouse_id": "WH01",
            "inbound_due_count": 3,
            "inbound_overdue_count": 1,
            "outbound_due_count": 5,
            "outbound_overdue_count": 0,
            "staging_open_count": 8,
            "staging_overdue_count": 2,
            "near_expiry_count": 4,
            "reconciliation_exception_count": 2,
            "blocked_stock_count": 1,
        }

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[fake_row],
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/warehouse360/overview",
                    params={"warehouse_id": "WH01"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        data = response.json()
        assert data["warehouseId"] == "WH01"
        assert data["inboundDueCount"] == 3
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
        fake_rows = [
            {
                "document_type": "Purchase Order",
                "purchase_order_id": "0045001234",
                "stock_transport_order_id": "",
                "item_id": "00010",
                "vendor_id": "0008100123",
                "supplying_plant_id": "",
                "material_id": "000000000000821034",
                "material_description": "Raw Milk",
                "batch_id": "0000123456",
                "plant_id": "IE10",
                "storage_location": "SL01",
                "warehouse_number": "WH01",
                "expected_date": "2026-05-18",
                "received_date": None,
                "quantity": 25000.0,
                "unit_of_measure": "L",
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
                    "/api/warehouse360/inbound",
                    params={"warehouse_id": "WH01"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["documentType"] == "PO"
        assert data[0]["purchaseOrderId"] == "0045001234"
        assert data[0]["materialId"] == "000000000000821034"
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
