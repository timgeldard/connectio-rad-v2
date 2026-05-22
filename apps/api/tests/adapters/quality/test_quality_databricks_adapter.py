import pytest

from adapters.quality.quality_databricks_adapter import (
    get_quality_usage_decision_spec,
    map_quality_usage_decision_rows,
    QualityUsageDecisionQuerySpec,
)

def test_get_quality_usage_decision_spec():
    spec = get_quality_usage_decision_spec(material_id="123", batch_id="456", plant_id="P1")
    assert isinstance(spec, QualityUsageDecisionQuerySpec)
    assert spec.material_id == "123"
    assert spec.batch_id == "456"
    assert spec.plant_id == "P1"
    assert "udr.MATERIAL_ID = :material_id" in spec.sql
    assert "udr.BATCH_ID = :batch_id" in spec.sql
    assert "udr.PLANT_ID = :plant_id" in spec.sql

def test_map_quality_usage_decision_rows_empty():
    lots, summary = map_quality_usage_decision_rows([], "2026-05-22T00:00:00Z")
    assert len(lots) == 0
    assert summary.status == "no-records"
    assert summary.usage_decision_status == "not-found"
    assert summary.inspection_lot_count == 0
    assert summary.missing_lot_warning is not None
    assert summary.multiple_lots_warning is None

def test_map_quality_usage_decision_rows_single_lot():
    rows = [
        {
            "INSPECTION_LOT_ID": "100",
            "USAGE_DECISION_CODE": "A",
            "USAGE_DECISION_CREATED_DATE": "2026-05-22T00:00:00Z",
            "MATERIAL_ID": "123",
            "BATCH_ID": "456",
            "PLANT_ID": "P1",
            "PROCESS_ORDER_ID": "789"
        }
    ]
    lots, summary = map_quality_usage_decision_rows(rows, "2026-05-22T00:00:00Z")
    assert len(lots) == 1
    assert lots[0].inspection_lot_id == "100"
    assert lots[0].usage_decision_code == "A"
    assert lots[0].usage_decision_text == "Accepted"
    assert lots[0].usage_decision_created_at == "2026-05-22T00:00:00Z"
    
    assert summary.status == "loaded"
    assert summary.usage_decision_status == "source-present"
    assert summary.inspection_lot_count == 1
    assert summary.multiple_lots_warning is None

def test_map_quality_usage_decision_rows_multiple_lots():
    rows = [
        {
            "INSPECTION_LOT_ID": "100",
            "USAGE_DECISION_CODE": "R",
        },
        {
            "INSPECTION_LOT_ID": "101",
            "USAGE_DECISION_CODE": "A",
        }
    ]
    lots, summary = map_quality_usage_decision_rows(rows, "2026-05-22T00:00:00Z")
    assert len(lots) == 2
    assert lots[0].usage_decision_code == "R"
    assert lots[0].usage_decision_text == "Rejected"
    assert lots[1].usage_decision_code == "A"
    assert lots[1].usage_decision_text == "Accepted"
    
    assert summary.inspection_lot_count == 2
    assert summary.multiple_lots_warning is not None
    assert "Multiple inspection lots found" in summary.multiple_lots_warning

def test_map_quality_usage_decision_rows_empty_string_code():
    rows = [
        {
            "INSPECTION_LOT_ID": "102",
            "USAGE_DECISION_CODE": "",
        },
        {
            "INSPECTION_LOT_ID": "103",
            "USAGE_DECISION_CODE": None,
        }
    ]
    lots, summary = map_quality_usage_decision_rows(rows, "2026-05-22T00:00:00Z")
    assert len(lots) == 2
    assert lots[0].usage_decision_code == ""
    assert lots[0].usage_decision_text == "Pending — lot open, stock in QI, no decision taken"
    
    assert lots[1].usage_decision_code == ""
    assert lots[1].usage_decision_text == "Pending — lot open, stock in QI, no decision taken"
