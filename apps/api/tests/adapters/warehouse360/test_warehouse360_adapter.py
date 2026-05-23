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
        assert spec.cache_policy == CacheTier.GLOBAL_300S
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
        # The view does not expose LGNUM — warehouse_id is accepted but the
        # SQL no longer filters on it (documented in the source-verification doc).
        assert "warehouse_id" not in spec.params
        assert "wh360_inbound_v" in spec.sql
        assert "`wh360_uat_catalog`.`wh360_uat_schema`.`wh360_inbound_v`" in spec.sql

    def test_spec_uses_actual_wh360_inbound_v_columns(self) -> None:
        """Pin the source-verified column names so a regression cannot
        silently revert to the broken upper-case identifiers."""
        spec = get_warehouse_inbound_spec(WarehouseInboundRequest("WH01"))
        for actual_col in ("po_id", "po_item", "doc_type", "vendor_id",
                           "plant_id", "storage_loc", "material_id", "material_name",
                           "ordered_qty", "gr_qty", "open_qty", "uom",
                           "delivery_date", "delivery_complete", "qa_lot_id", "qa_status"):
            assert actual_col in spec.sql, f"missing source column {actual_col!r}"
        # Old broken UPPER_CASE identifiers must NOT come back.
        for broken_col in ("DOCUMENT_TYPE", "PURCHASE_ORDER_ID", "WAREHOUSE_NUMBER",
                           "EXPECTED_DATE", "QUANTITY", "UNIT_OF_MEASURE",
                           "EXCEPTION_REASON"):
            assert broken_col not in spec.sql, f"broken column {broken_col!r} leaked back into SQL"


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


class TestQuerySpecDynamicFiltering:
    def test_inbound_with_all_filters(self) -> None:
        req = WarehouseInboundRequest(
            warehouse_id="WH01",
            plant_id="PL10",
            date_from="2026-05-01",
            date_to="2026-05-31",
            limit=250,
        )
        spec = get_warehouse_inbound_spec(req)
        assert spec.params["plant_id"] == "PL10"
        assert spec.params["date_from"] == "2026-05-01"
        assert spec.params["date_to"] == "2026-05-31"
        # Lower-case actual column names from wh360_inbound_v.
        assert "plant_id = :plant_id" in spec.sql
        assert "delivery_date >= :date_from" in spec.sql
        assert "delivery_date <= :date_to" in spec.sql
        assert "LIMIT 250" in spec.sql

    def test_outbound_with_all_filters(self) -> None:
        req = WarehouseOutboundRequest(
            warehouse_id="WH01",
            plant_id="PL10",
            date_from="2026-05-01",
            date_to="2026-05-31",
            limit=250,
        )
        spec = get_warehouse_outbound_spec(req)
        assert spec.params["plant_id"] == "PL10"
        assert spec.params["date_from"] == "2026-05-01"
        assert spec.params["date_to"] == "2026-05-31"
        assert "PLANT_ID = :plant_id" in spec.sql
        assert "PLANNED_GOODS_ISSUE_DATE >= :date_from" in spec.sql
        assert "PLANNED_GOODS_ISSUE_DATE <= :date_to" in spec.sql
        assert "LIMIT 250" in spec.sql

    def test_staging_with_all_filters(self) -> None:
        req = WarehouseStagingRequest(
            warehouse_id="WH01",
            plant_id="PL10",
            date_from="2026-05-01",
            date_to="2026-05-31",
            limit=250,
        )
        spec = get_warehouse_staging_spec(req)
        assert spec.params["plant_id"] == "PL10"
        assert spec.params["date_from"] == "2026-05-01"
        assert spec.params["date_to"] == "2026-05-31"
        assert "PLANT_ID = :plant_id" in spec.sql
        assert "REQUIREMENT_DATE >= :date_from" in spec.sql
        assert "REQUIREMENT_DATE <= :date_to" in spec.sql
        assert "LIMIT 250" in spec.sql

    def test_exceptions_with_all_filters(self) -> None:
        req = WarehouseExceptionRequest(
            warehouse_id="WH01",
            plant_id="PL10",
            date_from="2026-05-01",
            date_to="2026-05-31",
            limit=250,
        )
        spec = get_warehouse_exceptions_spec(req)
        assert spec.params["plant_id"] == "PL10"
        assert spec.params["date_from"] == "2026-05-01"
        assert spec.params["date_to"] == "2026-05-31"
        assert "PLANT_ID = :plant_id" in spec.sql
        assert "EXPIRY_DATE >= :date_from" in spec.sql
        assert "EXPIRY_DATE <= :date_to" in spec.sql
        assert "LIMIT 250" in spec.sql


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
        # Row shape matches actual wh360_inbound_v columns.
        rows = [{
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
        }]
        res = map_warehouse_inbound_rows(rows)
        assert len(res) == 1
        item = res[0]
        assert item["documentType"] == "PO"
        assert item["purchaseOrderId"] == "0045001234"
        assert item["materialId"] == "000000000000821034"
        # Inbound PO lines have no GR-batch until receipt — null is source-truthful.
        assert item["batchId"] is None
        assert item["expectedDate"] == "2026-05-18T00:00:00"

    # ------------------------------------------------------------------
    # Source-truthful inbound mapper guardrails (Gate 1 implementation).
    # ------------------------------------------------------------------

    def test_inbound_status_open_when_delivery_incomplete(self) -> None:
        rows = [{
            "po_id": "P1", "doc_type": "PO", "material_id": "M1",
            "delivery_complete": "N", "open_qty": 100.0, "uom": "KG",
        }]
        res = map_warehouse_inbound_rows(rows)
        assert res[0]["status"] == "open"
        # Not received → no received date.
        assert res[0]["receivedDate"] is None

    def test_inbound_status_received_when_delivery_complete(self) -> None:
        rows = [{
            "po_id": "P1", "doc_type": "PO", "material_id": "M1",
            "delivery_complete": "Y", "open_qty": 0.0, "uom": "KG",
            "delivery_date": "2026-05-18",
        }]
        res = map_warehouse_inbound_rows(rows)
        assert res[0]["status"] == "received"
        # Received → receivedDate echoes delivery_date.
        assert res[0]["receivedDate"] is not None
        assert "2026-05-18" in res[0]["receivedDate"]

    def test_inbound_status_none_when_neither_open_nor_received(self) -> None:
        """delivery_complete='' and open_qty=0 means the lifecycle isn't
        meaningful here. Source-truthful: return None rather than guess."""
        rows = [{
            "po_id": "P1", "doc_type": "PO", "material_id": "M1",
            "delivery_complete": "", "open_qty": 0.0, "uom": "KG",
        }]
        res = map_warehouse_inbound_rows(rows)
        assert res[0]["status"] is None

    def test_inbound_warehouse_number_is_null_not_invented(self) -> None:
        """wh360_inbound_v has no LGNUM/warehouse_number column. Mapper
        must emit None, not the request's warehouse_id or an empty string."""
        rows = [{"po_id": "P1", "doc_type": "PO", "material_id": "M1"}]
        res = map_warehouse_inbound_rows(rows)
        assert res[0]["warehouseNumber"] is None

    def test_inbound_sto_fields_are_null(self) -> None:
        """STO identifier and supplying plant are absent in this view."""
        rows = [{"po_id": "P1", "doc_type": "PO", "material_id": "M1"}]
        res = map_warehouse_inbound_rows(rows)
        assert res[0]["stockTransportOrderId"] is None
        assert res[0]["supplyingPlantId"] is None

    def test_inbound_exception_reason_is_null(self) -> None:
        """Exceptions live in imwm_exceptions_v — never invent one here."""
        rows = [{"po_id": "P1", "doc_type": "PO", "material_id": "M1"}]
        res = map_warehouse_inbound_rows(rows)
        assert res[0]["exceptionReason"] is None

    def test_inbound_unit_of_measure_not_defaulted(self) -> None:
        """No UOM in source → null. Mapper MUST NOT default to 'KG'."""
        rows = [{"po_id": "P1", "doc_type": "PO", "material_id": "M1", "uom": None}]
        res = map_warehouse_inbound_rows(rows)
        assert res[0]["unitOfMeasure"] is None
        rows = [{"po_id": "P1", "doc_type": "PO", "material_id": "M1", "uom": ""}]
        res = map_warehouse_inbound_rows(rows)
        assert res[0]["unitOfMeasure"] is None

    def test_inbound_document_type_unknown_for_unrecognised_codes(self) -> None:
        for raw in (None, "", "MYSTERY", "XYZ"):
            rows = [{"po_id": "P1", "doc_type": raw, "material_id": "M1"}]
            res = map_warehouse_inbound_rows(rows)
            assert res[0]["documentType"] == "unknown", f"doc_type={raw!r} leaked"

    def test_inbound_document_type_sto_when_source_says_sto(self) -> None:
        rows = [{"po_id": "P1", "doc_type": "STO", "material_id": "M1"}]
        res = map_warehouse_inbound_rows(rows)
        assert res[0]["documentType"] == "STO"

    def test_inbound_quantity_maps_to_open_qty(self) -> None:
        """The contract has a single `quantity` field. We map it to
        `open_qty` (still-due quantity) — the most useful value for the
        inbound cockpit panel. The decision is documented in the
        source-verification doc."""
        rows = [{
            "po_id": "P1", "doc_type": "PO", "material_id": "M1",
            "ordered_qty": 1000.0, "gr_qty": 300.0, "open_qty": 700.0,
        }]
        res = map_warehouse_inbound_rows(rows)
        assert res[0]["quantity"] == 700.0

    def test_inbound_quantity_null_when_open_qty_absent(self) -> None:
        rows = [{"po_id": "P1", "doc_type": "PO", "material_id": "M1", "open_qty": None}]
        res = map_warehouse_inbound_rows(rows)
        assert res[0]["quantity"] is None

    def test_inbound_does_not_emit_invented_business_fields(self) -> None:
        """No 'safe' / 'approved' / 'released' / 'cleared' / 'overdue' /
        'due' fields invented on the wire."""
        rows = [{"po_id": "P1", "doc_type": "PO", "material_id": "M1", "delivery_complete": "Y"}]
        res = map_warehouse_inbound_rows(rows)
        for forbidden in ("safe", "approved", "released", "cleared", "overdue", "due", "recallRecommended"):
            assert forbidden not in res[0]

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
