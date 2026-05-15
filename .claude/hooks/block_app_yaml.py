"""PreToolUse hook: block edits to generated app.yaml / app.template.yaml files."""
import json
import sys

try:
    payload = json.load(sys.stdin)
    file_path = payload.get("tool_input", {}).get("file_path", "")
    if file_path.endswith("app.yaml") or file_path.endswith("app.template.yaml"):
        print(f"Blocked: {file_path} is a generated config -- edit the template or deploy script instead.")
        sys.exit(2)
except Exception:
    pass  # fail-open: allow the edit if hook input is malformed
