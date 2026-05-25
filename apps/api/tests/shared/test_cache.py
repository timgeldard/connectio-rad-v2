"""Tests for the Query Cache mechanism, including CacheStore, key security, and repository integration."""
import os
import time
from unittest.mock import AsyncMock, patch

import pytest

from shared.query_service.cache import InMemoryCacheStore, get_cache_store
from shared.query_service.cache_policy import CacheTier
from shared.query_service.identity import UserIdentity
from shared.query_service.query_executor import DatabricksRepository
from shared.query_service.query_spec import QuerySpec


@pytest.fixture(autouse=True)
async def clear_cache():
    store = get_cache_store()
    await store.clear()
    yield
    await store.clear()


def _spec(policy: CacheTier = CacheTier.PER_USER_60S) -> QuerySpec:
    return QuerySpec(
        name="test.query",
        module="test",
        endpoint="/api/test",
        sql="SELECT 1",
        cache_policy=policy,
        params={"param1": "val1"},
    )


def _identity(user_id: str = "u001", catalog: str = "allowed_catalog") -> UserIdentity:
    return UserIdentity(user_id=user_id, raw_oauth_token="tok", catalog_target=catalog)


class _MockExecutor:
    def __init__(self, rows: list[dict]) -> None:
        self.rows = rows
        self.call_count = 0

    async def execute(self, spec: QuerySpec, identity: UserIdentity) -> list[dict]:
        self.call_count += 1
        return self.rows


@pytest.mark.asyncio
async def test_cache_store_ttl():
    store = InMemoryCacheStore()
    key = "test_key"
    data = [{"col": "val"}]

    # Store with short TTL
    await store.set(key, data, ttl=1)
    entry = await store.get(key)
    assert entry is not None
    assert entry.data == data

    # Wait for expiration
    time.sleep(1.1)
    entry_expired = await store.get(key)
    assert entry_expired is None


@pytest.mark.asyncio
async def test_repository_cache_miss_then_hit(monkeypatch):
    monkeypatch.setenv("ENABLE_QUERY_CACHE", "true")
    monkeypatch.setenv("DATABRICKS_ALLOWED_CATALOGS", "allowed_catalog")

    executor = _MockExecutor([{"result": 42}])
    repo = DatabricksRepository(executor=executor, identity=_identity())

    # 1. MISS
    res, spec = await repo.fetch(lambda: _spec(CacheTier.PER_USER_60S), lambda r: r)
    assert res == [{"result": 42}]
    assert executor.call_count == 1
    assert spec.cache_status == "MISS"
    assert spec.cache_age_seconds == 0
    assert spec.cache_ttl_seconds == 60

    # 2. HIT
    res2, spec2 = await repo.fetch(lambda: _spec(CacheTier.PER_USER_60S), lambda r: r)
    assert res2 == [{"result": 42}]
    assert executor.call_count == 1  # Should not increment
    assert spec2.cache_status == "HIT"
    assert spec2.cache_age_seconds >= 0
    assert spec2.cache_ttl_seconds == 60


@pytest.mark.asyncio
async def test_repository_cache_bypass(monkeypatch):
    monkeypatch.setenv("ENABLE_QUERY_CACHE", "true")
    monkeypatch.setenv("DATABRICKS_ALLOWED_CATALOGS", "allowed_catalog")

    executor = _MockExecutor([{"result": 42}])
    repo = DatabricksRepository(executor=executor, identity=_identity())

    # NONE policy should bypass cache
    res, spec = await repo.fetch(lambda: _spec(CacheTier.NONE), lambda r: r)
    assert spec.cache_status == "BYPASS"
    assert executor.call_count == 1

    # Second call should still execute
    res2, spec2 = await repo.fetch(lambda: _spec(CacheTier.NONE), lambda r: r)
    assert spec2.cache_status == "BYPASS"
    assert executor.call_count == 2


@pytest.mark.asyncio
async def test_repository_cache_disabled(monkeypatch):
    monkeypatch.setenv("ENABLE_QUERY_CACHE", "false")
    monkeypatch.setenv("DATABRICKS_ALLOWED_CATALOGS", "allowed_catalog")

    executor = _MockExecutor([{"result": 42}])
    repo = DatabricksRepository(executor=executor, identity=_identity())

    # Caching disabled via environment variable
    res, spec = await repo.fetch(lambda: _spec(CacheTier.PER_USER_60S), lambda r: r)
    assert spec.cache_status == "DISABLED"
    assert executor.call_count == 1


@pytest.mark.asyncio
async def test_cache_key_isolation_by_user(monkeypatch):
    monkeypatch.setenv("ENABLE_QUERY_CACHE", "true")
    monkeypatch.setenv("DATABRICKS_ALLOWED_CATALOGS", "allowed_catalog")

    # User 1 MISS
    executor = _MockExecutor([{"user": "u001"}])
    repo1 = DatabricksRepository(executor=executor, identity=_identity(user_id="u001"))
    _, spec1 = await repo1.fetch(lambda: _spec(CacheTier.PER_USER_60S), lambda r: r)
    assert spec1.cache_status == "MISS"

    # User 2 should MISS (isolated user context)
    repo2 = DatabricksRepository(executor=executor, identity=_identity(user_id="u002"))
    _, spec2 = await repo2.fetch(lambda: _spec(CacheTier.PER_USER_60S), lambda r: r)
    assert spec2.cache_status == "MISS"


@pytest.mark.asyncio
async def test_cache_key_isolation_by_catalog(monkeypatch):
    monkeypatch.setenv("ENABLE_QUERY_CACHE", "true")
    monkeypatch.setenv("DATABRICKS_ALLOWED_CATALOGS", "allowed_catalog,other_catalog")

    # Catalog 1 MISS
    executor = _MockExecutor([{"catalog": "allowed_catalog"}])
    repo1 = DatabricksRepository(executor=executor, identity=_identity(catalog="allowed_catalog"))
    _, spec1 = await repo1.fetch(lambda: _spec(CacheTier.PER_USER_60S), lambda r: r)
    assert spec1.cache_status == "MISS"

    # Catalog 2 should MISS (isolated catalog context)
    repo2 = DatabricksRepository(executor=executor, identity=_identity(catalog="other_catalog"))
    _, spec2 = await repo2.fetch(lambda: _spec(CacheTier.PER_USER_60S), lambda r: r)
    assert spec2.cache_status == "MISS"
