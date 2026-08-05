"""Unified command-line entry point for DocEngine documentation tools."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Sequence

from tools.generate_api_docs import generate_api_docs
from tools.editorial_workflow import (
    SOURCE_TYPES,
    get_document_status,
    ingest_source,
    list_documents,
    print_record,
    publish_document,
    transition_review,
)
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
    import_pdf_parser.add_argument(
        "--section",
        choices=["user-guide", "api", "release-notes"],
        help="Target docs section (auto-detected when omitted)",
    )

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

    ingest_parser = subparsers.add_parser(
        "ingest",
        help="Auto-detect a source and create a Draft in the editorial workflow.",
    )
    ingest_parser.add_argument("source", type=Path, help="Source file path")
    ingest_parser.add_argument(
        "--source-type",
        choices=sorted(SOURCE_TYPES),
        default="auto",
        help="Source type override (default: auto)",
    )
    ingest_parser.add_argument(
        "--section",
        choices=["user-guide", "api", "release-notes"],
        help="Published destination section",
    )
    ingest_parser.add_argument("--actor", default="AI", help="Audit actor name")

    review_parser = subparsers.add_parser(
        "review",
        help="Transition a draft through Human Review states.",
    )
    review_parser.add_argument("document_id", help="Workflow document id")
    review_parser.add_argument(
        "--action",
        required=True,
        choices=["submit", "approve", "reject"],
        help="Review transition action",
    )
    review_parser.add_argument("--actor", default="Human", help="Audit actor name")

    publish_parser = subparsers.add_parser(
        "publish",
        help="Publish an approved document with validation, build, and deploy stages.",
    )
    publish_parser.add_argument("document_id", help="Workflow document id")
    publish_parser.add_argument("--actor", default="AI", help="Audit actor name")
    publish_parser.add_argument(
        "--deploy-fail-attempts",
        type=int,
        default=0,
        help="Simulate deployment failures for first N attempts (0-3).",
    )

    status_parser = subparsers.add_parser(
        "status",
        help="Show editorial workflow status.",
    )
    status_parser.add_argument("document_id", nargs="?", help="Optional document id")

    return parser


def _print_success(message: str) -> None:
    """Print a success message to standard output."""

    print(f"Success: {message}")


def _print_error(message: str) -> None:
    """Print an error message to standard error."""

    print(f"Error: {message}", file=sys.stderr)


def _run_import_pdf(pdf_file: Path, section: str | None = None) -> int:
    """Run the PDF import pipeline step."""

    summary = convert_pdf(pdf_file, section=section)
    _print_success(
        f"Imported {summary.pdf_path.name} to {summary.markdown_path} ({summary.section}) and extracted {summary.image_count} image(s)."
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
    print(f"Heading issues: {len(report.heading_issues)}", file=sys.stderr)
    print(f"Table issues: {len(report.table_issues)}", file=sys.stderr)
    return 1


def _run_ingest(source: Path, source_type: str, section: str | None, actor: str) -> int:
    record = ingest_source(source, source_type=source_type, section=section, actor=actor)
    _print_success(f"Ingested source into draft workflow: {print_record(record)}")
    return 0


def _run_review(document_id: str, action: str, actor: str) -> int:
    record = transition_review(document_id, action=action, actor=actor)
    _print_success(f"Review transition applied: {print_record(record)}")
    return 0


def _run_publish(document_id: str, actor: str, deploy_fail_attempts: int) -> int:
    record = publish_document(
        document_id,
        actor=actor,
        deploy_fail_attempts=max(0, min(3, deploy_fail_attempts)),
    )
    _print_success(f"Document published: {print_record(record)}")
    return 0


def _run_status(document_id: str | None) -> int:
    if document_id:
        record = get_document_status(document_id)
        print(print_record(record))
        return 0

    records = list_documents()
    if not records:
        print("No workflow documents tracked yet.")
        return 0

    for record in records:
        print(print_record(record))
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    """Run the documentation pipeline CLI."""

    parser = _build_parser()
    args = parser.parse_args(argv)

    if not args.command:
        parser.print_help()
        return 1

    try:
        if args.command == "import-pdf":
            return _run_import_pdf(args.pdf_file, args.section)
        if args.command == "release-notes":
            return _run_release_notes(args.jira_csv)
        if args.command == "api-docs":
            return _run_api_docs(args.openapi_spec)
        if args.command == "validate":
            return _run_validate()
        if args.command == "ingest":
            return _run_ingest(args.source, args.source_type, args.section, args.actor)
        if args.command == "review":
            return _run_review(args.document_id, args.action, args.actor)
        if args.command == "publish":
            return _run_publish(args.document_id, args.actor, args.deploy_fail_attempts)
        if args.command == "status":
            return _run_status(args.document_id)
    except Exception as exc:  # pragma: no cover - exercised through CLI behavior
        _print_error(str(exc))
        return 1

    _print_error(f"Unknown command: {args.command}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
