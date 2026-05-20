"""Route tests for POST /api/trace2/trace-graph — databricks-api mode only.

No legacy-api or mock fallback exists for trace-graph. Any mode other than
databricks-api returns 503.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx
import pytest
from httpx import ASGITransport

from main import app


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


_HEADERS_WITH_TOKEN = {
    "x-forwarded-access-token": "user-bearer-token",
    "x-forwarded-user": "user123",
    "x-forwarded-email": "user@example.com",
}

_URL = "/api/trace2/trace-graph"

_VALID_BODY = {
    "material_id": "000000000020052009",
    "batch_id": "0008602411",
    "plant_id": "C061",
    "direction": "both",
    "max_depth": 6,
    "max_edges": 1000,
}

# A single downstream edge row returned by the mocked executor (WITH RECURSIVE shape)
_FAKE_LINEAGE_ROW = {
    "hop_depth": 1,
    "traversal_dir": "downstream",
    "parent_material_id": "000000000020052009",
    "parent_batch_id": "0008602411",
    "parent_plant_id": "C061",
    "parent_material_name": "Full Cream Milk Powder",
    "child_material_id": "MAT_CHILD",
    "child_batch_id": "BATCH_CHILD",
    "child_plant_id": "C061",
    "child_material_name": "Skimmed Milk Powder",
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


def _patch_executor(return_value: list[dict]):
    """Patch the Databricks executor to return a fixed row list for every call."""
    return patch(
        "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
        new_callable=AsyncMock,
        return_value=return_value,
    )


def _databricks_env(monkeypatch) -> None:
    monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
    monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
    monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
    monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
    monkeypatch.setenv("TRACE_SCHEMA", "gold")


_BATCH_HEADER_URL = "/api/trace2/batch-header"

_BATCH_HEADER_BODY = {
    "material_id": "0000020582002",
    "batch_id": "BATCH001",
}

_FAKE_BATCH_HEADER_ROW = {
    "material_id": "0000020582002",
    "batch_id": "BATCH001",
    "material_name": "Full Cream Milk Powder",
    "plant_id": "IE01",
    "plant_name": "Listowel",
    "unrestricted": 100.0,
    "blocked": 0.0,
    "quality_inspection": 0.0,
    "restricted": 0.0,
    "transit": 0.0,
    "total_stock": 100.0,
    "uom": "KG",
    "manufacture_date": "2024-03-01T00:00:00Z",
    "expiry_date": "2025-03-01T00:00:00Z",
}


# ---------------------------------------------------------------------------
# Batch header — databricks-api mode
# ---------------------------------------------------------------------------

class TestBatchHeaderDatabricksMode:
    async def test_200_returns_batch_header(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_BATCH_HEADER_ROW]):
            async with _make_client() as client:
                response = await client.post(
                    _BATCH_HEADER_URL, json=_BATCH_HEADER_BODY, headers=_HEADERS_WITH_TOKEN
                )
        assert response.status_code == 200
        data = response.json()
        assert data["materialId"] == "0000020582002"
        assert data["materialDescription"] == "Full Cream Milk Powder"
        assert data["batchId"] == "BATCH001"
        assert data["plantId"] == "IE01"

    async def test_404_when_batch_not_found(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(
                    _BATCH_HEADER_URL, json=_BATCH_HEADER_BODY, headers=_HEADERS_WITH_TOKEN
                )
        assert response.status_code == 404

    async def test_sets_x_adapter_mode_header(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_BATCH_HEADER_ROW]):
            async with _make_client() as client:
                response = await client.post(
                    _BATCH_HEADER_URL, json=_BATCH_HEADER_BODY, headers=_HEADERS_WITH_TOKEN
                )
        assert response.headers.get("x-adapter-mode") == "databricks-api"

    async def test_401_without_oauth_token(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_BATCH_HEADER_ROW]):
            async with _make_client() as client:
                response = await client.post(_BATCH_HEADER_URL, json=_BATCH_HEADER_BODY)
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# Wrong adapter mode
# ---------------------------------------------------------------------------

class TestTraceGraphWrongMode:
    async def test_returns_503_when_mode_is_legacy_api(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.post(
                _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
            )
        assert response.status_code == 503

    async def test_returns_503_when_mode_is_absent(self, monkeypatch) -> None:
        monkeypatch.delenv("BACKEND_ADAPTER_MODE", raising=False)
        async with _make_client() as client:
            response = await client.post(
                _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
            )
        assert response.status_code == 503

    async def test_does_not_call_databricks_in_wrong_mode(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        called: list[bool] = []

        async def _mock_execute(*args, **kwargs):
            called.append(True)
            return []

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            _mock_execute,
        ):
            async with _make_client() as client:
                await client.post(_URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN)

        assert called == []


# ---------------------------------------------------------------------------
# Validation errors
# ---------------------------------------------------------------------------

class TestTraceGraphValidation:
    async def test_invalid_direction_returns_422(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {**_VALID_BODY, "direction": "sideways"}
        async with _make_client() as client:
            response = await client.post(_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_missing_material_id_returns_422(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {k: v for k, v in _VALID_BODY.items() if k != "material_id"}
        async with _make_client() as client:
            response = await client.post(_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_missing_batch_id_returns_422(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {k: v for k, v in _VALID_BODY.items() if k != "batch_id"}
        async with _make_client() as client:
            response = await client.post(_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_plant_id_is_optional(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {k: v for k, v in _VALID_BODY.items() if k != "plant_id"}
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200

    async def test_upstream_direction_is_valid(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {**_VALID_BODY, "direction": "upstream"}
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200

    async def test_downstream_direction_is_valid(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {**_VALID_BODY, "direction": "downstream"}
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# Infrastructure failures
# ---------------------------------------------------------------------------

class TestTraceGraphInfraFailures:
    async def test_returns_503_when_databricks_host_missing(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.delenv("DATABRICKS_HOST", raising=False)
        monkeypatch.delenv("SQL_WAREHOUSE_ID", raising=False)
        async with _make_client() as client:
            response = await client.post(
                _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
            )
        assert response.status_code == 503

    async def test_returns_503_when_trace_catalog_missing(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
        monkeypatch.delenv("TRACE_CATALOG", raising=False)
        async with _make_client() as client:
            response = await client.post(
                _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
            )
        assert response.status_code == 503

    async def test_returns_401_when_oauth_token_missing(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_URL, json=_VALID_BODY)
        assert response.status_code == 401

    async def test_query_error_returns_502(self, monkeypatch) -> None:
        from shared.query_service.errors import DatabricksQueryError

        _databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksQueryError("trace2.get_trace_graph", "SQL error"),
        ):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )
        assert response.status_code == 502

    async def test_permission_error_returns_403(self, monkeypatch) -> None:
        from shared.query_service.errors import DatabricksPermissionError

        _databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksPermissionError("trace2.get_trace_graph"),
        ):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )
        assert response.status_code == 403

    async def test_rate_limit_returns_429(self, monkeypatch) -> None:
        from shared.query_service.errors import DatabricksRateLimitError

        _databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksRateLimitError("trace2.get_trace_graph"),
        ):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )
        assert response.status_code == 429

    async def test_timeout_returns_504(self, monkeypatch) -> None:
        from shared.query_service.errors import DatabricksQueryTimeoutError

        _databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksQueryTimeoutError("trace2.get_trace_graph"),
        ):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )
        assert response.status_code == 504


# ---------------------------------------------------------------------------
# Success path
# ---------------------------------------------------------------------------

class TestTraceGraphSuccess:
    async def test_200_with_data_returns_graph(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_LINEAGE_ROW]):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )
        assert response.status_code == 200
        data = response.json()
        assert "nodes" in data
        assert "edges" in data
        assert "depth" in data
        assert "rootBatch" in data
        assert "truncated" in data
        assert "warnings" in data

    async def test_empty_result_returns_200_with_anchor_and_warning(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )
        assert response.status_code == 200
        data = response.json()
        assert data["rootBatch"] == "000000000020052009/0008602411"
        assert len(data["nodes"]) == 1
        assert data["edges"] == []
        assert "no_edges_found" in data["warnings"]

    async def test_anchor_included_in_nodes_even_without_edges(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )
        nodes = response.json()["nodes"]
        assert any(n["isAnchor"] for n in nodes)

    async def test_sets_x_adapter_mode_header(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )
        assert response.headers.get("x-adapter-mode") == "databricks-api"


# ---------------------------------------------------------------------------
# Customer exposure route tests
# ---------------------------------------------------------------------------

_CE_URL = "/api/trace2/customer-exposure"

_CE_VALID_BODY = {
    "material_id": "000000000020052009",
    "batch_id": "0008602411",
}

_FAKE_DELIVERY_ROW = {
    "customer_id": "CUST-001",
    "delivery_id": "DEL-001",
    "sales_order_id": "SO-001",
    "quantity": 500.0,
    "base_unit_of_measure": "KG",
    "posting_date": "2026-01-15",
    "hop_depth": 1,
}


class TestCustomerExposureWrongMode:
    async def test_returns_503_when_mode_is_legacy_api(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.post(_CE_URL, json=_CE_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503

    async def test_returns_503_when_mode_is_absent(self, monkeypatch) -> None:
        monkeypatch.delenv("BACKEND_ADAPTER_MODE", raising=False)
        async with _make_client() as client:
            response = await client.post(_CE_URL, json=_CE_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503


class TestCustomerExposureSuccess:
    async def test_200_returns_exposure_summary(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_DELIVERY_ROW]):
            async with _make_client() as client:
                response = await client.post(_CE_URL, json=_CE_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        data = response.json()
        assert data["affectedCustomers"] == 1
        assert data["affectedDeliveries"] == 1
        assert data["shippedQuantity"] == pytest.approx(500.0)
        assert data["countries"] == []
        assert data["blockedDeliveries"] == 0
        assert data["recallRecommended"] is False
        assert data["highestSeverity"] == "medium"
        assert data["maxExposureDepth"] == 1

    async def test_sets_x_adapter_mode_header(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_DELIVERY_ROW]):
            async with _make_client() as client:
                response = await client.post(_CE_URL, json=_CE_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.headers.get("x-adapter-mode") == "databricks-api"

    async def test_zero_rows_returns_404_with_no_exposure_message(self, monkeypatch) -> None:
        """Zero rows must return 404 with a message that says not to interpret as zero exposure."""
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_CE_URL, json=_CE_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 404
        detail = response.json().get("detail", "")
        assert "do not interpret as zero exposure" in detail.lower()

    async def test_401_without_oauth_token(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_DELIVERY_ROW]):
            async with _make_client() as client:
                response = await client.post(_CE_URL, json=_CE_VALID_BODY)
        assert response.status_code == 401

    async def test_missing_material_id_returns_422(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {k: v for k, v in _CE_VALID_BODY.items() if k != "material_id"}
        async with _make_client() as client:
            response = await client.post(_CE_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_sets_x_data_source_header(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )
        assert "gold_batch_lineage" in response.headers.get("x-data-source", "")

    async def test_sets_x_query_name_header(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )
        query_name = response.headers.get("x-query-name", "")
        assert "trace" in query_name
        assert "graph" in query_name

    async def test_leading_zeros_preserved_in_anchor(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )
        data = response.json()
        anchor_node = next(n for n in data["nodes"] if n["isAnchor"])
        assert anchor_node["materialId"] == "000000000020052009"
        assert anchor_node["batchId"] == "0008602411"

    async def test_max_depth_clamped_to_4(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {**_VALID_BODY, "max_depth": 99}
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=body, headers=_HEADERS_WITH_TOKEN
                )
        assert response.status_code == 200

    async def test_max_edges_clamped_to_5000(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {**_VALID_BODY, "max_edges": 99999}
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=body, headers=_HEADERS_WITH_TOKEN
                )
        assert response.status_code == 200

    async def test_no_raw_token_in_response_body(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )
        assert "user-bearer-token" not in response.text

    async def test_does_not_fall_back_on_databricks_error(self, monkeypatch) -> None:
        """On Databricks error, must return HTTP error — never fall back to mock."""
        from shared.query_service.errors import DatabricksQueryError

        _databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksQueryError("trace2.get_trace_graph", "Warehouse error"),
        ):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )
        assert response.status_code == 502
        data = response.json()
        assert "nodes" not in data
        assert "edges" not in data


# ---------------------------------------------------------------------------
# Architecture guardrails
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# direction="both" edge budget split
# ---------------------------------------------------------------------------

class TestTraceGraphBothDirectionBudgetSplit:
    """The route must split max_edges evenly between directions so upstream is not starved."""

    async def test_both_direction_calls_executor_twice(self, monkeypatch) -> None:
        """direction=both must issue two separate Databricks queries."""
        _databricks_env(monkeypatch)
        call_count: list[int] = [0]

        async def _mock_execute(*args, **kwargs):
            call_count[0] += 1
            return []

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            _mock_execute,
        ):
            async with _make_client() as client:
                response = await client.post(_URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN)

        assert response.status_code == 200
        assert call_count[0] == 2, f"Expected 2 executor calls for direction=both, got {call_count[0]}"

    async def test_both_direction_upstream_rows_survive_dense_downstream(self, monkeypatch) -> None:
        """Upstream rows must appear in response even when downstream fills its budget."""
        _databricks_env(monkeypatch)

        _ds_row = {**_FAKE_LINEAGE_ROW, "traversal_dir": "downstream"}
        _us_row = {
            **_FAKE_LINEAGE_ROW,
            "traversal_dir": "upstream",
            "parent_material_id": "MAT_UPSTREAM",
            "parent_batch_id": "BATCH_UPSTREAM",
            "parent_plant_id": "C061",
            "parent_material_name": "Raw Ingredient",
            "child_material_id": "000000000020052009",
            "child_batch_id": "0008602411",
            "child_plant_id": "C061",
            "link_type": "PRODUCTION",
        }

        call_count = [0]

        async def _mock_execute_alternating(*args, **kwargs):
            result = [_ds_row] if call_count[0] == 0 else [_us_row]
            call_count[0] += 1
            return result

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            _mock_execute_alternating,
        ):
            async with _make_client() as client:
                response = await client.post(_URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN)

        assert response.status_code == 200
        data = response.json()
        direction_labels = {d for n in data["nodes"] for d in n.get("directions", [])}
        assert "downstream" in direction_labels, "downstream direction missing from nodes"
        assert "upstream" in direction_labels, "upstream direction missing from nodes — upstream was starved"

    async def test_single_direction_calls_executor_once(self, monkeypatch) -> None:
        """direction=downstream must issue exactly one Databricks query."""
        _databricks_env(monkeypatch)
        call_count: list[int] = [0]

        async def _mock_execute(*args, **kwargs):
            call_count[0] += 1
            return []

        body = {**_VALID_BODY, "direction": "downstream"}
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            _mock_execute,
        ):
            async with _make_client() as client:
                await client.post(_URL, json=body, headers=_HEADERS_WITH_TOKEN)

        assert call_count[0] == 1, f"Expected 1 executor call for direction=downstream, got {call_count[0]}"

    async def test_response_direction_matches_request_upstream(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {**_VALID_BODY, "direction": "upstream"}
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        assert response.json()["direction"] == "upstream"

    async def test_response_direction_matches_request_downstream(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {**_VALID_BODY, "direction": "downstream"}
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        assert response.json()["direction"] == "downstream"

    async def test_response_direction_both_when_both_requested(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        assert response.json()["direction"] == "both"


# ---------------------------------------------------------------------------
# Batch header plant_id filtering
# ---------------------------------------------------------------------------

class TestBatchHeaderPlantIdFiltering:
    async def test_plant_id_accepted_in_request_body(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {**_BATCH_HEADER_BODY, "plant_id": "IE01"}
        with _patch_executor([_FAKE_BATCH_HEADER_ROW]):
            async with _make_client() as client:
                response = await client.post(_BATCH_HEADER_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        assert response.json()["plantId"] == "IE01"

    async def test_plant_id_optional_absent_returns_200(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_BATCH_HEADER_ROW]):
            async with _make_client() as client:
                response = await client.post(_BATCH_HEADER_URL, json=_BATCH_HEADER_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200


class TestTraceGraphArchitectureGuardrails:
    def test_no_sql_select_in_route_module(self) -> None:
        import inspect
        import routes.trace2 as route_module

        source = inspect.getsource(route_module)
        assert "SELECT" not in source, "SQL SELECT keyword found in route module — SQL must live in QuerySpec factories only"

    def test_no_spn_pat_fallback_in_route_module(self) -> None:
        import inspect
        import routes.trace2 as route_module

        source = inspect.getsource(route_module)
        assert "service_principal" not in source.lower()
        assert "client_secret" not in source.lower()
        assert "pat_token" not in source.lower()

    async def test_mode_check_happens_before_databricks_call(self, monkeypatch) -> None:
        """Wrong mode must return 503 before any Databricks call is made."""
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        called: list[bool] = []

        async def _spy(*args, **kwargs):
            called.append(True)
            return []

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            _spy,
        ):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )

        assert response.status_code == 503
        assert called == [], "Databricks must not be called when mode is wrong"
