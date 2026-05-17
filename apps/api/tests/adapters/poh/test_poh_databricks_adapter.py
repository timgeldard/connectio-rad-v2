"""Tests for the POH Databricks adapter — QuerySpec factories and row mappers.

Column names in get_process_order_header_spec and get_order_operations_spec
were verified against live DDL (connected_plant_uat, 2026-05-17).
Tests updated to reflect confirmed column names.
"""
import pytest

from adapters.poh.poh_databricks_adapter import (
    OrderOperationsRequest,
    ProcessOrderHeaderRequest,
    get_order_operations_spec,
    get_process_order_header_spec,
    map_process_order_header_rows,
    _format_datetime,
    _map_order_status,
)
from shared.query_service.cache_policy import CacheTier
from shared.query_service.errors import DatabricksConfigError


# ---------------------------------------------------------------------------
# get_process_order_header_spec
# ---------------------------------------------------------------------------

class TestGetProcessOrderHeaderSpec:
    @pytest.fixture(autouse=True)
    def _set_poh_catalog(self, monkeypatch):
        monkeypatch.setenv("POH_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("POH_SCHEMA", "csm_process_order_history")

    def test_name(self) -> None:
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert spec.name == "poh.get_process_order_header"

    def test_module(self) -> None:
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert spec.module == "poh"

    def test_endpoint(self) -> None:
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert spec.endpoint == "/api/por/order-header"

    def test_cache_policy_is_per_user(self) -> None:
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert spec.cache_policy == CacheTier.PER_USER_60S

    def test_source_badge(self) -> None:
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert spec.source_badge == "databricks-api"

    def test_tags(self) -> None:
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert "poh" in spec.tags
        assert "process-order" in spec.tags
        assert "header" in spec.tags

    def test_process_order_id_in_params(self) -> None:
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert spec.params["process_order_id"] == "100001"

    def test_no_plant_id_param_when_not_provided(self) -> None:
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert "plant_id" not in spec.params

    def test_no_plant_filter_in_sql_when_not_provided(self) -> None:
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert ":plant_id" not in spec.sql

    def test_plant_id_included_in_params_when_provided(self) -> None:
        spec = get_process_order_header_spec(
            ProcessOrderHeaderRequest("100001", plant_id="IE01")
        )
        assert spec.params["plant_id"] == "IE01"

    def test_plant_filter_in_sql_when_plant_id_provided(self) -> None:
        spec = get_process_order_header_spec(
            ProcessOrderHeaderRequest("100001", plant_id="IE01")
        )
        assert "PLANT_ID = :plant_id" in spec.sql

    def test_sql_references_vw_gold_process_order(self) -> None:
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert "vw_gold_process_order" in spec.sql

    def test_sql_uses_poh_catalog(self) -> None:
        """SQL must include catalog from POH_CATALOG env var."""
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert "`connected_plant_uat`" in spec.sql

    def test_sql_uses_poh_schema(self) -> None:
        """SQL must include schema from POH_SCHEMA env var."""
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert "`csm_process_order_history`" in spec.sql

    def test_sql_has_no_unqualified_from_vw(self) -> None:
        """SQL must not have bare unqualified FROM vw_gold_process_order."""
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert "FROM vw_gold_process_order" not in spec.sql

    def test_sql_has_where_clause_for_order_id(self) -> None:
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert "PROCESS_ORDER_ID = :process_order_id" in spec.sql

    def test_sql_has_limit(self) -> None:
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert "LIMIT :max_rows" in spec.sql

    def test_sql_uses_confirmed_column_names(self) -> None:
        """SQL must use columns confirmed from live DDL (2026-05-17)."""
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert "PROCESS_ORDER_ID" in spec.sql
        assert "STATUS" in spec.sql
        assert "MATERIAL_ID" in spec.sql
        assert "MATERIAL_DESCRIPTION" in spec.sql
        assert "PLANT_ID" in spec.sql

    def test_missing_poh_catalog_raises_config_error(self, monkeypatch) -> None:
        monkeypatch.delenv("POH_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError):
            get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))


# ---------------------------------------------------------------------------
# get_order_operations_spec
# ---------------------------------------------------------------------------

class TestGetOrderOperationsSpec:
    @pytest.fixture(autouse=True)
    def _set_poh_catalog(self, monkeypatch):
        monkeypatch.setenv("POH_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("POH_SCHEMA", "csm_process_order_history")

    def test_name(self) -> None:
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert spec.name == "poh.get_order_operations"

    def test_module(self) -> None:
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert spec.module == "poh"

    def test_endpoint(self) -> None:
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert spec.endpoint == "/api/por/order-header"

    def test_cache_policy_is_per_user(self) -> None:
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert spec.cache_policy == CacheTier.PER_USER_60S

    def test_tags(self) -> None:
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert "poh" in spec.tags
        assert "operations" in spec.tags

    def test_process_order_id_in_params(self) -> None:
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert spec.params["process_order_id"] == "100001"

    def test_sql_references_vw_gold_process_order_phase(self) -> None:
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert "vw_gold_process_order_phase" in spec.sql

    def test_sql_uses_poh_catalog(self) -> None:
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert "`connected_plant_uat`" in spec.sql

    def test_sql_has_no_unqualified_from_vw(self) -> None:
        """SQL must not have bare unqualified FROM vw_gold_process_order_phase."""
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert "FROM vw_gold_process_order_phase" not in spec.sql

    def test_sql_has_where_clause_for_order_id(self) -> None:
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert "PROCESS_ORDER_ID = :process_order_id" in spec.sql

    def test_sql_has_order_by_sort_number(self) -> None:
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert "ORDER BY SORT_NUMBER" in spec.sql

    def test_sql_has_limit(self) -> None:
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert "LIMIT :max_rows" in spec.sql

    def test_sql_uses_confirmed_column_names(self) -> None:
        """SQL must use columns confirmed from live DDL (2026-05-17)."""
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert "PHASE_ID" in spec.sql
        assert "PHASE_DESCRIPTION" in spec.sql
        assert "OPERATION_QUANTITY" in spec.sql
        assert "SORT_NUMBER" in spec.sql

    def test_missing_poh_catalog_raises_config_error(self, monkeypatch) -> None:
        monkeypatch.delenv("POH_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError):
            get_order_operations_spec(OrderOperationsRequest("100001"))

    def test_two_requests_produce_independent_params(self) -> None:
        spec1 = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        spec2 = get_process_order_header_spec(ProcessOrderHeaderRequest("200002"))
        assert spec1.params["process_order_id"] != spec2.params["process_order_id"]


# ---------------------------------------------------------------------------
# map_process_order_header_rows
# ---------------------------------------------------------------------------

class TestMapProcessOrderHeaderRows:
    def _full_row(self) -> dict:
        """Row using confirmed column names from vw_gold_process_order (2026-05-17)."""
        return {
            "process_order_id": "000000100001",
            "order_status_raw": "IN PROGRESS",
            "material_id": "000000000000001234",
            "material_description": "Test Product A",
            "plant_id": "IE01",
            "inspection_lot_id": "LOT001",
        }

    def test_returns_none_for_empty_rows(self) -> None:
        assert map_process_order_header_rows([]) is None

    def test_returns_dict_for_single_row(self) -> None:
        result = map_process_order_header_rows([self._full_row()])
        assert isinstance(result, dict)

    def test_uses_first_row_only(self) -> None:
        row1 = {**self._full_row(), "process_order_id": "111"}
        row2 = {**self._full_row(), "process_order_id": "222"}
        result = map_process_order_header_rows([row1, row2])
        assert result is not None
        assert result["processOrderId"] == "111"

    def test_process_order_id_mapped(self) -> None:
        result = map_process_order_header_rows([self._full_row()])
        assert result is not None
        assert result["processOrderId"] == "000000100001"

    def test_leading_zeros_preserved(self) -> None:
        row = {**self._full_row(), "material_id": "000000000000001234"}
        result = map_process_order_header_rows([row])
        assert result is not None
        assert result["materialId"] == "000000000000001234"

    def test_plant_id_mapped(self) -> None:
        result = map_process_order_header_rows([self._full_row()])
        assert result is not None
        assert result["plantId"] == "IE01"

    def test_material_description_mapped(self) -> None:
        result = map_process_order_header_rows([self._full_row()])
        assert result is not None
        assert result["materialDescription"] == "Test Product A"

    def test_order_status_mapped(self) -> None:
        result = map_process_order_header_rows([self._full_row()])
        assert result is not None
        assert result["orderStatus"] == "in-process"

    def test_order_type_defaults_to_process_order(self) -> None:
        result = map_process_order_header_rows([self._full_row()])
        assert result is not None
        assert result["orderType"] == "process-order"

    def test_planned_quantity_defaults_to_zero(self) -> None:
        result = map_process_order_header_rows([self._full_row()])
        assert result is not None
        assert result["plannedQuantity"] == 0.0

    def test_confirmed_quantity_defaults_to_zero(self) -> None:
        result = map_process_order_header_rows([self._full_row()])
        assert result is not None
        assert result["confirmedQuantity"] == 0.0

    def test_inspection_lot_id_included_when_present(self) -> None:
        result = map_process_order_header_rows([self._full_row()])
        assert result is not None
        assert result.get("inspectionLotId") == "LOT001"

    def test_inspection_lot_id_absent_when_none(self) -> None:
        row = {**self._full_row(), "inspection_lot_id": None}
        result = map_process_order_header_rows([row])
        assert result is not None
        assert "inspectionLotId" not in result


# ---------------------------------------------------------------------------
# _map_order_status
# ---------------------------------------------------------------------------

class TestMapOrderStatus:
    def test_in_progress_maps_to_in_process(self) -> None:
        assert _map_order_status("IN PROGRESS") == "in-process"

    def test_not_started_maps_to_created(self) -> None:
        assert _map_order_status("NOT STARTED") == "created"

    def test_released_maps_to_released(self) -> None:
        assert _map_order_status("RELEASED") == "released"

    def test_completed_maps_to_confirmed(self) -> None:
        assert _map_order_status("COMPLETED") == "confirmed"

    def test_closed_maps_to_closed(self) -> None:
        assert _map_order_status("CLOSED") == "closed"

    def test_cancelled_maps_to_cancelled(self) -> None:
        assert _map_order_status("CANCELLED") == "cancelled"

    # SAP technical code fallbacks (in case view exposes AUOBJ codes)
    def test_rel_maps_to_released(self) -> None:
        assert _map_order_status("REL") == "released"

    def test_crtd_maps_to_created(self) -> None:
        assert _map_order_status("CRTD") == "created"

    def test_teco_maps_to_closed(self) -> None:
        assert _map_order_status("TECO") == "closed"

    def test_none_defaults_to_created(self) -> None:
        assert _map_order_status(None) == "created"

    def test_unknown_defaults_to_created(self) -> None:
        assert _map_order_status("UNKNOWN_STATUS") == "created"


class TestFormatDatetime:
    def test_iso_datetime_unchanged(self) -> None:
        assert _format_datetime("2024-01-15T06:00:00") == "2024-01-15T06:00:00"

    def test_space_separator_converted_to_t(self) -> None:
        assert _format_datetime("2024-01-15 06:00:00") == "2024-01-15T06:00:00"

    def test_date_only_gets_midnight_appended(self) -> None:
        assert _format_datetime("2024-01-15") == "2024-01-15T00:00:00"

    def test_none_returns_empty_string(self) -> None:
        assert _format_datetime(None) == ""
