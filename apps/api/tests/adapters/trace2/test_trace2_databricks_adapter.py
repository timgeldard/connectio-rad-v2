"""Tests for Trace Investigation Databricks adapter — QuerySpec factories and row mapping."""
import pytest

from adapters.trace2.trace2_databricks_adapter import (
    Trace2BatchHeaderRequest,
    Trace2MassBalanceRequest,
    Trace2TraceGraphRequest,
    get_batch_header_summary_spec,
    get_mass_balance_spec,
    get_trace_graph_spec,
    map_batch_header_rows,
    map_mass_balance_rows,
    map_trace_graph_rows,
)
from shared.query_service.cache_policy import CacheTier


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

_FULL_BATCH_HEADER_ROW = {
    "material_id": "0000020582002",
    "batch_id": "BATCH001",
    "unrestricted": 100.0,
    "blocked": 0.0,
    "quality_inspection": 0.0,
    "restricted": 0.0,
    "transit": 0.0,
    "total_stock": 100.0,
    "material_name": "Full Cream Milk Powder",
    "plant_id": "IE01",
    "plant_name": "Listowel",
    "batch_status": "RELEASED",
    "uom": "KG",
    "manufacture_date": "2024-03-01T00:00:00Z",
    "expiry_date": "2025-03-01T00:00:00Z",
    "process_order_id": "PO100001",
}

_LINEAGE_ROW_A_TO_B = {
    "parent_material_id": "MAT_A",
    "parent_batch_id": "BATCH_A",
    "parent_plant_id": "IE01",
    "child_material_id": "MAT_B",
    "child_batch_id": "BATCH_B",
    "child_plant_id": "IE01",
    "link_type": "PRODUCTION",
    "parent_material_name": "Material A",
    "child_material_name": "Material B",
    "parent_plant_name": "Listowel",
    "child_plant_name": "Listowel",
}


# ---------------------------------------------------------------------------
# TestGetBatchHeaderSummarySpec
# ---------------------------------------------------------------------------

class TestGetBatchHeaderSummarySpec:
    def _req(self) -> Trace2BatchHeaderRequest:
        return Trace2BatchHeaderRequest("0000020582002", "BATCH001")

    def test_name(self) -> None:
        assert get_batch_header_summary_spec(self._req()).name == "trace2.get_batch_header_summary"

    def test_module(self) -> None:
        assert get_batch_header_summary_spec(self._req()).module == "trace2"

    def test_endpoint(self) -> None:
        assert get_batch_header_summary_spec(self._req()).endpoint == "/api/trace2/batch-header"

    def test_cache_policy_is_per_user(self) -> None:
        assert get_batch_header_summary_spec(self._req()).cache_policy == CacheTier.PER_USER_60S

    def test_source_badge_is_gold_batch_summary_v(self) -> None:
        assert get_batch_header_summary_spec(self._req()).source_badge == "view:gold_batch_summary_v"

    def test_tags(self) -> None:
        spec = get_batch_header_summary_spec(self._req())
        assert "trace2" in spec.tags
        assert "batch-header" in spec.tags
        assert "summary" in spec.tags

    def test_params_contain_material_and_batch_id(self) -> None:
        spec = get_batch_header_summary_spec(self._req())
        assert spec.params["material_id"] == "0000020582002"
        assert spec.params["batch_id"] == "BATCH001"

    def test_sql_references_gold_batch_stock_v(self) -> None:
        assert "gold_batch_stock_v" in get_batch_header_summary_spec(self._req()).sql

    def test_sql_references_gold_batch_summary_v(self) -> None:
        assert "gold_batch_summary_v" in get_batch_header_summary_spec(self._req()).sql

    def test_sql_has_limit(self) -> None:
        assert "LIMIT :max_rows" in get_batch_header_summary_spec(self._req()).sql

    def test_sql_contains_todo_markers(self) -> None:
        """gold_batch_summary_v column names are unverified — SQL must carry TODO markers."""
        assert "TODO" in get_batch_header_summary_spec(self._req()).sql

    def test_params_not_shared_between_requests(self) -> None:
        spec1 = get_batch_header_summary_spec(Trace2BatchHeaderRequest("MAT1", "B1"))
        spec2 = get_batch_header_summary_spec(Trace2BatchHeaderRequest("MAT2", "B2"))
        spec1.params["injected"] = "x"
        assert "injected" not in spec2.params


# ---------------------------------------------------------------------------
# TestMapBatchHeaderRows
# ---------------------------------------------------------------------------

class TestMapBatchHeaderRows:
    def test_full_row_maps_required_fields(self) -> None:
        result = map_batch_header_rows([_FULL_BATCH_HEADER_ROW])
        assert result is not None
        assert result["materialId"] == "0000020582002"
        assert result["materialDescription"] == "Full Cream Milk Powder"
        assert result["batchId"] == "BATCH001"
        assert result["plantId"] == "IE01"
        assert result["plantName"] == "Listowel"

    def test_leading_zeros_preserved_in_material_id(self) -> None:
        row = {**_FULL_BATCH_HEADER_ROW, "material_id": "0000020582002"}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["materialId"] == "0000020582002"

    def test_optional_fields_present_when_supplied(self) -> None:
        result = map_batch_header_rows([_FULL_BATCH_HEADER_ROW])
        assert result is not None
        assert result["quantity"] == 100.0
        assert result["uom"] == "KG"
        assert result["manufactureDate"] == "2024-03-01T00:00:00Z"
        assert result["expiryDate"] == "2025-03-01T00:00:00Z"
        assert result["processOrderId"] == "PO100001"

    def test_missing_expiry_date_absent_from_result(self) -> None:
        row = {k: v for k, v in _FULL_BATCH_HEADER_ROW.items() if k != "expiry_date"}
        result = map_batch_header_rows([row])
        assert result is not None
        assert "expiryDate" not in result

    def test_missing_process_order_id_absent_from_result(self) -> None:
        row = {**_FULL_BATCH_HEADER_ROW, "process_order_id": None}
        result = map_batch_header_rows([row])
        assert result is not None
        assert "processOrderId" not in result

    def test_empty_rows_returns_none(self) -> None:
        assert map_batch_header_rows([]) is None

    def test_stock_status_priority_blocked_wins(self) -> None:
        row = {**_FULL_BATCH_HEADER_ROW, "blocked": 10.0, "quality_inspection": 5.0,
               "restricted": 3.0, "transit": 2.0}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["stockStatus"] == "blocked"

    def test_stock_status_quality_inspection_over_returns_and_transit(self) -> None:
        row = {**_FULL_BATCH_HEADER_ROW, "blocked": 0.0, "quality_inspection": 5.0,
               "restricted": 3.0, "transit": 2.0}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["stockStatus"] == "quality-inspection"

    def test_stock_status_returns_over_transit(self) -> None:
        row = {**_FULL_BATCH_HEADER_ROW, "blocked": 0.0, "quality_inspection": 0.0,
               "restricted": 3.0, "transit": 2.0}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["stockStatus"] == "returns"

    def test_stock_status_transit_when_only_transit_nonzero(self) -> None:
        row = {**_FULL_BATCH_HEADER_ROW, "blocked": 0.0, "quality_inspection": 0.0,
               "restricted": 0.0, "transit": 2.0, "unrestricted": 0.0}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["stockStatus"] == "transit"

    def test_stock_status_unrestricted_when_all_zero(self) -> None:
        row = {**_FULL_BATCH_HEADER_ROW, "blocked": 0.0, "quality_inspection": 0.0,
               "restricted": 0.0, "transit": 0.0}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["stockStatus"] == "unrestricted"

    def test_quality_status_pending_when_qi_stock_nonzero(self) -> None:
        row = {**_FULL_BATCH_HEADER_ROW, "quality_inspection": 5.0}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["qualityStatus"] == "pending"

    def test_quality_status_not_applicable_when_no_qi_stock(self) -> None:
        result = map_batch_header_rows([_FULL_BATCH_HEADER_ROW])
        assert result is not None
        assert result["qualityStatus"] == "not-applicable"

    def test_batch_status_maps_released_to_active(self) -> None:
        row = {**_FULL_BATCH_HEADER_ROW, "batch_status": "RELEASED"}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["batchStatus"] == "active"

    def test_batch_status_maps_blocked(self) -> None:
        row = {**_FULL_BATCH_HEADER_ROW, "batch_status": "BLOCKED"}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["batchStatus"] == "blocked"

    def test_batch_status_maps_numeric_two_to_blocked(self) -> None:
        """SAP batch status code '2' = blocked."""
        row = {**_FULL_BATCH_HEADER_ROW, "batch_status": "2"}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["batchStatus"] == "blocked"

    def test_batch_status_none_defaults_to_active(self) -> None:
        row = {**_FULL_BATCH_HEADER_ROW, "batch_status": None}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["batchStatus"] == "active"


# ---------------------------------------------------------------------------
# TestGetTraceGraphSpec
# ---------------------------------------------------------------------------

class TestGetTraceGraphSpec:
    def _req(self) -> Trace2TraceGraphRequest:
        return Trace2TraceGraphRequest("MAT001", "BATCH_ROOT")

    def test_name(self) -> None:
        assert get_trace_graph_spec(self._req()).name == "trace2.get_trace_graph"

    def test_module(self) -> None:
        assert get_trace_graph_spec(self._req()).module == "trace2"

    def test_endpoint(self) -> None:
        assert get_trace_graph_spec(self._req()).endpoint == "/api/trace2/trace-graph"

    def test_cache_policy_is_per_user(self) -> None:
        assert get_trace_graph_spec(self._req()).cache_policy == CacheTier.PER_USER_60S

    def test_source_badge_is_gold_batch_lineage(self) -> None:
        assert get_trace_graph_spec(self._req()).source_badge == "view:gold_batch_lineage"

    def test_max_rows_is_500(self) -> None:
        assert get_trace_graph_spec(self._req()).max_rows == 500

    def test_tags(self) -> None:
        spec = get_trace_graph_spec(self._req())
        assert "trace2" in spec.tags
        assert "trace-graph" in spec.tags
        assert "lineage" in spec.tags

    def test_params_contain_material_and_batch_id(self) -> None:
        spec = get_trace_graph_spec(self._req())
        assert spec.params["material_id"] == "MAT001"
        assert spec.params["batch_id"] == "BATCH_ROOT"

    def test_sql_references_gold_batch_lineage(self) -> None:
        assert "gold_batch_lineage" in get_trace_graph_spec(self._req()).sql

    def test_sql_has_limit(self) -> None:
        assert "LIMIT :max_rows" in get_trace_graph_spec(self._req()).sql

    def test_sql_contains_todo_markers(self) -> None:
        assert "TODO" in get_trace_graph_spec(self._req()).sql


# ---------------------------------------------------------------------------
# TestMapTraceGraphRows
# ---------------------------------------------------------------------------

class TestMapTraceGraphRows:
    def test_single_lineage_row_produces_two_nodes_one_edge(self) -> None:
        result = map_trace_graph_rows([_LINEAGE_ROW_A_TO_B], root_batch="BATCH_A")
        assert len(result["nodes"]) == 2
        assert len(result["edges"]) == 1

    def test_node_ids_use_material_and_batch(self) -> None:
        result = map_trace_graph_rows([_LINEAGE_ROW_A_TO_B], root_batch="BATCH_A")
        node_ids = {n["id"] for n in result["nodes"]}
        assert "MAT_A:BATCH_A" in node_ids
        assert "MAT_B:BATCH_B" in node_ids

    def test_edge_relationship_type_production(self) -> None:
        result = map_trace_graph_rows([_LINEAGE_ROW_A_TO_B], root_batch="BATCH_A")
        assert result["edges"][0]["relationshipType"] == "produced-from"

    def test_edge_source_and_target(self) -> None:
        result = map_trace_graph_rows([_LINEAGE_ROW_A_TO_B], root_batch="BATCH_A")
        edge = result["edges"][0]
        assert edge["source"] == "MAT_A:BATCH_A"
        assert edge["target"] == "MAT_B:BATCH_B"

    def test_graph_meta_fields(self) -> None:
        result = map_trace_graph_rows([_LINEAGE_ROW_A_TO_B], root_batch="BATCH_A")
        assert result["direction"] == "both"
        assert result["depth"] == 1
        assert result["rootBatch"] == "BATCH_A"
        assert result["unresolvedNodeCount"] == 0

    def test_duplicate_rows_produce_single_node(self) -> None:
        result = map_trace_graph_rows(
            [_LINEAGE_ROW_A_TO_B, _LINEAGE_ROW_A_TO_B], root_batch="BATCH_A"
        )
        assert len(result["nodes"]) == 2
        assert len(result["edges"]) == 1

    def test_empty_rows_returns_empty_graph_state(self) -> None:
        result = map_trace_graph_rows([], root_batch="BATCH_ROOT")
        assert result["nodes"] == []
        assert result["edges"] == []
        assert result["direction"] == "both"
        assert result["depth"] == 1
        assert result["rootBatch"] == "BATCH_ROOT"
        assert result["upstreamCount"] == 0
        assert result["downstreamCount"] == 0
        assert result["unresolvedNodeCount"] == 0

    def test_unknown_link_type_maps_to_component_of(self) -> None:
        row = {**_LINEAGE_ROW_A_TO_B, "link_type": "UNKNOWN_TYPE"}
        result = map_trace_graph_rows([row], root_batch="BATCH_A")
        assert result["edges"][0]["relationshipType"] == "component-of"

    def test_none_link_type_maps_to_component_of(self) -> None:
        row = {**_LINEAGE_ROW_A_TO_B, "link_type": None}
        result = map_trace_graph_rows([row], root_batch="BATCH_A")
        assert result["edges"][0]["relationshipType"] == "component-of"

    def test_all_link_type_mappings(self) -> None:
        mappings = [
            ("PRODUCTION", "produced-from"),
            ("BATCH_TRANSFER", "transferred-to"),
            ("STO_TRANSFER", "transferred-to"),
            ("VENDOR_RECEIPT", "component-of"),
            ("CONSUMPTION", "component-of"),
            ("DELIVERY", "delivered-to"),
            ("SPLIT", "split-from"),
            ("MERGE", "merged-into"),
        ]
        for raw, expected in mappings:
            row = {**_LINEAGE_ROW_A_TO_B, "link_type": raw}
            result = map_trace_graph_rows([row], root_batch="BATCH_A")
            assert result["edges"][0]["relationshipType"] == expected, f"Failed for {raw!r}"

    def test_upstream_count_when_root_is_child(self) -> None:
        row = {**_LINEAGE_ROW_A_TO_B, "child_batch_id": "ROOT", "child_material_id": "MAT_ROOT"}
        result = map_trace_graph_rows([row], root_batch="ROOT")
        assert result["upstreamCount"] == 1
        assert result["downstreamCount"] == 0

    def test_downstream_count_when_root_is_parent(self) -> None:
        row = {**_LINEAGE_ROW_A_TO_B, "parent_batch_id": "ROOT", "parent_material_id": "MAT_ROOT"}
        result = map_trace_graph_rows([row], root_batch="ROOT")
        assert result["upstreamCount"] == 0
        assert result["downstreamCount"] == 1

    def test_root_in_both_parent_and_child_rows_counts_both(self) -> None:
        """Root as parent of B (downstream) and child of C (upstream)."""
        row_root_as_parent = {**_LINEAGE_ROW_A_TO_B,
                              "parent_batch_id": "ROOT", "parent_material_id": "MAT_ROOT",
                              "child_batch_id": "BATCH_B", "child_material_id": "MAT_B"}
        row_root_as_child = {**_LINEAGE_ROW_A_TO_B,
                             "parent_batch_id": "BATCH_C", "parent_material_id": "MAT_C",
                             "child_batch_id": "ROOT", "child_material_id": "MAT_ROOT"}
        result = map_trace_graph_rows([row_root_as_parent, row_root_as_child], root_batch="ROOT")
        assert result["upstreamCount"] == 1
        assert result["downstreamCount"] == 1

    def test_cycle_like_input_does_not_crash(self) -> None:
        """Row A→B and row B→A should produce 2 nodes and 2 edges without error."""
        row_a_to_b = _LINEAGE_ROW_A_TO_B
        row_b_to_a = {
            "parent_material_id": "MAT_B",
            "parent_batch_id": "BATCH_B",
            "parent_plant_id": "IE01",
            "child_material_id": "MAT_A",
            "child_batch_id": "BATCH_A",
            "child_plant_id": "IE01",
            "link_type": "PRODUCTION",
            "parent_material_name": "Material B",
            "child_material_name": "Material A",
            "parent_plant_name": "Listowel",
            "child_plant_name": "Listowel",
        }
        result = map_trace_graph_rows([row_a_to_b, row_b_to_a], root_batch="BATCH_A")
        assert len(result["nodes"]) == 2
        assert len(result["edges"]) == 2

    def test_node_type_defaults_to_intermediate(self) -> None:
        result = map_trace_graph_rows([_LINEAGE_ROW_A_TO_B], root_batch="BATCH_A")
        for node in result["nodes"]:
            assert node["type"] == "intermediate"

    def test_material_description_empty_string_when_name_absent(self) -> None:
        row = {**_LINEAGE_ROW_A_TO_B, "parent_material_name": None, "child_material_name": None}
        result = map_trace_graph_rows([row], root_batch="BATCH_A")
        for node in result["nodes"]:
            assert node["materialDescription"] == ""


# ---------------------------------------------------------------------------
# TestGetMassBalanceSpec
# ---------------------------------------------------------------------------

class TestGetMassBalanceSpec:
    def _req(self) -> Trace2MassBalanceRequest:
        return Trace2MassBalanceRequest("MAT001", "BATCH001")

    def test_name(self) -> None:
        assert get_mass_balance_spec(self._req()).name == "trace2.get_mass_balance"

    def test_module(self) -> None:
        assert get_mass_balance_spec(self._req()).module == "trace2"

    def test_endpoint(self) -> None:
        assert get_mass_balance_spec(self._req()).endpoint == "/api/trace2/mass-balance"

    def test_cache_policy_is_per_user(self) -> None:
        assert get_mass_balance_spec(self._req()).cache_policy == CacheTier.PER_USER_60S

    def test_source_badge_is_gold_batch_mass_balance_v(self) -> None:
        assert get_mass_balance_spec(self._req()).source_badge == "view:gold_batch_mass_balance_v"

    def test_tags(self) -> None:
        spec = get_mass_balance_spec(self._req())
        assert "trace2" in spec.tags
        assert "mass-balance" in spec.tags

    def test_sql_references_gold_batch_mass_balance_v(self) -> None:
        assert "gold_batch_mass_balance_v" in get_mass_balance_spec(self._req()).sql

    def test_sql_has_order_by_posting_date(self) -> None:
        assert "ORDER BY posting_date" in get_mass_balance_spec(self._req()).sql

    def test_sql_has_limit(self) -> None:
        assert "LIMIT :max_rows" in get_mass_balance_spec(self._req()).sql

    def test_sql_contains_todo_markers(self) -> None:
        """WHERE column names in gold_batch_mass_balance_v are unverified."""
        assert "TODO" in get_mass_balance_spec(self._req()).sql


# ---------------------------------------------------------------------------
# TestMapMassBalanceRows
# ---------------------------------------------------------------------------

class TestMapMassBalanceRows:
    def _production_row(self, abs_qty: float = 500.0, balance: float = 500.0) -> dict:
        return {
            "posting_date": "2024-03-01",
            "movement_type": "101",
            "movement_category": "PRODUCTION",
            "abs_quantity": abs_qty,
            "uom": "KG",
            "balance_qty": balance,
        }

    def _shipment_row(self, abs_qty: float = 200.0, balance: float = 300.0) -> dict:
        return {
            "posting_date": "2024-03-02",
            "movement_type": "601",
            "movement_category": "SHIPMENT",
            "abs_quantity": abs_qty,
            "uom": "KG",
            "balance_qty": balance,
        }

    def test_empty_rows_returns_zero_totals(self) -> None:
        result = map_mass_balance_rows([])
        assert result["inputQuantity"] == 0.0
        assert result["outputQuantity"] == 0.0
        assert result["varianceQuantity"] == 0.0
        assert result["variancePercent"] == 0.0
        assert result["uom"] == ""
        assert result["unresolvedMovements"] == 0
        assert result["movements"] == []

    def test_input_quantity_sums_production_rows(self) -> None:
        rows = [self._production_row(500.0, 500.0), self._production_row(100.0, 600.0)]
        result = map_mass_balance_rows(rows)
        assert result["inputQuantity"] == 600.0

    def test_output_quantity_sums_shipment_and_consumption(self) -> None:
        rows = [
            self._production_row(500.0, 500.0),
            self._shipment_row(200.0, 300.0),
            {"posting_date": "2024-03-03", "movement_type": "261",
             "movement_category": "CONSUMPTION", "abs_quantity": 50.0,
             "uom": "KG", "balance_qty": 250.0},
        ]
        result = map_mass_balance_rows(rows)
        assert result["outputQuantity"] == 250.0

    def test_variance_quantity_is_input_minus_output(self) -> None:
        rows = [self._production_row(500.0, 500.0), self._shipment_row(200.0, 300.0)]
        result = map_mass_balance_rows(rows)
        assert result["varianceQuantity"] == pytest.approx(300.0)

    def test_variance_percent_computed_correctly(self) -> None:
        rows = [self._production_row(500.0, 500.0), self._shipment_row(400.0, 100.0)]
        result = map_mass_balance_rows(rows)
        assert result["variancePercent"] == pytest.approx(20.0)

    def test_variance_percent_zero_when_no_input(self) -> None:
        rows = [self._shipment_row(200.0, 0.0)]
        result = map_mass_balance_rows(rows)
        assert result["variancePercent"] == 0.0

    def test_balance_qty_maps_to_running_balance(self) -> None:
        """balance_qty is the confirmed running-balance column — direct mapping required."""
        rows = [self._production_row(500.0, 500.0), self._shipment_row(200.0, 300.0)]
        result = map_mass_balance_rows(rows)
        assert result["movements"][0]["runningBalance"] == 500.0
        assert result["movements"][1]["runningBalance"] == 300.0

    def test_abs_quantity_maps_to_quantity(self) -> None:
        rows = [self._production_row(500.0, 500.0)]
        result = map_mass_balance_rows(rows)
        assert result["movements"][0]["quantity"] == 500.0

    def test_production_delta_is_positive(self) -> None:
        rows = [self._production_row(500.0, 500.0)]
        result = map_mass_balance_rows(rows)
        assert result["movements"][0]["delta"] == pytest.approx(500.0)

    def test_shipment_delta_is_negative(self) -> None:
        rows = [self._shipment_row(200.0, 300.0)]
        result = map_mass_balance_rows(rows)
        assert result["movements"][0]["delta"] == pytest.approx(-200.0)

    def test_uom_taken_from_first_row(self) -> None:
        rows = [self._production_row(), self._shipment_row()]
        result = map_mass_balance_rows(rows)
        assert result["uom"] == "KG"

    def test_confidence_is_one(self) -> None:
        assert map_mass_balance_rows([self._production_row()])["confidence"] == 1.0

    def test_null_balance_qty_increments_unresolved(self) -> None:
        row = {**self._production_row(), "balance_qty": None}
        result = map_mass_balance_rows([row])
        assert result["unresolvedMovements"] == 1

    def test_null_balance_qty_defaults_running_balance_to_zero(self) -> None:
        row = {**self._production_row(), "balance_qty": None}
        result = map_mass_balance_rows([row])
        assert result["movements"][0]["runningBalance"] == 0.0

    def test_movement_category_mapping(self) -> None:
        categories = [
            ("PRODUCTION", "production"),
            ("SHIPMENT", "shipment"),
            ("CONSUMPTION", "consumption"),
            ("ADJUSTMENT", "adjustment"),
            ("UNKNOWN_CAT", "adjustment"),
        ]
        for raw, expected in categories:
            row = {**self._production_row(), "movement_category": raw}
            result = map_mass_balance_rows([row])
            assert result["movements"][0]["category"] == expected, f"Failed for {raw!r}"

    def test_movements_array_length_matches_row_count(self) -> None:
        rows = [self._production_row(), self._shipment_row(), self._production_row()]
        result = map_mass_balance_rows(rows)
        assert len(result["movements"]) == 3
