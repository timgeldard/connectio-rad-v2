"""Tests for the Databricks query client implementations (ADR-025)."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from shared.query_service.databricks_client import (
    StatementApiDatabricksClient,
    _infer_param_type,
    _parse_result,
)
from shared.query_service.errors import (
    DatabricksAuthRequiredError,
    DatabricksQueryError,
    DatabricksQueryTimeoutError,
)


# ---------------------------------------------------------------------------
# _infer_param_type
# ---------------------------------------------------------------------------

class TestInferParamType:
    def test_string_value(self) -> None:
        assert _infer_param_type("hello") == "STRING"

    def test_int_value(self) -> None:
        assert _infer_param_type(42) == "INT"

    def test_float_value(self) -> None:
        assert _infer_param_type(3.14) == "DOUBLE"

    def test_bool_true_is_boolean_not_int(self) -> None:
        assert _infer_param_type(True) == "BOOLEAN"

    def test_bool_false_is_boolean_not_int(self) -> None:
        assert _infer_param_type(False) == "BOOLEAN"

    def test_none_is_string(self) -> None:
        assert _infer_param_type(None) == "STRING"

    def test_large_int_is_int(self) -> None:
        assert _infer_param_type(10_000) == "INT"


# ---------------------------------------------------------------------------
# _parse_result
# ---------------------------------------------------------------------------

class TestParseResult:
    def test_returns_list_of_dicts(self) -> None:
        data = {
            "manifest": {"schema": {"columns": [{"name": "a"}, {"name": "b"}]}},
            "result": {"data_array": [["v1", "v2"], ["v3", "v4"]]},
        }
        rows = _parse_result(data, "test.query")
        assert rows == [{"a": "v1", "b": "v2"}, {"a": "v3", "b": "v4"}]

    def test_empty_data_array(self) -> None:
        data = {
            "manifest": {"schema": {"columns": [{"name": "col"}]}},
            "result": {"data_array": []},
        }
        assert _parse_result(data, "test") == []

    def test_null_data_array_returns_empty(self) -> None:
        data = {
            "manifest": {"schema": {"columns": [{"name": "col"}]}},
            "result": {},
        }
        assert _parse_result(data, "test") == []

    def test_missing_manifest_raises_query_error(self) -> None:
        with pytest.raises(DatabricksQueryError):
            _parse_result({}, "test.query")

    def test_malformed_columns_raises_query_error(self) -> None:
        data = {"manifest": {"schema": {"columns": "not-a-list"}}, "result": {}}
        with pytest.raises(DatabricksQueryError):
            _parse_result(data, "test.query")


# ---------------------------------------------------------------------------
# StatementApiDatabricksClient helpers
# ---------------------------------------------------------------------------

def _make_statement_response(
    state: str,
    columns: list[str] | None = None,
    data_array: list[list[object]] | None = None,
    error_msg: str | None = None,
    status_code: int = 200,
) -> MagicMock:
    mock = MagicMock()
    mock.status_code = status_code
    mock.is_success = status_code < 400
    mock.text = ""

    body: dict = {"status": {"state": state}}
    if state == "SUCCEEDED":
        body["manifest"] = {"schema": {"columns": [{"name": c} for c in (columns or [])]}}
        body["result"] = {"data_array": data_array or []}
    elif state == "FAILED":
        body["status"]["error"] = {"message": error_msg or "Query failed"}

    mock.json.return_value = body
    return mock


def _make_http_client_mock(response: MagicMock) -> MagicMock:
    """Wrap a mock response in an async context-manager mock for httpx.AsyncClient."""
    http_client = AsyncMock()
    http_client.post = AsyncMock(return_value=response)
    ctx = MagicMock()
    ctx.__aenter__ = AsyncMock(return_value=http_client)
    ctx.__aexit__ = AsyncMock(return_value=False)
    return ctx


# ---------------------------------------------------------------------------
# StatementApiDatabricksClient.execute
# ---------------------------------------------------------------------------

class TestStatementApiDatabricksClient:
    _BASE_KWARGS: dict = {
        "sql": "SELECT col1, col2 FROM t WHERE id = :id",
        "params": {"id": "123", "max_rows": 100},
        "oauth_token": "user-token",
        "warehouse_id": "wh-abc",
        "timeout_seconds": 30,
        "tags": {"query_name": "test.query", "user_id": "u001"},
    }

    async def test_succeeded_state_returns_rows(self) -> None:
        response = _make_statement_response(
            "SUCCEEDED",
            columns=["col1", "col2"],
            data_array=[["v1", "v2"]],
        )
        with patch("httpx.AsyncClient", return_value=_make_http_client_mock(response)):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            rows = await client.execute(**self._BASE_KWARGS)

        assert rows == [{"col1": "v1", "col2": "v2"}]

    async def test_succeeded_with_multiple_rows(self) -> None:
        response = _make_statement_response(
            "SUCCEEDED",
            columns=["a", "b"],
            data_array=[["1", "x"], ["2", "y"]],
        )
        with patch("httpx.AsyncClient", return_value=_make_http_client_mock(response)):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            rows = await client.execute(**self._BASE_KWARGS)

        assert len(rows) == 2
        assert rows[0] == {"a": "1", "b": "x"}
        assert rows[1] == {"a": "2", "b": "y"}

    async def test_succeeded_empty_result(self) -> None:
        response = _make_statement_response(
            "SUCCEEDED", columns=["col"], data_array=[]
        )
        with patch("httpx.AsyncClient", return_value=_make_http_client_mock(response)):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            rows = await client.execute(**self._BASE_KWARGS)

        assert rows == []

    async def test_failed_state_raises_query_error(self) -> None:
        response = _make_statement_response("FAILED", error_msg="Syntax error near SELECT")
        with patch("httpx.AsyncClient", return_value=_make_http_client_mock(response)):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            with pytest.raises(DatabricksQueryError) as exc_info:
                await client.execute(**self._BASE_KWARGS)

        assert "Syntax error" in exc_info.value.detail

    async def test_canceled_state_raises_timeout_error(self) -> None:
        response = _make_statement_response("CANCELED")
        with patch("httpx.AsyncClient", return_value=_make_http_client_mock(response)):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            with pytest.raises(DatabricksQueryTimeoutError):
                await client.execute(**self._BASE_KWARGS)

    async def test_closed_state_raises_timeout_error(self) -> None:
        response = _make_statement_response("CLOSED")
        with patch("httpx.AsyncClient", return_value=_make_http_client_mock(response)):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            with pytest.raises(DatabricksQueryTimeoutError):
                await client.execute(**self._BASE_KWARGS)

    async def test_unexpected_state_raises_query_error(self) -> None:
        response = _make_statement_response("PENDING")
        with patch("httpx.AsyncClient", return_value=_make_http_client_mock(response)):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            with pytest.raises(DatabricksQueryError, match="PENDING"):
                await client.execute(**self._BASE_KWARGS)

    async def test_http_401_raises_auth_required_error(self) -> None:
        response = _make_statement_response("FAILED", status_code=401)
        with patch("httpx.AsyncClient", return_value=_make_http_client_mock(response)):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            with pytest.raises(DatabricksAuthRequiredError):
                await client.execute(**self._BASE_KWARGS)

    async def test_http_500_raises_query_error(self) -> None:
        response = _make_statement_response("FAILED", status_code=500)
        response.text = "Internal server error"
        with patch("httpx.AsyncClient", return_value=_make_http_client_mock(response)):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            with pytest.raises(DatabricksQueryError):
                await client.execute(**self._BASE_KWARGS)

    async def test_sends_bearer_token_in_header(self) -> None:
        """OAuth token must be forwarded via Authorization: Bearer."""
        captured_headers: list[dict] = []
        response = _make_statement_response("SUCCEEDED", columns=[], data_array=[])

        http_client = AsyncMock()
        http_client.post = AsyncMock(return_value=response)

        async def capture_post(url, *, headers, json, **_):
            captured_headers.append(headers)
            return response

        http_client.post = capture_post
        ctx = MagicMock()
        ctx.__aenter__ = AsyncMock(return_value=http_client)
        ctx.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=ctx):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            await client.execute(**self._BASE_KWARGS)

        assert captured_headers[0]["Authorization"] == "Bearer user-token"

    async def test_sends_parameters_in_request_body(self) -> None:
        """Parameters must be forwarded to Statement API as typed list."""
        captured_bodies: list[dict] = []
        response = _make_statement_response("SUCCEEDED", columns=[], data_array=[])

        http_client = AsyncMock()

        async def capture_post(url, *, headers, json, **_):
            captured_bodies.append(json)
            return response

        http_client.post = capture_post
        ctx = MagicMock()
        ctx.__aenter__ = AsyncMock(return_value=http_client)
        ctx.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=ctx):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            await client.execute(
                sql="SELECT 1",
                params={"p_str": "hello", "p_int": 42},
                oauth_token="tok",
                warehouse_id="wh",
                timeout_seconds=30,
                tags={},
            )

        params = captured_bodies[0]["parameters"]
        param_map = {p["name"]: p for p in params}
        assert param_map["p_str"]["type"] == "STRING"
        assert param_map["p_str"]["value"] == "hello"
        assert param_map["p_int"]["type"] == "INT"
        assert param_map["p_int"]["value"] == "42"

    async def test_uses_wait_timeout_from_timeout_seconds(self) -> None:
        captured_bodies: list[dict] = []
        response = _make_statement_response("SUCCEEDED", columns=[], data_array=[])

        http_client = AsyncMock()

        async def capture_post(url, *, headers, json, **_):
            captured_bodies.append(json)
            return response

        http_client.post = capture_post
        ctx = MagicMock()
        ctx.__aenter__ = AsyncMock(return_value=http_client)
        ctx.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=ctx):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            await client.execute(
                sql="SELECT 1", params={}, oauth_token="tok",
                warehouse_id="wh", timeout_seconds=45, tags={},
            )

        assert captured_bodies[0]["wait_timeout"] == "45s"
        assert captured_bodies[0]["on_wait_timeout"] == "CANCEL"

    async def test_host_trailing_slash_stripped(self) -> None:
        captured_urls: list[str] = []
        response = _make_statement_response("SUCCEEDED", columns=[], data_array=[])

        http_client = AsyncMock()

        async def capture_post(url, *, headers, json, **_):
            captured_urls.append(url)
            return response

        http_client.post = capture_post
        ctx = MagicMock()
        ctx.__aenter__ = AsyncMock(return_value=http_client)
        ctx.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=ctx):
            client = StatementApiDatabricksClient(host="test.databricks.com/")
            await client.execute(
                sql="SELECT 1", params={}, oauth_token="tok",
                warehouse_id="wh", timeout_seconds=30, tags={},
            )

        assert captured_urls[0] == "https://test.databricks.com/api/2.0/sql/statements"
        assert "//" not in captured_urls[0].replace("https://", "")

    async def test_no_parameters_key_when_params_empty(self) -> None:
        captured_bodies: list[dict] = []
        response = _make_statement_response("SUCCEEDED", columns=[], data_array=[])

        http_client = AsyncMock()

        async def capture_post(url, *, headers, json, **_):
            captured_bodies.append(json)
            return response

        http_client.post = capture_post
        ctx = MagicMock()
        ctx.__aenter__ = AsyncMock(return_value=http_client)
        ctx.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=ctx):
            client = StatementApiDatabricksClient(host="test.databricks.com")
            await client.execute(
                sql="SELECT 1", params={}, oauth_token="tok",
                warehouse_id="wh", timeout_seconds=30, tags={},
            )

        assert "parameters" not in captured_bodies[0]
