"""Unified command-line entry point for DocEngine documentation tools."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Sequence

from tools.generate_api_docs import generate_api_docs
from tools.generate_release_notes import generate_release_notes
from tools.import_pdf import convert_pdf
from tools.validate_docs import validate_docs


def _build_parser() -> argparse.ArgumentParser:
    """Build the top-level command-line parser."""

    parser = argparse.ArgumentParser(
        prog="run_pipeline.py",
        description="Run the DocEngine documentation pipeline tools.",
    )
    subparsers = parser.add_subparsers(dest="command")

    import_pdf_parser = subparsers.add_parser(
        "import-pdf",
        help="Convert a PDF to Markdown and extract images.",
    )
    import_pdf_parser.add_argument("pdf_file", type=Path, help="Path to the PDF file")

    release_notes_parser = subparsers.add_parser(
        "release-notes",
        help="Generate release notes from a Jira CSV export.",
    )
    release_notes_parser.add_argument("jira_csv", type=Path, help="Path to the Jira CSV export")

    api_docs_parser = subparsers.add_parser(
        "api-docs",
        help="Generate API documentation from an OpenAPI specification.",
    )
    api_docs_parser.add_argument("openapi_spec", type=Path, help="Path to the OpenAPI YAML or JSON file")

    subparsers.add_parser(
        "validate",
        help="Validate documentation links and references.",
    )

    return parser


def _print_success(message: str) -> None:
    """Print a success message to standard output."""

    print(f"Success: {message}")


def _print_error(message: str) -> None:
    """Print an error message to standard error."""

    print(f"Error: {message}", file=sys.stderr)


def _run_import_pdf(pdf_file: Path) -> int:
    """Run the PDF import pipeline step."""

    summary = convert_pdf(pdf_file)
    _print_success(
        f"Imported {summary.pdf_path.name} to {summary.markdown_path} and extracted {summary.image_count} image(s)."
    )
    return 0


def _run_release_notes(jira_csv: Path) -> int:
    """Run the release notes generation step."""

    output_path = generate_release_notes(jira_csv)
    _print_success(f"Generated release notes at {output_path}.")
    return 0


def _run_api_docs(openapi_spec: Path) -> int:
    """Run the API docs generation step."""

    output_path = generate_api_docs(openapi_spec)
    _print_success(f"Generated API documentation at {output_path}.")
    return 0


def _run_validate() -> int:
    """Run the documentation validation step."""

    report = validate_docs()
    if report.total_issues() == 0:
        _print_success("documentation validation passed.")
        return 0

    _print_error("documentation validation failed.")
    print(f"Missing Markdown files: {len(report.missing_markdown_files)}", file=sys.stderr)
    print(f"Broken image links: {len(report.broken_image_links)}", file=sys.stderr)
    print(f"Broken internal links: {len(report.broken_internal_links)}", file=sys.stderr)
    print(f"Invalid relative paths: {len(report.invalid_relative_paths)}", file=sys.stderr)
    print(f"Missing MkDocs references: {len(report.missing_mkdocs_references)}", file=sys.stderr)
    return 1


def main(argv: Sequence[str] | None = None) -> int:
    """Run the documentation pipeline CLI."""

    parser = _build_parser()
    args = parser.parse_args(argv)

    if not args.command:
        parser.print_help()
        return 1

    try:
        if args.command == "import-pdf":
            return _run_import_pdf(args.pdf_file)
        if args.command == "release-notes":
            return _run_release_notes(args.jira_csv)
        if args.command == "api-docs":
            return _run_api_docs(args.openapi_spec)
        if args.command == "validate":
            return _run_validate()
    except Exception as exc:  # pragma: no cover - exercised through CLI behavior
        _print_error(str(exc))
        return 1

    _print_error(f"Unknown command: {args.command}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
