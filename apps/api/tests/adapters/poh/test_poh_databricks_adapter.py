"""Tests for the POH Databricks adapter — QuerySpec factories and row mappers."""
import pytest

from adapters.poh.poh_databricks_adapter import (
    OrderOperationsRequest,
    ProcessOrderHeaderRequest,
    get_order_operations_spec,
    get_process_order_header_spec,
    map_process_order_header_rows,
    _format_datetime,
    _map_order_status,
    _map_order_type,
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
        assert "AND werks = :plant_id" not in spec.sql

    def test_plant_id_included_in_params_when_provided(self) -> None:
        spec = get_process_order_header_spec(
            ProcessOrderHeaderRequest("100001", plant_id="IE01")
        )
        assert spec.params["plant_id"] == "IE01"

    def test_plant_filter_in_sql_when_plant_id_provided(self) -> None:
        spec = get_process_order_header_spec(
            ProcessOrderHeaderRequest("100001", plant_id="IE01")
        )
        assert "AND werks = :plant_id" in spec.sql

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
        assert "WHERE aufnr = :process_order_id" in spec.sql

    def test_sql_has_limit(self) -> None:
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert "LIMIT :max_rows" in spec.sql

    def test_sql_contains_todo_markers(self) -> None:
        """Column references remain TODO until verified against live DDL."""
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert "TODO" in spec.sql

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
        assert "WHERE aufnr = :process_order_id" in spec.sql

    def test_sql_has_order_by_vornr(self) -> None:
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert "ORDER BY vornr" in spec.sql

    def test_sql_has_limit(self) -> None:
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert "LIMIT :max_rows" in spec.sql

    def test_sql_contains_todo_markers(self) -> None:
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert "TODO" in spec.sql

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
        return {
            "process_order_id": "000000100001",
            "order_type": "PI01",
            "material_id": "000000000000001234",
            "material_description": "Test Product A",
            "plant_id": "IE01",
            "planned_quantity": 100.0,
            "confirmed_quantity": 75.5,
            "uom": "KG",
            "planned_start": "2024-01-15T06:00:00",
            "planned_finish": "2024-01-15T18:00:00",
            "order_status_raw": "REL",
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

    def test_planned_quantity_is_float(self) -> None:
        result = map_process_order_header_rows([self._full_row()])
        assert result is not None
        assert isinstance(result["plannedQuantity"], float)
        assert result["plannedQuantity"] == 100.0

    def test_confirmed_quantity_is_float(self) -> None:
        result = map_process_order_header_rows([self._full_row()])
        assert result is not None
        assert result["confirmedQuantity"] == 75.5

    def test_none_quantity_defaults_to_zero(self) -> None:
        row = {**self._full_row(), "planned_quantity": None}
        result = map_process_order_header_rows([row])
        assert result is not None
        assert result["plannedQuantity"] == 0.0

    def test_optional_batch_id_included_when_present(self) -> None:
        row = {**self._full_row(), "batch_id": "B001"}
        result = map_process_order_header_rows([row])
        assert result is not None
        assert result["batchId"] == "B001"

    def test_optional_batch_id_absent_when_none(self) -> None:
        row = {**self._full_row(), "batch_id": None}
        result = map_process_order_header_rows([row])
        assert result is not None
        assert "batchId" not in result

    def test_optional_production_line_included_when_present(self) -> None:
        row = {**self._full_row(), "production_line": "LINE-A"}
        result = map_process_order_header_rows([row])
        assert result is not None
        assert result["productionLine"] == "LINE-A"

    def test_optional_actual_start_included_when_present(self) -> None:
        row = {**self._full_row(), "actual_start": "2024-01-15T07:30:00"}
        result = map_process_order_header_rows([row])
        assert result is not None
        assert result["actualStart"] == "2024-01-15T07:30:00"

    def test_optional_actual_start_absent_when_none(self) -> None:
        result = map_process_order_header_rows([self._full_row()])
        assert result is not None
        assert "actualStart" not in result


class TestMapOrderType:
    def test_pi01_maps_to_process_order(self) -> None:
        assert _map_order_type("PI01") == "process-order"

    def test_pp01_maps_to_production_order(self) -> None:
        assert _map_order_type("PP01") == "production-order"

    def test_pm01_maps_to_maintenance_order(self) -> None:
        assert _map_order_type("PM01") == "maintenance-order"

    def test_pr_maps_to_planned_order(self) -> None:
        assert _map_order_type("PR") == "planned-order"

    def test_unknown_defaults_to_process_order(self) -> None:
        assert _map_order_type("UNKNOWN") == "process-order"

    def test_none_defaults_to_process_order(self) -> None:
        assert _map_order_type(None) == "process-order"


class TestMapOrderStatus:
    def test_rel_maps_to_released(self) -> None:
        assert _map_order_status("REL") == "released"

    def test_crtd_maps_to_created(self) -> None:
        assert _map_order_status("CRTD") == "created"

    def test_pcnf_maps_to_partially_confirmed(self) -> None:
        assert _map_order_status("PCNF") == "partially-confirmed"

    def test_cnf_maps_to_confirmed(self) -> None:
        assert _map_order_status("CNF") == "confirmed"

    def test_clsd_maps_to_closed(self) -> None:
        assert _map_order_status("CLSD") == "closed"

    def test_teco_maps_to_closed(self) -> None:
        assert _map_order_status("TECO") == "closed"

    def test_dlt_maps_to_cancelled(self) -> None:
        assert _map_order_status("DLT") == "cancelled"

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
