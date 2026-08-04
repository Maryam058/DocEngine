"""Generate Markdown API documentation from an OpenAPI spec."""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Any, Sequence

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tools import API_DIR

try:
    import yaml  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover - handled at runtime
    yaml = None


def _configure_logging(verbosity: int) -> None:
    """Configure the module logger."""

    level = logging.WARNING
    if verbosity == 1:
        level = logging.INFO
    elif verbosity >= 2:
        level = logging.DEBUG

    logging.basicConfig(level=level, format="%(levelname)s: %(message)s")


def _require_yaml() -> None:
    """Raise a helpful error when PyYAML is unavailable."""

    if yaml is None:
        raise RuntimeError("PyYAML is required for OpenAPI parsing. Install the 'pyyaml' package.")


def _load_spec(spec_path: Path) -> dict[str, Any]:
    """Load an OpenAPI document from YAML or JSON."""

    spec_path = spec_path.expanduser().resolve()
    if not spec_path.exists():
        raise FileNotFoundError(f"OpenAPI specification not found: {spec_path}")

    if spec_path.suffix.lower() == ".json":
        with spec_path.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    _require_yaml()
    with spec_path.open("r", encoding="utf-8") as handle:
        loaded = yaml.safe_load(handle)
    return loaded or {}


def _title_case(value: str) -> str:
    """Convert an operation summary into a readable title."""

    return " ".join(part.capitalize() for part in value.split())


def _format_schema(schema: dict[str, Any] | None) -> str:
    """Render a compact schema description."""

    if not schema:
        return "Unspecified"

    schema_type = schema.get("type")
    if schema_type:
        return str(schema_type)
    ref = schema.get("$ref")
    if ref:
        return ref.rsplit("/", 1)[-1]
    return "Object"


def _format_parameters(parameters: list[dict[str, Any]] | None) -> str:
    """Format OpenAPI parameters as a Markdown table."""

    if not parameters:
        return "No parameters are defined in the current OpenAPI specification."

    rows = ["| Name | In | Type | Required | Description |", "|------|----|------|----------|-------------|"]
    for parameter in parameters:
        schema = parameter.get("schema") if isinstance(parameter.get("schema"), dict) else {}
        rows.append(
            f"| {parameter.get('name', '')} | {parameter.get('in', '')} | {_format_schema(schema)} | "
            f"{'Yes' if parameter.get('required') else 'No'} | {parameter.get('description', '')} |"
        )
    return "\n".join(rows)


def _format_responses(responses: dict[str, Any] | None) -> str:
    """Format OpenAPI responses as a Markdown table."""

    if not responses:
        return "No responses are defined in the current OpenAPI specification."

    rows = ["| Code | Description |", "|------|-------------|"]
    for code, response in responses.items():
        description = response.get("description", "") if isinstance(response, dict) else str(response)
        rows.append(f"| {code} | {description} |")
    return "\n".join(rows)


def _format_request_body(request_body: dict[str, Any] | None) -> str:
    """Format an OpenAPI request body section."""

    if not request_body:
        return "No request body is defined for this operation."

    required = "Yes" if request_body.get("required") else "No"
    content = request_body.get("content", {})
    content_types = ", ".join(content.keys()) if isinstance(content, dict) and content else "Unspecified"
    return f"Required: {required}\n\nContent types: {content_types}"


def _format_operation(method: str, path: str, operation: dict[str, Any]) -> str:
    """Render one OpenAPI operation into Markdown."""

    title = _title_case(operation.get("summary") or f"{method} {path}")
    description = operation.get("description") or "This endpoint is documented from the OpenAPI specification."
    parameters = _format_parameters(operation.get("parameters"))
    request_body = _format_request_body(operation.get("requestBody"))
    responses = _format_responses(operation.get("responses"))

    parts = [
        f"## {title}",
        "",
        "### Endpoint",
        "",
        f"`{method.upper()} {path}`",
        "",
        "### Description",
        "",
        description,
        "",
        "### Parameters",
        "",
        parameters,
        "",
        "### Request Body",
        "",
        request_body,
        "",
        "### Response",
        "",
        responses,
    ]
    return "\n".join(parts)


def generate_api_docs(spec_path: Path, output_path: Path = API_DIR / "api-reference.md") -> Path:
    """Generate Markdown API documentation from an OpenAPI specification."""

    spec = _load_spec(spec_path)
    info = spec.get("info", {}) if isinstance(spec.get("info"), dict) else {}
    title = info.get("title", "API Reference")
    version = info.get("version", "Unknown")
    description = info.get("description") or f"This API reference was generated from {spec_path.name}."

    lines = [
        f"# {title} API Reference",
        "",
        "## Overview",
        "",
        description,
        "",
        f"**OpenAPI Version:** {spec.get('openapi', 'Unknown')}",
        "",
        f"**API Version:** {version}",
        "",
        "---",
        "",
    ]

    paths = spec.get("paths", {}) if isinstance(spec.get("paths"), dict) else {}
    for path, path_item in paths.items():
        if not isinstance(path_item, dict):
            continue
        for method in ("get", "post", "put", "patch", "delete", "head", "options", "trace"):
            operation = path_item.get(method)
            if isinstance(operation, dict):
                lines.extend([_format_operation(method, path, operation), "", "---", ""])

    output_path = output_path.expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    logging.info("API documentation written to %s", output_path)
    return output_path


def build_parser() -> argparse.ArgumentParser:
    """Build the command-line parser for API documentation generation."""

    parser = argparse.ArgumentParser(
        description="Generate Markdown API documentation from an OpenAPI YAML or JSON file.",
    )
    parser.add_argument("spec_path", type=Path, help="Path to the OpenAPI YAML or JSON file")
    parser.add_argument(
        "--output",
        type=Path,
        default=API_DIR / "api-reference.md",
        help="Output Markdown file",
    )
    parser.add_argument("-v", "--verbose", action="count", default=0)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """Run the API documentation generation CLI."""

    parser = build_parser()
    args = parser.parse_args(argv)
    _configure_logging(args.verbose)

    generate_api_docs(args.spec_path, args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
