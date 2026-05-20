"""Tests for Trace Investigation Databricks adapter — QuerySpec factories and row mapping."""
import pytest

from adapters.trace2.trace2_databricks_adapter import (
    Trace2BatchHeaderRequest,
    Trace2MassBalanceRequest,
    TraceGraphRequest,
    get_batch_header_summary_spec,
    get_mass_balance_spec,
    get_trace_graph_recursive_spec,
    map_batch_header_rows,
    map_mass_balance_rows,
    map_trace_graph,
)
from shared.query_service.cache_policy import CacheTier
from shared.query_service.errors import DatabricksConfigError


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

# NOTE: batch_status and process_order_id are included here to test the mapper's handling
# when those keys are present (e.g. passed from a different source or future schema change).
# The live SQL query no longer selects them from gold_batch_summary_v — they were not found
# in that view during live validation (2026-05-19, connected_plant_uat).
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
    "parent_material_id": "000000000020052009",
    "parent_batch_id": "0008602411",
    "parent_plant_id": "C061",
    "parent_material_name": "Full Cream Milk Powder",
    "child_material_id": "MAT_B",
    "child_batch_id": "BATCH_B",
    "child_plant_id": "C061",
    "child_material_name": "Whole Milk Powder",
    "link_type": "PRODUCTION",
    "process_order_id": "PO-100001",
    "material_document_number": "4900012345",
    "purchase_order_id": None,
    "supplier_id": None,
    "customer_id": None,
    "delivery_id": None,
    "sales_order_id": None,
    "quantity": 500.0,
    "base_unit_of_measure": "KG",
    "posting_date": "2026-01-15",
    "movement_type": "261",
}

_ANCHOR_MATERIAL_ID = "000000000020052009"
_ANCHOR_BATCH_ID = "0008602411"
_ANCHOR_PLANT_ID = "C061"
_ANCHOR_KEY = f"{_ANCHOR_MATERIAL_ID}:{_ANCHOR_BATCH_ID}"


# ---------------------------------------------------------------------------
# TestGetBatchHeaderSummarySpec
# ---------------------------------------------------------------------------

class TestGetBatchHeaderSummarySpec:
    @pytest.fixture(autouse=True)
    def _set_trace_catalog(self, monkeypatch):
        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("TRACE_SCHEMA", "gold")

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

    def test_sql_uses_trace_catalog(self) -> None:
        assert "`connected_plant_uat`" in get_batch_header_summary_spec(self._req()).sql

    def test_sql_uses_gold_schema(self) -> None:
        assert "`gold`" in get_batch_header_summary_spec(self._req()).sql

    def test_sql_has_no_unqualified_from_gold_batch_stock_v(self) -> None:
        spec = get_batch_header_summary_spec(self._req())
        assert "FROM gold_batch_stock_v" not in spec.sql

    def test_sql_has_limit(self) -> None:
        assert "LIMIT :max_rows" in get_batch_header_summary_spec(self._req()).sql

    def test_sql_has_no_unverified_column_assumptions(self) -> None:
        """Column names verified 2026-05-19 against connected_plant_uat — SQL must not carry TODO markers."""
        assert "TODO" not in get_batch_header_summary_spec(self._req()).sql

    def test_sql_uses_shelf_life_expiration_date_not_expiry_date(self) -> None:
        """gold_batch_summary_v has SHELF_LIFE_EXPIRATION_DATE, not expiry_date."""
        sql = get_batch_header_summary_spec(self._req()).sql
        assert "SHELF_LIFE_EXPIRATION_DATE" in sql
        assert "b.expiry_date" not in sql

    def test_sql_sources_plant_id_from_stock_v_not_summary_v(self) -> None:
        """PLANT_ID not in gold_batch_summary_v — must be sourced from gold_batch_stock_v."""
        sql = get_batch_header_summary_spec(self._req()).sql
        assert "s.PLANT_ID" in sql
        assert "b.plant_id" not in sql

    def test_sql_sources_uom_from_material_not_summary_v(self) -> None:
        """UOM not in gold_batch_summary_v — must be sourced from gold_material.BASE_UNIT_OF_MEASURE."""
        sql = get_batch_header_summary_spec(self._req()).sql
        assert "BASE_UNIT_OF_MEASURE" in sql
        assert "b.uom" not in sql

    def test_sql_uses_language_id_e_not_en(self) -> None:
        """gold_material uses LANGUAGE_ID = 'E' for English — confirmed 2026-05-19."""
        sql = get_batch_header_summary_spec(self._req()).sql
        assert "LANGUAGE_ID = 'E'" in sql
        assert "'EN'" not in sql

    def test_sql_does_not_select_batch_status(self) -> None:
        """batch_status not present in gold_batch_summary_v — must not be selected."""
        sql = get_batch_header_summary_spec(self._req()).sql
        assert "b.batch_status" not in sql

    def test_missing_trace_catalog_raises_config_error(self, monkeypatch) -> None:
        monkeypatch.delenv("TRACE_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError):
            get_batch_header_summary_spec(self._req())

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

    def test_stock_bucket_quantities_surfaced(self) -> None:
        """Individual stock buckets now surfaced from gold_batch_stock_v (verified live 2026-05-19)."""
        row = {**_FULL_BATCH_HEADER_ROW, "unrestricted": 80.0, "blocked": 5.0,
               "quality_inspection": 15.0, "restricted": 2.0, "transit": 1.0}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["unrestricted"] == 80.0
        assert result["blocked"] == 5.0
        assert result["qualityInspection"] == 15.0
        assert result["restricted"] == 2.0
        assert result["transit"] == 1.0

    def test_stock_bucket_absent_when_null(self) -> None:
        """Null stock bucket → field absent from result, not zero (absence ≠ zero stock)."""
        row = {**_FULL_BATCH_HEADER_ROW, "unrestricted": None, "blocked": None,
               "quality_inspection": None, "restricted": None, "transit": None}
        result = map_batch_header_rows([row])
        assert result is not None
        assert "unrestricted" not in result
        assert "blocked" not in result
        assert "qualityInspection" not in result
        assert "restricted" not in result
        assert "transit" not in result

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

    def test_stock_status_restricted_over_transit(self) -> None:
        row = {**_FULL_BATCH_HEADER_ROW, "blocked": 0.0, "quality_inspection": 0.0,
               "restricted": 3.0, "transit": 2.0}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["stockStatus"] == "restricted"

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

    def test_quality_status_unknown_when_no_qi_stock(self) -> None:
        """No QI stock and no QM decision field → 'unknown', not 'not-applicable'.

        'not-applicable' would imply quality inspection does not apply to this batch.
        Without a verified QM usage decision field in the query, 'unknown' is correct.
        See _derive_quality_status docstring for full reasoning.
        """
        result = map_batch_header_rows([_FULL_BATCH_HEADER_ROW])
        assert result is not None
        assert result["qualityStatus"] == "unknown"

    def test_quality_status_unknown_when_qi_is_null(self) -> None:
        """Null quality_inspection (missing column) → 'unknown', not 'not-applicable'.

        The adapter must not interpret a missing QI field as confirmed quality acceptance.
        """
        row = {**_FULL_BATCH_HEADER_ROW, "quality_inspection": None}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["qualityStatus"] == "unknown"

    def test_quality_status_never_returns_accepted_or_rejected(self) -> None:
        """Prove accepted/rejected/conditional cannot be reached without QM decision evidence.

        _derive_quality_status is conservative by design: it reads QI stock quantity only,
        not a QM usage decision field. Until gold_qm_usage_decision_v (or equivalent) is
        verified in UAT and wired into the query, these values must not appear.
        """
        from adapters.trace2.trace2_databricks_adapter import _derive_quality_status
        blocked_values = {"accepted", "rejected", "conditional"}
        for qi_value in [0.0, None, 0, ""]:
            result = _derive_quality_status({**_FULL_BATCH_HEADER_ROW, "quality_inspection": qi_value})
            assert result not in blocked_values, (
                f"_derive_quality_status returned '{result}' for quality_inspection={qi_value!r} "
                "without a verified QM usage decision field — conservative mapping violated"
            )

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

    def test_batch_status_none_returns_unknown(self) -> None:
        """batch_status absent from gold_batch_summary_v — must return 'unknown', not 'active'.

        Returning 'active' for an unknown status would falsely signal release for blocked batches.
        'unknown' is the honest fallback; 'active' is a semantic regression (violates Gate 1.3).
        """
        row = {**_FULL_BATCH_HEADER_ROW, "batch_status": None}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["batchStatus"] == "unknown"


# ---------------------------------------------------------------------------
# TestGetTraceGraphRecursiveSpec
# ---------------------------------------------------------------------------

class TestGetTraceGraphRecursiveSpec:
    @pytest.fixture(autouse=True)
    def _set_trace_catalog(self, monkeypatch):
        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("TRACE_SCHEMA", "gold")

    def _req(self, direction: str = "both", max_depth: int = 3) -> TraceGraphRequest:
        return TraceGraphRequest(
            _ANCHOR_MATERIAL_ID, _ANCHOR_BATCH_ID, _ANCHOR_PLANT_ID,
            direction=direction, max_depth=max_depth,
        )

    def test_name(self) -> None:
        assert get_trace_graph_recursive_spec(self._req()).name == "trace2.get_trace_graph"

    def test_module(self) -> None:
        assert get_trace_graph_recursive_spec(self._req()).module == "trace2"

    def test_endpoint(self) -> None:
        assert get_trace_graph_recursive_spec(self._req()).endpoint == "/api/trace2/trace-graph"

    def test_cache_policy_is_per_user(self) -> None:
        assert get_trace_graph_recursive_spec(self._req()).cache_policy == CacheTier.PER_USER_60S

    def test_source_badge_is_gold_batch_lineage(self) -> None:
        assert get_trace_graph_recursive_spec(self._req()).source_badge == "view:gold_batch_lineage"

    def test_tags(self) -> None:
        spec = get_trace_graph_recursive_spec(self._req())
        assert "trace2" in spec.tags
        assert "trace-graph" in spec.tags
        assert "lineage" in spec.tags

    def test_params_contain_material_batch_max_depth_max_rows_no_plant(self) -> None:
        spec = get_trace_graph_recursive_spec(self._req(max_depth=5))
        assert spec.params["material_id"] == _ANCHOR_MATERIAL_ID
        assert spec.params["batch_id"] == _ANCHOR_BATCH_ID
        assert spec.params["max_depth"] == 5
        assert "max_rows" in spec.params
        assert "plant_id" not in spec.params

    def test_params_max_rows_equals_request_max_edges(self) -> None:
        req = TraceGraphRequest(
            _ANCHOR_MATERIAL_ID, _ANCHOR_BATCH_ID, _ANCHOR_PLANT_ID,
            direction="both", max_depth=3, max_edges=500,
        )
        spec = get_trace_graph_recursive_spec(req)
        assert spec.params["max_rows"] == 500

    def test_sql_has_limit_max_rows(self) -> None:
        """P0-4: SQL-level row cap must be present to bound recursive query output."""
        assert "LIMIT :max_rows" in get_trace_graph_recursive_spec(self._req()).sql

    def test_sql_has_limit_in_downstream_direction(self) -> None:
        sql = get_trace_graph_recursive_spec(self._req("downstream")).sql
        assert "LIMIT :max_rows" in sql

    def test_sql_has_limit_in_upstream_direction(self) -> None:
        sql = get_trace_graph_recursive_spec(self._req("upstream")).sql
        assert "LIMIT :max_rows" in sql

    def test_sql_contains_with_recursive(self) -> None:
        assert "WITH RECURSIVE" in get_trace_graph_recursive_spec(self._req()).sql

    def test_sql_references_gold_batch_lineage(self) -> None:
        assert "gold_batch_lineage" in get_trace_graph_recursive_spec(self._req()).sql

    def test_sql_uses_fully_qualified_table(self) -> None:
        sql = get_trace_graph_recursive_spec(self._req()).sql
        assert "`connected_plant_uat`" in sql
        assert "`gold`" in sql
        assert "FROM gold_batch_lineage" not in sql

    def test_sql_has_no_todo_markers(self) -> None:
        assert "TODO" not in get_trace_graph_recursive_spec(self._req()).sql

    def test_sql_includes_all_18_confirmed_columns(self) -> None:
        sql = get_trace_graph_recursive_spec(self._req()).sql
        for col in [
            "PARENT_MATERIAL_ID", "PARENT_BATCH_ID", "PARENT_PLANT_ID",
            "CHILD_MATERIAL_ID", "CHILD_BATCH_ID", "CHILD_PLANT_ID",
            "LINK_TYPE", "PROCESS_ORDER_ID", "MATERIAL_DOCUMENT_NUMBER",
            "PURCHASE_ORDER_ID", "SUPPLIER_ID", "CUSTOMER_ID", "DELIVERY_ID",
            "SALES_ORDER_ID", "QUANTITY", "BASE_UNIT_OF_MEASURE",
            "POSTING_DATE", "MOVEMENT_TYPE",
        ]:
            assert col in sql, f"Column {col} missing from recursive spec SQL"

    def test_sql_includes_hop_depth_and_traversal_dir(self) -> None:
        sql = get_trace_graph_recursive_spec(self._req()).sql
        assert "hop_depth" in sql
        assert "traversal_dir" in sql

    def test_downstream_sql_has_parent_anchor_where(self) -> None:
        sql = get_trace_graph_recursive_spec(self._req("downstream")).sql
        assert "PARENT_MATERIAL_ID = :material_id" in sql
        assert "PARENT_BATCH_ID = :batch_id" in sql

    def test_downstream_sql_does_not_have_child_anchor_where(self) -> None:
        sql = get_trace_graph_recursive_spec(self._req("downstream")).sql
        assert "CHILD_MATERIAL_ID = :material_id" not in sql

    def test_upstream_sql_has_child_anchor_where(self) -> None:
        sql = get_trace_graph_recursive_spec(self._req("upstream")).sql
        assert "CHILD_MATERIAL_ID = :material_id" in sql
        assert "CHILD_BATCH_ID = :batch_id" in sql

    def test_upstream_sql_does_not_have_parent_anchor_where(self) -> None:
        sql = get_trace_graph_recursive_spec(self._req("upstream")).sql
        assert "PARENT_MATERIAL_ID = :material_id" not in sql

    def test_both_sql_has_ds_and_us_ctes(self) -> None:
        sql = get_trace_graph_recursive_spec(self._req("both")).sql
        assert " ds " in sql or "\n  ds AS" in sql
        assert " us " in sql or "\n  us AS" in sql

    def test_both_sql_has_union_all(self) -> None:
        sql = get_trace_graph_recursive_spec(self._req("both")).sql
        assert "UNION ALL" in sql

    def test_sql_has_instr_cycle_guard(self) -> None:
        assert "INSTR" in get_trace_graph_recursive_spec(self._req()).sql

    def test_sql_joins_gold_material_for_material_names(self) -> None:
        sql = get_trace_graph_recursive_spec(self._req()).sql
        assert "gold_material" in sql
        assert "parent_material_name" in sql
        assert "child_material_name" in sql

    def test_sql_uses_language_id_param_not_hardcoded(self) -> None:
        spec = get_trace_graph_recursive_spec(self._req())
        assert "LANGUAGE_ID = :language_id" in spec.sql
        assert spec.params["language_id"] == "E"

    def test_missing_trace_catalog_raises_config_error(self, monkeypatch) -> None:
        monkeypatch.delenv("TRACE_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError):
            get_trace_graph_recursive_spec(self._req())


# ---------------------------------------------------------------------------
# TestMapTraceGraph
# ---------------------------------------------------------------------------

def _make_req(**kwargs) -> TraceGraphRequest:
    defaults = dict(
        material_id=_ANCHOR_MATERIAL_ID,
        batch_id=_ANCHOR_BATCH_ID,
        plant_id=_ANCHOR_PLANT_ID,
        direction="both",
        max_depth=6,
        max_edges=1000,
    )
    defaults.update(kwargs)
    return TraceGraphRequest(**defaults)


class TestMapTraceGraph:
    def test_empty_rows_returns_anchor_only_and_warning(self) -> None:
        result = map_trace_graph([], _make_req(), depth_reached=0, truncated=False)
        assert result["rootBatch"] == f"{_ANCHOR_MATERIAL_ID}/{_ANCHOR_BATCH_ID}"
        assert len(result["nodes"]) == 1
        anchor = result["nodes"][0]
        assert anchor["isAnchor"] is True
        assert anchor["materialId"] == _ANCHOR_MATERIAL_ID
        assert anchor["batchId"] == _ANCHOR_BATCH_ID
        assert anchor["id"] == _ANCHOR_KEY
        assert result["edges"] == []
        assert "no_edges_found" in result["warnings"]

    def test_single_downstream_row_gives_anchor_plus_child_plus_one_edge(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        assert len(result["nodes"]) == 2
        assert len(result["edges"]) == 1

    def test_anchor_node_is_marked_is_anchor(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        anchor_nodes = [n for n in result["nodes"] if n["isAnchor"]]
        assert len(anchor_nodes) == 1
        assert anchor_nodes[0]["id"] == _ANCHOR_KEY

    def test_anchor_directions_is_anchor_label(self) -> None:
        result = map_trace_graph([], _make_req(), depth_reached=0, truncated=False)
        assert result["nodes"][0]["directions"] == ["anchor"]

    def test_downstream_child_node_direction(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        child_node = next(n for n in result["nodes"] if not n["isAnchor"])
        assert child_node["directions"] == ["downstream"]

    def test_upstream_row_maps_parent_as_upstream(self) -> None:
        upstream_row = {
            **_LINEAGE_ROW_A_TO_B,
            "parent_material_id": "MAT_PARENT",
            "parent_batch_id": "BATCH_PARENT",
            "parent_plant_id": "C061",
            "child_material_id": _ANCHOR_MATERIAL_ID,
            "child_batch_id": _ANCHOR_BATCH_ID,
            "child_plant_id": _ANCHOR_PLANT_ID,
        }
        tagged = [(upstream_row, 0, "upstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        non_anchor = [n for n in result["nodes"] if not n["isAnchor"]]
        assert len(non_anchor) == 1
        assert non_anchor[0]["directions"] == ["upstream"]

    def test_node_key_is_material_and_batch_only(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        child = next(n for n in result["nodes"] if not n["isAnchor"])
        assert child["id"] == "MAT_B:BATCH_B"
        assert child["plantId"] == "C061"

    def test_duplicate_rows_produce_single_edge(self) -> None:
        tagged = [
            (_LINEAGE_ROW_A_TO_B, 0, "downstream"),
            (_LINEAGE_ROW_A_TO_B, 0, "downstream"),
        ]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        assert len(result["edges"]) == 1

    def test_leading_zeros_preserved_in_node_keys(self) -> None:
        result = map_trace_graph([], _make_req(), depth_reached=0, truncated=False)
        anchor_node = result["nodes"][0]
        assert anchor_node["materialId"] == "000000000020052009"
        assert anchor_node["batchId"] == "0008602411"

    def test_edge_preserves_quantity_and_uom(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        edge = result["edges"][0]
        assert edge["quantity"] == 500.0
        assert edge["uom"] == "KG"

    def test_edge_preserves_posting_date_and_movement_type(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        edge = result["edges"][0]
        assert edge["postingDate"] == "2026-01-15"
        assert edge["movementType"] == "261"

    def test_edge_preserves_process_order_and_doc_number(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        edge = result["edges"][0]
        assert edge["processOrderId"] == "PO-100001"
        assert edge["materialDocumentNumber"] == "4900012345"

    def test_null_optional_fields_handled_safely(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        edge = result["edges"][0]
        assert edge["supplierId"] is None
        assert edge["customerId"] is None
        assert edge["deliveryId"] is None
        assert edge["salesOrderId"] is None
        assert edge["purchaseOrderId"] is None

    def test_null_quantity_becomes_none_not_zero(self) -> None:
        row = {**_LINEAGE_ROW_A_TO_B, "quantity": None}
        tagged = [(row, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        assert result["edges"][0]["quantity"] is None

    def test_edge_has_source_and_target_keys(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        edge = result["edges"][0]
        assert edge["source"] == _ANCHOR_KEY
        assert edge["target"] == "MAT_B:BATCH_B"

    def test_truncated_true_adds_max_edges_warning(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=True)
        assert "max_edges_reached" in result["warnings"]
        assert result["truncated"] is True

    def test_depth_reached_equals_max_depth_adds_warning(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(
            tagged, _make_req(max_depth=1), depth_reached=1, truncated=False
        )
        assert "max_depth_reached" in result["warnings"]

    def test_depth_not_reached_no_warning(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(
            tagged, _make_req(max_depth=6), depth_reached=1, truncated=False
        )
        assert "max_depth_reached" not in result["warnings"]

    def test_depth_reached_in_response(self) -> None:
        result = map_trace_graph([], _make_req(), depth_reached=3, truncated=False)
        assert result["depth"] == 3

    def test_response_has_required_top_level_keys(self) -> None:
        result = map_trace_graph([], _make_req(), depth_reached=0, truncated=False)
        for key in ("nodes", "edges", "depth", "rootBatch", "upstreamCount", "downstreamCount",
                    "unresolvedNodeCount", "truncated", "warnings"):
            assert key in result, f"Missing key: {key}"

    def test_material_description_on_child_node(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        child = next(n for n in result["nodes"] if not n["isAnchor"])
        assert child["materialDescription"] == "Whole Milk Powder"

    def test_material_description_enriched_on_anchor_when_it_appears_as_parent(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        anchor = next(n for n in result["nodes"] if n["isAnchor"])
        assert anchor["materialDescription"] == "Full Cream Milk Powder"

    def test_material_description_absent_when_null_in_row(self) -> None:
        row = {**_LINEAGE_ROW_A_TO_B, "child_material_name": None}
        tagged = [(row, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        child = next(n for n in result["nodes"] if not n["isAnchor"])
        assert child["materialDescription"] == ""

    def test_vendor_supplier_fields_preserved_on_edge(self) -> None:
        row = {
            **_LINEAGE_ROW_A_TO_B,
            "supplier_id": "SUPP-001",
            "customer_id": "CUST-001",
            "delivery_id": "DEL-001",
            "sales_order_id": "SO-001",
            "purchase_order_id": "PO-EXT-001",
        }
        tagged = [(row, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        edge = result["edges"][0]
        assert edge["supplierId"] == "SUPP-001"
        assert edge["customerId"] == "CUST-001"
        assert edge["deliveryId"] == "DEL-001"
        assert edge["salesOrderId"] == "SO-001"
        assert edge["purchaseOrderId"] == "PO-EXT-001"


# ---------------------------------------------------------------------------
# TestGetMassBalanceSpec
# ---------------------------------------------------------------------------

class TestGetMassBalanceSpec:
    @pytest.fixture(autouse=True)
    def _set_trace_catalog(self, monkeypatch):
        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("TRACE_SCHEMA", "gold")

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

    def test_sql_uses_trace_catalog(self) -> None:
        assert "`connected_plant_uat`" in get_mass_balance_spec(self._req()).sql

    def test_sql_has_no_unqualified_from_gold_batch_mass_balance_v(self) -> None:
        spec = get_mass_balance_spec(self._req())
        assert "FROM gold_batch_mass_balance_v" not in spec.sql

    def test_sql_has_order_by_posting_date(self) -> None:
        assert "ORDER BY posting_date" in get_mass_balance_spec(self._req()).sql

    def test_sql_has_limit(self) -> None:
        assert "LIMIT :max_rows" in get_mass_balance_spec(self._req()).sql

    def test_sql_contains_todo_markers(self) -> None:
        """WHERE column names in gold_batch_mass_balance_v are unverified."""
        assert "TODO" in get_mass_balance_spec(self._req()).sql

    def test_missing_trace_catalog_raises_config_error(self, monkeypatch) -> None:
        monkeypatch.delenv("TRACE_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError):
            get_mass_balance_spec(self._req())


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

    def test_confidence_empty_rows_is_one(self) -> None:
        # Vacuous case — no movements to assess, so confidence is 1.0.
        assert map_mass_balance_rows([])["confidence"] == 1.0

    def test_confidence_no_unresolved_is_one(self) -> None:
        rows = [self._production_row(), self._shipment_row()]
        assert map_mass_balance_rows(rows)["confidence"] == 1.0

    def test_confidence_partial_unresolved(self) -> None:
        # 1 of 4 rows has null balance_qty → confidence = 1 - 1/4 = 0.75
        rows = [
            {**self._production_row(), "balance_qty": None},
            self._production_row(),
            self._shipment_row(),
            self._production_row(),
        ]
        result = map_mass_balance_rows(rows)
        assert result["confidence"] == pytest.approx(0.75)
        assert result["unresolvedMovements"] == 1

    def test_confidence_all_unresolved_is_zero(self) -> None:
        rows = [
            {**self._production_row(), "balance_qty": None},
            {**self._shipment_row(), "balance_qty": None},
        ]
        result = map_mass_balance_rows(rows)
        assert result["confidence"] == 0.0
        assert result["unresolvedMovements"] == 2
