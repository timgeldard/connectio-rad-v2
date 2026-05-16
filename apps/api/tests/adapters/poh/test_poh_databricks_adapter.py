"""Tests for the POH Databricks adapter QuerySpec factories."""
import pytest

from adapters.poh.poh_databricks_adapter import (
    OrderOperationsRequest,
    ProcessOrderHeaderRequest,
    get_order_operations_spec,
    get_process_order_header_spec,
)
from shared.query_service.cache_policy import CacheTier


# ---------------------------------------------------------------------------
# get_process_order_header_spec
# ---------------------------------------------------------------------------

class TestGetProcessOrderHeaderSpec:
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

    def test_sql_has_where_clause_for_order_id(self) -> None:
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert "WHERE aufnr = :process_order_id" in spec.sql

    def test_sql_has_limit(self) -> None:
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert "LIMIT :max_rows" in spec.sql

    def test_sql_contains_todo_markers(self) -> None:
        """All column references must be marked with TODO until verified."""
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert "TODO" in spec.sql


# ---------------------------------------------------------------------------
# get_order_operations_spec
# ---------------------------------------------------------------------------

class TestGetOrderOperationsSpec:
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

    def test_two_requests_produce_independent_params(self) -> None:
        spec1 = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        spec2 = get_process_order_header_spec(ProcessOrderHeaderRequest("200002"))
        assert spec1.params["process_order_id"] != spec2.params["process_order_id"]
