"""Tests for the CQ Lab Databricks adapter — QuerySpec factory and row mapper."""
import pytest

from adapters.cq.cq_databricks_adapter import get_lab_plants_spec, map_lab_plants_rows
from shared.query_service.cache_policy import CacheTier


class TestGetLabPlantsSpec:
    def test_name(self) -> None:
        spec = get_lab_plants_spec()
        assert spec.name == "cq.get_lab_plants"

    def test_module(self) -> None:
        spec = get_lab_plants_spec()
        assert spec.module == "cq"

    def test_endpoint(self) -> None:
        spec = get_lab_plants_spec()
        assert spec.endpoint == "/api/cq/lab/plants"

    def test_cache_policy_is_global(self) -> None:
        """Lab plants is a slow-moving dimension — must use GLOBAL_300S."""
        spec = get_lab_plants_spec()
        assert spec.cache_policy == CacheTier.GLOBAL_300S

    def test_source_badge(self) -> None:
        spec = get_lab_plants_spec()
        assert spec.source_badge == "databricks-api"

    def test_tags(self) -> None:
        spec = get_lab_plants_spec()
        assert "cq" in spec.tags
        assert "lab" in spec.tags
        assert "plants" in spec.tags

    def test_params_is_empty(self) -> None:
        """getLabPlants takes no input parameters."""
        spec = get_lab_plants_spec()
        assert spec.params == {}

    def test_sql_references_gold_plant(self) -> None:
        spec = get_lab_plants_spec()
        assert "gold_plant" in spec.sql

    def test_sql_has_order_by_werks(self) -> None:
        spec = get_lab_plants_spec()
        assert "ORDER BY werks" in spec.sql

    def test_sql_has_limit(self) -> None:
        spec = get_lab_plants_spec()
        assert "LIMIT :max_rows" in spec.sql

    def test_sql_contains_todo_markers(self) -> None:
        """Column names are unverified — SQL must carry TODO markers until confirmed."""
        spec = get_lab_plants_spec()
        assert "TODO" in spec.sql

    def test_sql_selects_plant_id_alias(self) -> None:
        spec = get_lab_plants_spec()
        assert "plant_id" in spec.sql

    def test_sql_selects_plant_name_alias(self) -> None:
        spec = get_lab_plants_spec()
        assert "plant_name" in spec.sql

    def test_multiple_calls_return_equal_specs(self) -> None:
        spec1 = get_lab_plants_spec()
        spec2 = get_lab_plants_spec()
        assert spec1.name == spec2.name
        assert spec1.sql == spec2.sql
        assert spec1.params == spec2.params

    def test_params_not_shared_between_calls(self) -> None:
        """Mutable default guard: params dicts must not be the same object."""
        spec1 = get_lab_plants_spec()
        spec2 = get_lab_plants_spec()
        spec1.params["injected"] = "value"
        assert "injected" not in spec2.params


# ---------------------------------------------------------------------------
# map_lab_plants_rows
# ---------------------------------------------------------------------------

class TestMapLabPlantsRows:
    def test_returns_plants_key(self) -> None:
        result = map_lab_plants_rows([])
        assert "plants" in result

    def test_empty_rows_returns_empty_list(self) -> None:
        result = map_lab_plants_rows([])
        assert result == {"plants": []}

    def test_maps_plant_id_and_plant_name(self) -> None:
        rows = [{"plant_id": "IE01", "plant_name": "Kerry Charleville"}]
        result = map_lab_plants_rows(rows)
        assert result["plants"] == [{"plantId": "IE01", "plantName": "Kerry Charleville"}]

    def test_multiple_plants_preserved(self) -> None:
        rows = [
            {"plant_id": "IE01", "plant_name": "Charleville"},
            {"plant_id": "IE02", "plant_name": "Listowel"},
        ]
        result = map_lab_plants_rows(rows)
        assert len(result["plants"]) == 2
        assert result["plants"][0]["plantId"] == "IE01"
        assert result["plants"][1]["plantId"] == "IE02"

    def test_rows_without_plant_id_are_excluded(self) -> None:
        rows = [
            {"plant_id": "IE01", "plant_name": "Charleville"},
            {"plant_id": None, "plant_name": "Unknown"},
            {"plant_name": "No ID row"},
        ]
        result = map_lab_plants_rows(rows)
        assert len(result["plants"]) == 1
        assert result["plants"][0]["plantId"] == "IE01"

    def test_plant_name_none_becomes_empty_string(self) -> None:
        rows = [{"plant_id": "IE01", "plant_name": None}]
        result = map_lab_plants_rows(rows)
        assert result["plants"][0]["plantName"] == "None"

    def test_plant_id_is_string(self) -> None:
        rows = [{"plant_id": "IE01", "plant_name": "Test"}]
        result = map_lab_plants_rows(rows)
        assert isinstance(result["plants"][0]["plantId"], str)

    def test_integer_plant_id_converted_to_string(self) -> None:
        rows = [{"plant_id": 1001, "plant_name": "Test"}]
        result = map_lab_plants_rows(rows)
        assert result["plants"][0]["plantId"] == "1001"
