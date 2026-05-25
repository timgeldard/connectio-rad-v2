import pytest

def add_env_fixture():
    with open("apps/api/tests/adapters/quality/test_quality_databricks_adapter.py", "r") as f:
        content = f.read()
    
    if "import pytest" not in content:
        content = "import pytest\n" + content
        
    fixture = """
@pytest.fixture(autouse=True)
def setup_env(monkeypatch):
    monkeypatch.setenv("CQ_CATALOG", "test_catalog")
    monkeypatch.setenv("CQ_SCHEMA", "test_schema")
"""
    if "setup_env" not in content:
        # insert after imports
        lines = content.split('\n')
        idx = 0
        for i, line in enumerate(lines):
            if line.startswith('from ') or line.startswith('import '):
                idx = i
        lines.insert(idx + 1, fixture)
        content = '\n'.join(lines)
        
    with open("apps/api/tests/adapters/quality/test_quality_databricks_adapter.py", "w") as f:
        f.write(content)

add_env_fixture()
