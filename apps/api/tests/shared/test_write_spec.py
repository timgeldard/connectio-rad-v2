"""Unit tests for WriteSpec audit-token enforcement.

Every V2 write must stamp ``CURRENT_USER()`` + ``CURRENT_TIMESTAMP()`` in its
SQL. ``assert_write_spec_has_audit`` is the architectural choke point.
"""
from __future__ import annotations

import pytest

from shared.query_service.write_spec import WriteSpec, assert_write_spec_has_audit


def _spec(sql: str) -> WriteSpec:
    return WriteSpec(
        name="test.write",
        module="test",
        endpoint="/api/test",
        sql=sql,
        params={},
    )


def test_accepts_sql_with_both_audit_tokens() -> None:
    sql = """
    MERGE INTO `cat`.`sch`.`tbl` t
    USING (SELECT :area_id AS area_id, CURRENT_USER() AS updated_by, CURRENT_TIMESTAMP() AS updated_at) s
    ON t.area_id = s.area_id
    WHEN MATCHED THEN UPDATE SET updated_by = s.updated_by, updated_at = s.updated_at
    WHEN NOT MATCHED THEN INSERT (area_id, updated_by, updated_at) VALUES (s.area_id, s.updated_by, s.updated_at)
    """
    # Should not raise.
    assert_write_spec_has_audit(_spec(sql))


def test_rejects_sql_missing_current_user() -> None:
    sql = "INSERT INTO t (updated_at) VALUES (CURRENT_TIMESTAMP())"
    with pytest.raises(ValueError, match="CURRENT_USER"):
        assert_write_spec_has_audit(_spec(sql))


def test_rejects_sql_missing_current_timestamp() -> None:
    sql = "INSERT INTO t (updated_by) VALUES (CURRENT_USER())"
    with pytest.raises(ValueError, match="CURRENT_TIMESTAMP"):
        assert_write_spec_has_audit(_spec(sql))


def test_rejects_sql_missing_both() -> None:
    sql = "DELETE FROM t WHERE area_id = :area_id"
    with pytest.raises(ValueError, match="CURRENT_USER"):
        assert_write_spec_has_audit(_spec(sql))


def test_is_case_insensitive() -> None:
    sql = "merge into t using s on t.id=s.id when matched then update set updated_by=current_user(), updated_at=current_timestamp()"
    assert_write_spec_has_audit(_spec(sql))
