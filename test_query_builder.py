import sys
sys.path.insert(0, 'packages/python-db/src')
from shared_db.query_builder import QueryBuilder

qb = QueryBuilder(base_table="test")
