import subprocess
import os
import sys
from pathlib import Path

def main():
    repo_root = Path(__file__).parent.parent.parent.parent
    json_schema_path = repo_root / "packages" / "data-contracts" / "dist-schema" / "contracts.json"
    output_path = repo_root / "apps" / "api" / "contracts" / "generated.py"

    if not json_schema_path.exists():
        print(f"Error: {json_schema_path} does not exist. Run the TS export script first.")
        return

    print(f"Generating Pydantic models from {json_schema_path}...")

    cmd = [
        sys.executable, "-m", "datamodel_code_generator",
        "--input", str(json_schema_path),
        "--input-file-type", "jsonschema",
        "--output", str(output_path),
        "--output-model-type", "pydantic_v2.BaseModel",
        "--use-schema-description",
        "--use-field-description",
        "--snake-case-field",
        "--enum-field-as-literal", "all",
        "--field-constraints",
        "--target-python-version", "3.11",
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print("Error generating models:")
        print(result.stderr)
        return

    print(f"Successfully generated Pydantic models at {output_path}")

if __name__ == "__main__":
    main()
