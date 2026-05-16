"""Tests for the query_service infrastructure (CacheTier, UserIdentity, QuerySpec, QueryExecutor)."""
import pytest

from shared.query_service.cache_policy import CacheTier
from shared.query_service.errors import DatabricksAuthRequiredError, QueryExecutionError
from shared.query_service.identity import UserIdentity
from shared.query_service.query_spec import QuerySpec
from shared.query_service.query_executor import NotImplementedDatabricksClient, QueryExecutor


# ---------------------------------------------------------------------------
# CacheTier
# ---------------------------------------------------------------------------

class TestCacheTier:
    def test_values_are_strings(self) -> None:
        assert CacheTier.GLOBAL_300S == "global_300s"
        assert CacheTier.PER_USER_60S == "per_user_60s"
        assert CacheTier.NONE == "none"

    def test_all_three_tiers_exist(self) -> None:
        members = {t.value for t in CacheTier}
        assert members == {"global_300s", "per_user_60s", "none"}


# ---------------------------------------------------------------------------
# DatabricksAuthRequiredError
# ---------------------------------------------------------------------------

class TestDatabricksAuthRequiredError:
    def test_carries_user_id(self) -> None:
        err = DatabricksAuthRequiredError("u001")
        assert err.user_id == "u001"

    def test_message_contains_user_id(self) -> None:
        err = DatabricksAuthRequiredError("u001")
        assert "u001" in str(err)

    def test_is_exception(self) -> None:
        assert issubclass(DatabricksAuthRequiredError, Exception)

    def test_no_service_principal_hint_in_message(self) -> None:
        err = DatabricksAuthRequiredError("u001")
        assert "service principal" in str(err).lower()


class TestQueryExecutionError:
    def test_is_exception(self) -> None:
        assert issubclass(QueryExecutionError, Exception)

    def test_can_be_raised_with_message(self) -> None:
        with pytest.raises(QueryExecutionError, match="query failed"):
            raise QueryExecutionError("query failed")


# ---------------------------------------------------------------------------
# UserIdentity
# ---------------------------------------------------------------------------

class TestUserIdentity:
    def test_require_user_oauth_returns_token_when_present(self) -> None:
        identity = UserIdentity(user_id="u001", email="u@example.com", raw_oauth_token="tok123")
        assert identity.require_user_oauth() == "tok123"

    def test_require_user_oauth_raises_when_token_is_none(self) -> None:
        identity = UserIdentity(user_id="u001", raw_oauth_token=None)
        with pytest.raises(DatabricksAuthRequiredError) as exc_info:
            identity.require_user_oauth()
        assert exc_info.value.user_id == "u001"

    def test_require_user_oauth_raises_when_token_is_empty_string(self) -> None:
        identity = UserIdentity(user_id="u001", raw_oauth_token="")
        with pytest.raises(DatabricksAuthRequiredError):
            identity.require_user_oauth()

    def test_email_is_optional(self) -> None:
        identity = UserIdentity(user_id="u001")
        assert identity.email is None

    def test_oauth_token_is_optional(self) -> None:
        identity = UserIdentity(user_id="u001")
        assert identity.raw_oauth_token is None


# ---------------------------------------------------------------------------
# QuerySpec
# ---------------------------------------------------------------------------

class TestQuerySpec:
    def test_required_fields(self) -> None:
        spec = QuerySpec(
            name="test.query",
            module="test",
            endpoint="/api/test",
            sql="SELECT 1",
        )
        assert spec.name == "test.query"
        assert spec.module == "test"
        assert spec.endpoint == "/api/test"
        assert spec.sql == "SELECT 1"

    def test_default_cache_policy(self) -> None:
        spec = QuerySpec(name="x", module="x", endpoint="/x", sql="SELECT 1")
        assert spec.cache_policy == CacheTier.GLOBAL_300S

    def test_default_source_badge(self) -> None:
        spec = QuerySpec(name="x", module="x", endpoint="/x", sql="SELECT 1")
        assert spec.source_badge == "databricks-api"

    def test_default_max_rows(self) -> None:
        spec = QuerySpec(name="x", module="x", endpoint="/x", sql="SELECT 1")
        assert spec.max_rows == 10_000

    def test_default_params_is_empty_dict(self) -> None:
        spec = QuerySpec(name="x", module="x", endpoint="/x", sql="SELECT 1")
        assert spec.params == {}

    def test_default_tags_is_empty_list(self) -> None:
        spec = QuerySpec(name="x", module="x", endpoint="/x", sql="SELECT 1")
        assert spec.tags == []

    def test_params_not_shared_between_instances(self) -> None:
        spec1 = QuerySpec(name="x", module="x", endpoint="/x", sql="SELECT 1")
        spec2 = QuerySpec(name="y", module="y", endpoint="/y", sql="SELECT 2")
        spec1.params["key"] = "value"
        assert "key" not in spec2.params

    def test_custom_cache_policy(self) -> None:
        spec = QuerySpec(
            name="x", module="x", endpoint="/x", sql="SELECT 1",
            cache_policy=CacheTier.PER_USER_60S,
        )
        assert spec.cache_policy == CacheTier.PER_USER_60S

    def test_catalog_override_defaults_to_none(self) -> None:
        spec = QuerySpec(name="x", module="x", endpoint="/x", sql="SELECT 1")
        assert spec.catalog_override is None


# ---------------------------------------------------------------------------
# QueryExecutor
# ---------------------------------------------------------------------------

class TestNotImplementedDatabricksClient:
    def test_raises_not_implemented(self) -> None:
        client = NotImplementedDatabricksClient()
        spec = QuerySpec(name="x", module="x", endpoint="/x", sql="SELECT 1")
        with pytest.raises(NotImplementedError, match="ADR-024"):
            client.execute(spec, "some-token")


class TestQueryExecutor:
    def test_raises_auth_error_when_token_absent(self) -> None:
        executor = QueryExecutor()
        identity = UserIdentity(user_id="u001", raw_oauth_token=None)
        spec = QuerySpec(name="x", module="x", endpoint="/x", sql="SELECT 1")
        with pytest.raises(DatabricksAuthRequiredError):
            executor.execute(spec, identity)

    def test_calls_require_user_oauth_before_client(self) -> None:
        """The identity check must run before the client — not after."""
        calls: list[str] = []

        class SpyClient:
            def execute(self, spec: QuerySpec, token: str) -> list[dict]:
                calls.append("client.execute")
                return []

        executor = QueryExecutor(client=SpyClient())
        identity = UserIdentity(user_id="u001", raw_oauth_token=None)
        spec = QuerySpec(name="x", module="x", endpoint="/x", sql="SELECT 1")

        with pytest.raises(DatabricksAuthRequiredError):
            executor.execute(spec, identity)

        assert "client.execute" not in calls

    def test_passes_token_to_client(self) -> None:
        received: list[str] = []

        class CapturingClient:
            def execute(self, spec: QuerySpec, token: str) -> list[dict]:
                received.append(token)
                return [{"col": "val"}]

        executor = QueryExecutor(client=CapturingClient())
        identity = UserIdentity(user_id="u001", raw_oauth_token="bearer-xyz")
        spec = QuerySpec(name="x", module="x", endpoint="/x", sql="SELECT 1")

        result = executor.execute(spec, identity)

        assert received == ["bearer-xyz"]
        assert result == [{"col": "val"}]

    def test_default_client_is_not_implemented(self) -> None:
        executor = QueryExecutor()
        identity = UserIdentity(user_id="u001", raw_oauth_token="tok")
        spec = QuerySpec(name="x", module="x", endpoint="/x", sql="SELECT 1")
        with pytest.raises(NotImplementedError):
            executor.execute(spec, identity)
