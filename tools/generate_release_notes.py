"""Generate Markdown release notes from a Jira CSV export."""

from __future__ import annotations

import argparse
import csv
import logging
import sys
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tools import RELEASE_NOTES_DIR


SECTION_NAMES = ["New Features", "Improvements", "Bug Fixes", "Security", "Known Issues"]


@dataclass(frozen=True)
class ReleaseNoteItem:
    """One release note entry derived from the Jira export."""

    issue_key: str
    summary: str
    category: str


def _configure_logging(verbosity: int) -> None:
    """Configure the module logger."""

    level = logging.WARNING
    if verbosity == 1:
        level = logging.INFO
    elif verbosity >= 2:
        level = logging.DEBUG

    logging.basicConfig(level=level, format="%(levelname)s: %(message)s")


def _read_csv_rows(csv_path: Path) -> list[dict[str, str]]:
    """Read a Jira export with automatic delimiter detection."""

    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        sample = handle.read(4096)
        handle.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",	;|")
        except csv.Error:
            dialect = csv.excel_tab

        reader = csv.DictReader(handle, dialect=dialect)
        return [dict(row) for row in reader if any((value or "").strip() for value in row.values())]


def _normalize(value: str | None) -> str:
    """Normalize text for categorization."""

    return (value or "").strip().lower()


def _categorize_row(row: dict[str, str]) -> str:
    """Assign a Jira row to one of the release note sections."""

    issue_type = _normalize(row.get("Issue Type") or row.get("Issue type"))
    summary = _normalize(row.get("Summary"))
    status = _normalize(row.get("Status"))
    resolution = _normalize(row.get("Resolution"))

    if "security" in issue_type or "security" in summary:
        return "Security"
    if any(token in issue_type for token in ("bug", "defect", "incident")) or "fix" in summary:
        return "Bug Fixes"
    if any(token in issue_type for token in ("feature", "new feature")):
        return "New Features"
    if any(token in issue_type for token in ("improvement", "enhancement", "story")):
        return "Improvements"
    if status not in {"closed", "done", "resolved", "fixed"} or resolution not in {"fixed", "done", "resolved"}:
        return "Known Issues"
    return "Improvements"


def _build_release_items(rows: Iterable[dict[str, str]]) -> list[ReleaseNoteItem]:
    """Transform Jira rows into release note items."""

    items: list[ReleaseNoteItem] = []
    for row in rows:
        issue_key = (row.get("Issue key") or row.get("Issue Key") or "").strip()
        summary = (row.get("Summary") or "").strip()
        if not issue_key and not summary:
            continue
        items.append(
            ReleaseNoteItem(
                issue_key=issue_key,
                summary=summary,
                category=_categorize_row(row),
            )
        )
    return items


def _group_items(items: Iterable[ReleaseNoteItem]) -> OrderedDict[str, list[ReleaseNoteItem]]:
    """Group release note items by their category."""

    grouped: OrderedDict[str, list[ReleaseNoteItem]] = OrderedDict((name, []) for name in SECTION_NAMES)
    for item in items:
        grouped.setdefault(item.category, []).append(item)
    return grouped


def _format_section_items(items: list[ReleaseNoteItem]) -> str:
    """Format a bullet list for one release note section."""

    if not items:
        return "No items recorded in the export."

    lines = []
    for item in items:
        if item.issue_key:
            lines.append(f"- **{item.issue_key}** - {item.summary}")
        else:
            lines.append(f"- {item.summary}")
    return "\n".join(lines)


def generate_release_notes(csv_path: Path, output_path: Path = RELEASE_NOTES_DIR / "latest-release-notes.md") -> Path:
    """Generate professional release notes from a Jira CSV export."""

    csv_path = csv_path.expanduser().resolve()
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV export not found: {csv_path}")

    output_path = output_path.expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    rows = _read_csv_rows(csv_path)
    items = _build_release_items(rows)
    grouped_items = _group_items(items)

    total_items = sum(len(group) for group in grouped_items.values())
    overview = (
        "This release includes changes captured from the Jira export, grouped by user-facing impact."
        if total_items
        else "No release note entries were found in the Jira export."
    )

    lines = ["# Latest Release Notes", "", "## Overview", "", overview, ""]
    for section_name in SECTION_NAMES:
        lines.extend([f"## {section_name}", "", _format_section_items(grouped_items[section_name]), ""])

    output_path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    logging.info("Release notes written to %s", output_path)
    return output_path


def build_parser() -> argparse.ArgumentParser:
    """Build the command-line parser for release note generation."""

    parser = argparse.ArgumentParser(
        description="Generate Markdown release notes from a Jira CSV export.",
    )
    parser.add_argument("csv_path", type=Path, help="Path to the Jira CSV export")
    parser.add_argument(
        "--output",
        type=Path,
        default=RELEASE_NOTES_DIR / "latest-release-notes.md",
        help="Output Markdown file",
    )
    parser.add_argument("-v", "--verbose", action="count", default=0)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """Run the release note generation CLI."""

    parser = build_parser()
    args = parser.parse_args(argv)
    _configure_logging(args.verbose)

    generate_release_notes(args.csv_path, args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
