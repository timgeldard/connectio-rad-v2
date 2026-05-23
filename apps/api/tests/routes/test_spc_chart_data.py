from __future__ import annotations

from unittest.mock import AsyncMock, patch
import httpx
import pytest
from httpx import ASGITransport

from main import app

def _make_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test")

_HEADERS_WITH_TOKEN = {
    "x-forwarded-access-token": "user-bearer-token",
    "x-forwarded-user": "user123",
    "x-forwarded-email": "user@example.com",
}

def _valid_payload(overrides=None):
    base = {
        "materialId": "20642328",
        "plantId": "P523",
        "micId": "0010",
        "operationId": "00000004",
        "dateFrom": "2025-01-01",
        "dateTo": "2025-12-31"
    }
    if overrides:
        base.update(overrides)
    return base

def _databricks_env(monkeypatch):
    monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
    monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
    monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
    monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
    monkeypatch.setenv("TRACE_SCHEMA", "gold")
    monkeypatch.setenv("SPC_CATALOG", "connected_plant_uat")
    monkeypatch.setenv("SPC_SCHEMA", "gold")

class TestSpcChartDataValidation:
    async def test_missing_operation_id_returns_422(self, monkeypatch):
        _databricks_env(monkeypatch)
        payload = _valid_payload({"operationId": ""})
        async with _make_client() as client:
            response = await client.post("/api/spc/chart-data", json=payload, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_missing_date_from_returns_422(self, monkeypatch):
        _databricks_env(monkeypatch)
        payload = _valid_payload({"dateFrom": ""})
        async with _make_client() as client:
            response = await client.post("/api/spc/chart-data", json=payload, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_missing_date_to_returns_422(self, monkeypatch):
        _databricks_env(monkeypatch)
        payload = _valid_payload({"dateTo": ""})
        async with _make_client() as client:
            response = await client.post("/api/spc/chart-data", json=payload, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_blank_material_id_returns_422(self, monkeypatch):
        _databricks_env(monkeypatch)
        payload = _valid_payload({"materialId": ""})
        async with _make_client() as client:
            response = await client.post("/api/spc/chart-data", json=payload, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_date_from_after_date_to_returns_422(self, monkeypatch):
        _databricks_env(monkeypatch)
        payload = _valid_payload({"dateFrom": "2025-12-31", "dateTo": "2025-01-01"})
        async with _make_client() as client:
            response = await client.post("/api/spc/chart-data", json=payload, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_date_window_exceeds_730_days_returns_422(self, monkeypatch):
        _databricks_env(monkeypatch)
        payload = _valid_payload({"dateFrom": "2020-01-01", "dateTo": "2026-12-31"})
        async with _make_client() as client:
            response = await client.post("/api/spc/chart-data", json=payload, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_p999_returns_422(self, monkeypatch):
        _databricks_env(monkeypatch)
        payload = _valid_payload({"plantId": "P999"})
        async with _make_client() as client:
            response = await client.post("/api/spc/chart-data", json=payload, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422
        
    async def test_max_rows_over_200_fails_validation(self, monkeypatch):
        _databricks_env(monkeypatch)
        payload = _valid_payload({"maxRows": 201})
        async with _make_client() as client:
            response = await client.post("/api/spc/chart-data", json=payload, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

class TestSpcChartDataQuerySafety:
    async def test_query_spec_params(self, monkeypatch):
        _databricks_env(monkeypatch)
        payload = _valid_payload()
        
        async def _mock(spec, identity):
            # Assert query safety fields are present in the spec params
            assert "material_id" in spec.params
            assert "plant_id" in spec.params
            assert "mic_id" in spec.params
            assert "operation_id" in spec.params
            return []
            
        with patch("shared.query_service.query_executor.QueryExecutor.execute", _mock):
            async with _make_client() as client:
                response = await client.post("/api/spc/chart-data", json=payload, headers=_HEADERS_WITH_TOKEN)
                
        # Since rows returned are empty, response is generated safely
        assert response.status_code == 200

class TestSpcChartDataLockedLimitsSemantics:
    async def test_locked_limits_warning_and_approval(self, monkeypatch):
        _databricks_env(monkeypatch)
        payload = _valid_payload()
        
        # We need to simulate the execution of two queries: subgroups and limits
        call_count = 0
        async def _mock(spec, identity):
            nonlocal call_count
            call_count += 1
            if "locked_limits" in spec.name:
                return [{
                    "cl": 10.0, "ucl": 12.0, "lcl": 8.0, 
                    "ucl_r": None, "lcl_r": None, "sigma_within": None,
                    "locked_by": "user1", "locked_at": "2025-01-01T00:00:00Z",
                    "baseline_from": "2024-01-01", "baseline_to": "2024-12-31",
                    "locking_note": "governance approval pending"
                }]
            return []
            
        with patch("shared.query_service.query_executor.QueryExecutor.execute", _mock):
            async with _make_client() as client:
                response = await client.post("/api/spc/chart-data", json=payload, headers=_HEADERS_WITH_TOKEN)
                
        assert response.status_code == 200
        data = response.json()
        assert data["controlLimits"]["lockedLimits"] is True
        assert data["controlLimits"]["lockedBy"] == "user1"
        assert data["controlLimits"]["approvalState"] == "pending-validation"
        assert data["controlLimits"]["limitProvenance"] == "unknown"
        assert len(data["warnings"]) == 1
        assert "locked_by is not treated as approval" in data["warnings"][0]

class TestSpcChartDataGuardrails:
    async def test_capability_and_signals_guardrails(self, monkeypatch):
        _databricks_env(monkeypatch)
        payload = _valid_payload()
        
        async def _mock(spec, identity):
            return []
            
        with patch("shared.query_service.query_executor.QueryExecutor.execute", _mock):
            async with _make_client() as client:
                response = await client.post("/api/spc/chart-data", json=payload, headers=_HEADERS_WITH_TOKEN)
                
        assert response.status_code == 200
        data = response.json()
        
        # Capability guardrails
        assert data["capabilitySource"] == "unavailable"
        assert "cp" not in data
        assert "cpk" not in data
        
        # Signals guardrails
        assert data["signalsSource"] == "calculated-frontend"
        assert "status" not in data
        # No backend in-control decisions
        for pt in data["chartSeries"]:
            assert "status" not in pt
