with open("apps/api/tests/shared/test_databricks_client.py", "r") as f:
    text = f.read()

# Fix _make_http_client_mock
old_mock_def = """def _make_http_client_mock(response: MagicMock) -> MagicMock:
    \"\"\"Wrap a mock response in an async context-manager mock for httpx.AsyncClient.\"\"\"
    http_client = AsyncMock()
    http_client.post = AsyncMock(return_value=response)
    ctx = MagicMock()
    ctx.__aenter__ = AsyncMock(return_value=http_client)
    ctx.__aexit__ = AsyncMock(return_value=False)
    return ctx"""

new_mock_def = """def _make_http_client_mock(response: MagicMock) -> AsyncMock:
    \"\"\"Return a mock httpx.AsyncClient with a configured post method.\"\"\"
    http_client = AsyncMock()
    http_client.post = AsyncMock(return_value=response)
    return http_client"""

text = text.replace(old_mock_def, new_mock_def)

# Fix test mock usages
bad_str = """        ctx = MagicMock()
        ctx.__aenter__ = AsyncMock(return_value=http_client)
        ctx.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=ctx):"""

good_str = """        with patch("httpx.AsyncClient", return_value=http_client):"""

text = text.replace(bad_str, good_str)

with open("apps/api/tests/shared/test_databricks_client.py", "w") as f:
    f.write(text)
