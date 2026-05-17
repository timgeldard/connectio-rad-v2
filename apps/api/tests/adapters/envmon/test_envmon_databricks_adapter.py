"""Tests for the EnvMon Databricks adapter — QuerySpec factory and row mapper.

Column names are confirmed-v1 (recovered from V1 ConnectIO-RAD source code and
entities.yaml, k.txt 2026-05-17). DDL not yet verified in connected_plant_uat.

Route NOT wired — DDL must be confirmed before route tests are added.
See docs/migration/envmon-site-summary-native-route-plan.md.
"""
import pytest

from adapters.envmon.envmon_databricks_adapter import (
    SiteSummaryRequest,
    get_site_summary_spec,
    map_site_summary_rows,
    _default_site_summary,
)
from shared.query_service.cache_policy import CacheTier
from shared.query_service.errors import DatabricksConfigError


# ---------------------------------------------------------------------------
# get_site_summary_spec
# ---------------------------------------------------------------------------

class TestGetSiteSummarySpec:
    @pytest.fixture(autouse=True)
    def _set_trace_catalog(self, monkeypatch):
        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("TRACE_SCHEMA", "gold")

    def _request(self) -> SiteSummaryRequest:
        return SiteSummaryRequest(
            plant_id="C061",
            period_start="2026-01-01",
            period_end="2026-05-17",
        )

    def test_name(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert spec.name == "envmon.get_site_summary"

    def test_module(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert spec.module == "envmon"

    def test_endpoint(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert spec.endpoint == "/api/envmon/site-summary"

    def test_cache_policy_is_per_user(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert spec.cache_policy == CacheTier.PER_USER_60S

    def test_source_badge(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert spec.source_badge == "databricks-api"

    def test_tags(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert "envmon" in spec.tags
        assert "site-summary" in spec.tags
        assert "kpi" in spec.tags

    def test_plant_id_in_params(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert spec.params["plant_id"] == "C061"

    def test_period_start_in_params(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert spec.params["period_start"] == "2026-01-01"

    def test_period_end_in_params(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert spec.params["period_end"] == "2026-05-17"

    def test_max_rows_not_in_params(self) -> None:
        """Aggregate query uses LIMIT 1 literal — max_rows must not be in params."""
        spec = get_site_summary_spec(self._request())
        assert "max_rows" not in spec.params

    def test_sql_uses_limit_1_not_param(self) -> None:
        """LIMIT must be literal 1, not :max_rows — aggregate returns one row by design."""
        spec = get_site_summary_spec(self._request())
        assert "LIMIT 1" in spec.sql
        assert "LIMIT :max_rows" not in spec.sql

    def test_sql_references_gold_inspection_lot(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert "gold_inspection_lot" in spec.sql

    def test_sql_references_gold_inspection_point(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert "gold_inspection_point" in spec.sql

    def test_sql_references_gold_batch_quality_result_v(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert "gold_batch_quality_result_v" in spec.sql

    def test_sql_uses_trace_catalog(self) -> None:
        """SQL must use catalog from TRACE_CATALOG env var."""
        spec = get_site_summary_spec(self._request())
        assert "`connected_plant_uat`" in spec.sql

    def test_sql_uses_trace_schema(self) -> None:
        """SQL must use schema from TRACE_SCHEMA env var."""
        spec = get_site_summary_spec(self._request())
        assert "`gold`" in spec.sql

    def test_sql_has_no_unqualified_from_gold_inspection_lot(self) -> None:
        """gold_inspection_lot must always be fully qualified — never bare FROM."""
        spec = get_site_summary_spec(self._request())
        assert "FROM gold_inspection_lot" not in spec.sql

    def test_sql_has_no_unqualified_from_gold_inspection_point(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert "FROM gold_inspection_point" not in spec.sql

    def test_sql_has_no_unqualified_from_result_v(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert "FROM gold_batch_quality_result_v" not in spec.sql

    def test_sql_has_inspection_type_filter(self) -> None:
        """EnvMon domain boundary filter must be present — confirmed-v1 from V1 em_config.py."""
        spec = get_site_summary_spec(self._request())
        assert "INSPECTION_TYPE" in spec.sql
        assert "IN" in spec.sql

    def test_sql_includes_14_inspection_type(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert "'14'" in spec.sql

    def test_sql_includes_z14_inspection_type(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert "'Z14'" in spec.sql

    def test_sql_has_plant_id_param_binding(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert ":plant_id" in spec.sql

    def test_sql_has_period_start_param_binding(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert ":period_start" in spec.sql

    def test_sql_has_period_end_param_binding(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert ":period_end" in spec.sql

    def test_sql_uses_functional_location_column(self) -> None:
        """FUNCTIONAL_LOCATION is the grouping key — confirmed-v1."""
        spec = get_site_summary_spec(self._request())
        assert "FUNCTIONAL_LOCATION" in spec.sql

    def test_sql_uses_inspection_result_valuation_column(self) -> None:
        """INSPECTION_RESULT_VALUATION drives fail/warn/pass classification."""
        spec = get_site_summary_spec(self._request())
        assert "INSPECTION_RESULT_VALUATION" in spec.sql

    def test_sql_uses_fail_valuations(self) -> None:
        """R, REJ, REJECT must all be in the fail classification CASE — confirmed-v1."""
        spec = get_site_summary_spec(self._request())
        assert "'R'" in spec.sql
        assert "'REJ'" in spec.sql
        assert "'REJECT'" in spec.sql

    def test_sql_uses_warn_valuations(self) -> None:
        """W and WARN must both be in the warning classification CASE — confirmed-v1."""
        spec = get_site_summary_spec(self._request())
        assert "'W'" in spec.sql
        assert "'WARN'" in spec.sql

    def test_two_requests_produce_independent_params(self) -> None:
        req1 = SiteSummaryRequest("C061", "2026-01-01", "2026-05-17")
        req2 = SiteSummaryRequest("IE01", "2025-01-01", "2025-12-31")
        spec1 = get_site_summary_spec(req1)
        spec2 = get_site_summary_spec(req2)
        assert spec1.params["plant_id"] != spec2.params["plant_id"]
        assert spec1.params["period_start"] != spec2.params["period_start"]

    def test_missing_trace_catalog_raises_config_error(self, monkeypatch) -> None:
        monkeypatch.delenv("TRACE_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError):
            get_site_summary_spec(self._request())


# ---------------------------------------------------------------------------
# map_site_summary_rows
# ---------------------------------------------------------------------------

class TestMapSiteSummaryRows:
    def _full_row(self) -> dict:
        """Aggregate row from get_site_summary_spec SQL (confirmed-v1 column aliases)."""
        return {
            "total_locs": 50,
            "active_fails": 3,
            "warnings": 2,
            "pending": 1,
            "pass_locs": 44,
            "lots_tested": 142,
        }

    def test_empty_rows_returns_default(self) -> None:
        result = map_site_summary_rows([], "C061")
        assert isinstance(result, dict)
        assert result["plantId"] == "C061"

    def test_default_has_zero_total_samples(self) -> None:
        result = map_site_summary_rows([], "C061")
        assert result["totalSamples"] == 0

    def test_default_has_zero_positive_samples(self) -> None:
        result = map_site_summary_rows([], "C061")
        assert result["positiveSamples"] == 0

    def test_default_has_zero_positive_rate(self) -> None:
        result = map_site_summary_rows([], "C061")
        assert result["positiveRate"] == 0.0

    def test_representative_row_maps_plant_id(self) -> None:
        result = map_site_summary_rows([self._full_row()], "C061")
        assert result["plantId"] == "C061"

    def test_representative_row_maps_total_samples_from_lots_tested(self) -> None:
        """totalSamples ← lots_tested (inspection lots = sampling events)."""
        result = map_site_summary_rows([self._full_row()], "C061")
        assert result["totalSamples"] == 142

    def test_representative_row_maps_positive_samples_from_active_fails(self) -> None:
        """positiveSamples ← active_fails (locations with ≥1 fail valuation)."""
        result = map_site_summary_rows([self._full_row()], "C061")
        assert result["positiveSamples"] == 3

    def test_positive_rate_calculated_as_fails_over_total_locs(self) -> None:
        """positiveRate = active_fails / total_locs (location-level, not sample-level)."""
        result = map_site_summary_rows([self._full_row()], "C061")
        assert result["positiveRate"] == pytest.approx(3 / 50, rel=1e-4)

    def test_positive_rate_rounded_to_4_decimal_places(self) -> None:
        row = {**self._full_row(), "total_locs": 3, "active_fails": 1}
        result = map_site_summary_rows([row], "C061")
        assert result["positiveRate"] == pytest.approx(round(1 / 3, 4), abs=1e-5)

    def test_zero_total_locs_gives_zero_positive_rate(self) -> None:
        row = {**self._full_row(), "total_locs": 0, "active_fails": 0}
        result = map_site_summary_rows([row], "C061")
        assert result["positiveRate"] == 0.0

    def test_uses_first_row_only(self) -> None:
        row1 = {**self._full_row(), "lots_tested": 100}
        row2 = {**self._full_row(), "lots_tested": 200}
        result = map_site_summary_rows([row1, row2], "C061")
        assert result["totalSamples"] == 100

    def test_none_values_in_row_coerced_to_zero(self) -> None:
        row = {**self._full_row(), "total_locs": None, "active_fails": None, "lots_tested": None}
        result = map_site_summary_rows([row], "C061")
        assert result["totalSamples"] == 0
        assert result["positiveSamples"] == 0
        assert result["positiveRate"] == 0.0

    # Placeholder field tests — these assert the placeholder values are present
    # and correctly labelled. They must NOT be removed when the route is wired;
    # they document that these fields are temporary placeholders, not business facts.

    def test_critical_zone_exposures_is_placeholder_zero(self) -> None:
        """criticalZoneExposures is 0 — PLACEHOLDER; requires em_location_zones join."""
        result = map_site_summary_rows([self._full_row()], "C061")
        assert result["criticalZoneExposures"] == 0

    def test_open_corrective_actions_is_placeholder_zero(self) -> None:
        """openCorrectiveActions is 0 — PLACEHOLDER; CAPA not present in V1 at all."""
        result = map_site_summary_rows([self._full_row()], "C061")
        assert result["openCorrectiveActions"] == 0

    def test_trend_direction_is_placeholder_stable(self) -> None:
        """trendDirection is 'stable' — PLACEHOLDER; period-over-period not implemented."""
        result = map_site_summary_rows([self._full_row()], "C061")
        assert result["trendDirection"] == "stable"

    def test_default_critical_zone_exposures_is_placeholder_zero(self) -> None:
        result = map_site_summary_rows([], "C061")
        assert result["criticalZoneExposures"] == 0

    def test_default_open_corrective_actions_is_placeholder_zero(self) -> None:
        result = map_site_summary_rows([], "C061")
        assert result["openCorrectiveActions"] == 0

    def test_default_trend_direction_is_placeholder_stable(self) -> None:
        result = map_site_summary_rows([], "C061")
        assert result["trendDirection"] == "stable"

    def test_plant_id_propagated_to_default(self) -> None:
        result = map_site_summary_rows([], "IE01")
        assert result["plantId"] == "IE01"


# ---------------------------------------------------------------------------
# _default_site_summary
# ---------------------------------------------------------------------------

class TestDefaultSiteSummary:
    def test_returns_dict(self) -> None:
        result = _default_site_summary("C061")
        assert isinstance(result, dict)

    def test_plant_id(self) -> None:
        result = _default_site_summary("C061")
        assert result["plantId"] == "C061"

    def test_total_samples_zero(self) -> None:
        result = _default_site_summary("C061")
        assert result["totalSamples"] == 0

    def test_positive_samples_zero(self) -> None:
        result = _default_site_summary("C061")
        assert result["positiveSamples"] == 0

    def test_positive_rate_zero(self) -> None:
        result = _default_site_summary("C061")
        assert result["positiveRate"] == 0.0

    def test_placeholder_fields_match_map_rows_default(self) -> None:
        """_default_site_summary and map_site_summary_rows([]) must produce identical shapes."""
        from_default = _default_site_summary("C061")
        from_mapper = map_site_summary_rows([], "C061")
        assert from_default == from_mapper
