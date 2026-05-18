"""Tests for the Warehouse360 Databricks adapter."""
import pytest

from adapters.warehouse360.warehouse360_databricks_adapter import (
    WarehouseOverviewRequest,
    WarehouseInboundRequest,
    WarehouseOutboundRequest,
    WarehouseStagingRequest,
    WarehouseExceptionRequest,
    get_warehouse_overview_spec,
    get_warehouse_inbound_spec,
    get_warehouse_outbound_spec,
    get_warehouse_staging_spec,
    get_warehouse_exceptions_spec,
    map_warehouse_overview_rows,
    map_warehouse_inbound_rows,
    map_warehouse_outbound_rows,
    map_warehouse_staging_rows,
    map_warehouse_exceptions_rows,
    _format_datetime,
    _map_exception_severity,
    _safe_float,
    _safe_int,
)
from shared.query_service.cache_policy import CacheTier
from shared.query_service.errors import DatabricksConfigError


# ---------------------------------------------------------------------------
# Fixtures & Shared Context
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _set_wh360_catalog(monkeypatch):
    monkeypatch.setenv("WH360_CATALOG", "wh360_uat_catalog")
    monkeypatch.setenv("WH360_SCHEMA", "wh360_uat_schema")


# ---------------------------------------------------------------------------
# QuerySpec Factories Tests
# ---------------------------------------------------------------------------

class TestWarehouseOverviewSpec:
    def test_spec_properties(self) -> None:
        spec = get_warehouse_overview_spec(WarehouseOverviewRequest("WH01"))
        assert spec.name == "warehouse360.get_overview"
        assert spec.module == "wh360"
        assert spec.endpoint == "/api/warehouse360/overview"
        assert spec.cache_policy == CacheTier.PER_USER_60S
        assert spec.params == {}
        assert "wh360_kpi_snapshot_v" in spec.sql
        assert "`wh360_uat_catalog`.`wh360_uat_schema`.`wh360_kpi_snapshot_v`" in spec.sql
        assert "WHERE" not in spec.sql

    def test_missing_catalog_raises_error(self, monkeypatch) -> None:
        monkeypatch.delenv("WH360_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError):
            get_warehouse_overview_spec(WarehouseOverviewRequest("WH01"))


class TestWarehouseInboundSpec:
    def test_spec_properties(self) -> None:
        spec = get_warehouse_inbound_spec(WarehouseInboundRequest("WH01"))
        assert spec.name == "warehouse360.get_inbound"
        assert spec.module == "wh360"
        assert spec.endpoint == "/api/warehouse360/inbound"
        assert spec.cache_policy == CacheTier.PER_USER_60S
        assert spec.params["warehouse_id"] == "WH01"
        assert "wh360_inbound_v" in spec.sql
        assert "`wh360_uat_catalog`.`wh360_uat_schema`.`wh360_inbound_v`" in spec.sql


class TestWarehouseOutboundSpec:
    def test_spec_properties(self) -> None:
        spec = get_warehouse_outbound_spec(WarehouseOutboundRequest("WH01"))
        assert spec.name == "warehouse360.get_outbound"
        assert spec.module == "wh360"
        assert spec.endpoint == "/api/warehouse360/outbound"
        assert spec.cache_policy == CacheTier.PER_USER_60S
        assert spec.params["warehouse_id"] == "WH01"
        assert "wh360_deliveries_v" in spec.sql
        assert "`wh360_uat_catalog`.`wh360_uat_schema`.`wh360_deliveries_v`" in spec.sql


class TestWarehouseStagingSpec:
    def test_spec_properties(self) -> None:
        spec = get_warehouse_staging_spec(WarehouseStagingRequest("WH01"))
        assert spec.name == "warehouse360.get_staging"
        assert spec.module == "wh360"
        assert spec.endpoint == "/api/warehouse360/staging"
        assert spec.cache_policy == CacheTier.PER_USER_60S
        assert spec.params["warehouse_id"] == "WH01"
        assert "staging_orders_v" in spec.sql
        assert "`wh360_uat_catalog`.`wh360_uat_schema`.`staging_orders_v`" in spec.sql


class TestWarehouseExceptionsSpec:
    def test_spec_properties(self) -> None:
        spec = get_warehouse_exceptions_spec(WarehouseExceptionRequest("WH01"))
        assert spec.name == "warehouse360.get_exceptions"
        assert spec.module == "wh360"
        assert spec.endpoint == "/api/warehouse360/exceptions"
        assert spec.cache_policy == CacheTier.PER_USER_60S
        assert spec.params["warehouse_id"] == "WH01"
        assert "wh360_imwm_exceptions_v" in spec.sql
        assert "`wh360_uat_catalog`.`wh360_uat_schema`.`wh360_imwm_exceptions_v`" in spec.sql


# ---------------------------------------------------------------------------
# Utility Mapping Helpers Tests
# ---------------------------------------------------------------------------

class TestUtilityHelpers:
    def test_safe_float(self) -> None:
        assert _safe_float("12.34") == 12.34
        assert _safe_float(45) == 45.0
        assert _safe_float(None) == 0.0
        assert _safe_float("invalid") == 0.0

    def test_safe_int(self) -> None:
        assert _safe_int("12") == 12
        assert _safe_int(45.6) == 45
        assert _safe_int(None) == 0
        assert _safe_int("invalid") == 0

    def test_format_datetime(self) -> None:
        assert _format_datetime("2024-03-08 14:30:00") == "2024-03-08T14:30:00"
        assert _format_datetime("2024-03-08T14:30:00") == "2024-03-08T14:30:00"
        assert _format_datetime("2024-03-08") == "2024-03-08T00:00:00"
        assert _format_datetime(None) == ""
        assert _format_datetime("None") == ""

    def test_map_exception_severity_by_days(self) -> None:
        # days < 0 (expired) -> critical
        assert _map_exception_severity("low", -3) == "critical"
        # days <= 7 -> high
        assert _map_exception_severity("low", 5) == "high"
        # days <= 30 -> medium
        assert _map_exception_severity("low", 25) == "medium"
        # else -> low
        assert _map_exception_severity("high", 45) == "low"

    def test_map_exception_severity_by_raw_string(self) -> None:
        assert _map_exception_severity("critical", None) == "critical"
        assert _map_exception_severity("high", None) == "high"
        assert _map_exception_severity("warning", None) == "medium"
        assert _map_exception_severity("caution", None) == "low"
        assert _map_exception_severity("unknown", None) == "low"


# ---------------------------------------------------------------------------
# Row Mappers Tests
# ---------------------------------------------------------------------------

class TestWarehouseRowMappers:
    def test_map_overview_rows(self) -> None:
        rows = [{
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
        }]
        res = map_warehouse_overview_rows(rows, WarehouseOverviewRequest("104"))
        assert res["warehouseId"] == "104"
        assert res["ordersTotal"] == 24
        assert res["ordersRed"] == 2
        assert res["deliveriesToday"] == 12
        assert res["inboundOpen"] == 18671
        assert res["binsBlocked"] == 16614
        assert res["binUtilPct"] == 56.8

    def test_map_overview_empty_rows(self) -> None:
        res = map_warehouse_overview_rows([], WarehouseOverviewRequest("104"))
        assert res["warehouseId"] == "104"
        assert res["ordersTotal"] == 0
        assert res["binUtilPct"] == 0.0

    def test_map_inbound_rows_preserves_sap_ids(self) -> None:
        rows = [{
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
        }]
        res = map_warehouse_inbound_rows(rows)
        assert len(res) == 1
        item = res[0]
        assert item["documentType"] == "PO"
        assert item["purchaseOrderId"] == "0045001234"
        assert item["materialId"] == "000000000000821034"
        assert item["batchId"] == "0000123456"
        assert item["expectedDate"] == "2026-05-18T00:00:00"

    def test_map_outbound_rows_preserves_sap_ids(self) -> None:
        rows = [{
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
        }]
        res = map_warehouse_outbound_rows(rows)
        assert len(res) == 1
        item = res[0]
        assert item["deliveryId"] == "0080047212"
        assert item["materialId"] == "000000000000481234"
        assert item["plannedGoodsIssueDate"] == "2026-05-18T15:00:00"

    def test_map_staging_rows_preserves_sap_ids(self) -> None:
        rows = [{
            "process_order_id": "000700123456",
            "reservation_id": "0000123456",
            "reservation_item_id": "0001",
            "material_id": "000000000000840123",
            "material_description": "Starter Culture B10",
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
            "exception_reason": "Shortage",
        }]
        res = map_warehouse_staging_rows(rows)
        assert len(res) == 1
        item = res[0]
        assert item["processOrderId"] == "000700123456"
        assert item["materialId"] == "000000000000840123"
        assert item["openQuantity"] == 0.5

    def test_map_exceptions_rows_severity(self) -> None:
        rows = [
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
            },
            {
                "exception_type": "near-expiry",
                "severity": "low",
                "material_id": "MAT02",
                "batch_id": "B02",
                "plant_id": "IE10",
                "storage_location": "SL01",
                "warehouse_number": "WH01",
                "quantity": 10.0,
                "unit_of_measure": "KG",
                "expiry_date": "2026-05-19",
                "days_to_expiry": 1,
                "document_id": "DOC02",
                "process_order_id": "",
                "delivery_id": "",
                "purchase_order_id": "",
                "reason": "Near expiry",
                "recommended_review_action": "Release",
            }
        ]
        res = map_warehouse_exceptions_rows(rows)
        assert len(res) == 2
        # item 1: days_to_expiry = 31 -> low severity (since >30 days)
        assert res[0]["severity"] == "low"
        # item 2: days_to_expiry = 1 -> high severity (since <=7 days)
        assert res[1]["severity"] == "high"
