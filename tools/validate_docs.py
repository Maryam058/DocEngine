"""Validate Markdown files, links, images, and MkDocs references."""

from __future__ import annotations

import argparse
import logging
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Sequence
from urllib.parse import urlparse

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import yaml

from tools import DOCS_DIR, PROJECT_ROOT


LINK_PATTERN = re.compile(r"(?<!\!)\[([^\]]+)\]\(([^)]+)\)")
IMAGE_PATTERN = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")
HEADING_PATTERN = re.compile(r"^#{1,6}\s+(.+?)\s*$", re.MULTILINE)
CODE_BLOCK_PATTERN = re.compile(r"```.*?```", re.DOTALL)


@dataclass
class ValidationReport:
    """Collected results from documentation validation."""

    missing_markdown_files: list[str] = field(default_factory=list)
    broken_image_links: list[str] = field(default_factory=list)
    broken_internal_links: list[str] = field(default_factory=list)
    invalid_relative_paths: list[str] = field(default_factory=list)
    missing_mkdocs_references: list[str] = field(default_factory=list)
    heading_issues: list[str] = field(default_factory=list)
    table_issues: list[str] = field(default_factory=list)

    def total_issues(self) -> int:
        """Return the total number of validation issues."""

        return sum(
            len(group)
            for group in (
                self.missing_markdown_files,
                self.broken_image_links,
                self.broken_internal_links,
                self.invalid_relative_paths,
                self.missing_mkdocs_references,
            )
        )


def _configure_logging(verbosity: int) -> None:
    """Configure the module logger."""

    level = logging.WARNING
    if verbosity == 1:
        level = logging.INFO
    elif verbosity >= 2:
        level = logging.DEBUG

    logging.basicConfig(level=level, format="%(levelname)s: %(message)s")


def _strip_code_blocks(text: str) -> str:
    """Remove fenced code blocks before link scanning."""

    return CODE_BLOCK_PATTERN.sub("", text)


def _slugify_heading(text: str) -> str:
    """Convert heading text into a Markdown anchor slug."""

    slug = text.strip().lower()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = slug.replace(" ", "-")
    slug = re.sub(r"-+", "-", slug)
    return slug


def _extract_heading_anchors(markdown_text: str) -> set[str]:
    """Collect heading anchors from a Markdown file."""

    return {_slugify_heading(match.group(1)) for match in HEADING_PATTERN.finditer(markdown_text)}


def _iter_mkdocs_file_references(node: object) -> Iterable[str]:
    """Yield file references from the mkdocs navigation tree."""

    if isinstance(node, dict):
        for value in node.values():
            yield from _iter_mkdocs_file_references(value)
    elif isinstance(node, list):
        for item in node:
            yield from _iter_mkdocs_file_references(item)
    elif isinstance(node, str):
        yield node


def _resolve_target(source_file: Path, raw_target: str) -> Path | None:
    """Resolve a Markdown or asset link against the current file."""

    parsed = urlparse(raw_target)
    if parsed.scheme or raw_target.startswith(("http://", "https://", "mailto:", "tel:")):
        return None

    target_without_fragment = raw_target.split("#", 1)[0].strip()
    if not target_without_fragment:
        return source_file

    return (source_file.parent / target_without_fragment).resolve()


def _is_relative_outside_docs(source_file: Path, raw_target: str, docs_dir: Path) -> bool:
    """Check whether a relative target escapes the docs directory."""

    target_path = raw_target.split("#", 1)[0].strip()
    if not target_path:
        return False

    resolved = (source_file.parent / target_path).resolve()
    try:
        resolved.relative_to(docs_dir)
    except ValueError:
        return True
    return False


def _scan_markdown_file(report: ValidationReport, markdown_path: Path, docs_dir: Path) -> None:
    """Scan a Markdown file for broken links and missing assets."""

    markdown_text = markdown_path.read_text(encoding="utf-8")
    stripped_text = _strip_code_blocks(markdown_text)
    current_anchors = _extract_heading_anchors(markdown_text)
    resolved_current_file = markdown_path.resolve()

    for match in IMAGE_PATTERN.finditer(stripped_text):
        raw_target = match.group(2).strip()
        resolved = _resolve_target(markdown_path, raw_target)
        if resolved is None:
            continue
        if not resolved.exists():
            report.broken_image_links.append(f"{markdown_path}: {raw_target}")
        if _is_relative_outside_docs(markdown_path, raw_target, docs_dir):
            report.invalid_relative_paths.append(f"{markdown_path}: {raw_target}")

    for match in LINK_PATTERN.finditer(stripped_text):
        raw_target = match.group(2).strip()
        resolved = _resolve_target(markdown_path, raw_target)
        if resolved is None:
            continue

        file_part, _, fragment = raw_target.partition("#")
        if not resolved.exists():
            if Path(file_part).suffix.lower() in {".md", ".markdown", ".mdown"}:
                report.missing_markdown_files.append(f"{markdown_path}: {raw_target}")
            else:
                report.broken_internal_links.append(f"{markdown_path}: {raw_target}")
            if _is_relative_outside_docs(markdown_path, raw_target, docs_dir):
                report.invalid_relative_paths.append(f"{markdown_path}: {raw_target}")
            continue

        if fragment:
            anchors = current_anchors
            if resolved != resolved_current_file:
                anchors = _extract_heading_anchors(resolved.read_text(encoding="utf-8"))
            if _slugify_heading(fragment) not in anchors:
                report.broken_internal_links.append(f"{markdown_path}: {raw_target}")

    heading_matches = [m.group(1).strip() for m in HEADING_PATTERN.finditer(markdown_text)]
    if not heading_matches:
        report.heading_issues.append(f"{markdown_path}: missing heading structure")
    else:
        level_pattern = re.compile(r"^(#{1,6})\s+")
        levels: list[int] = []
        for line in markdown_text.splitlines():
            match = level_pattern.match(line)
            if match:
                levels.append(len(match.group(1)))

        for index, level in enumerate(levels[1:], start=1):
            previous = levels[index - 1]
            if level > previous + 1:
                report.heading_issues.append(
                    f"{markdown_path}: heading jump from H{previous} to H{level}"
                )

    lines = markdown_text.splitlines()
    for index, line in enumerate(lines):
        stripped_line = line.strip()
        if stripped_line.count("|") < 2:
            continue

        # Detect potential GFM header rows and validate separator row shape.
        if index + 1 >= len(lines):
            continue

        separator = lines[index + 1].strip()
        if "|" not in separator or "-" not in separator:
            continue

        normalized = separator.replace(" ", "")
        if not re.fullmatch(r"\|?[:\-\|]+\|?", normalized):
            report.table_issues.append(
                f"{markdown_path}: possible malformed table separator near line {index + 2}"
            )


def _load_mkdocs_config(config_path: Path) -> dict[str, object]:
    """Load mkdocs.yml."""

    with config_path.open("r", encoding="utf-8") as handle:
        loaded = yaml.safe_load(handle)
    return loaded or {}


def _validate_mkdocs_references(report: ValidationReport, config_path: Path, docs_dir: Path) -> None:
    """Validate files referenced directly in mkdocs.yml."""

    config = _load_mkdocs_config(config_path)

    nav = config.get("nav", [])
    for reference in _iter_mkdocs_file_references(nav):
        if not reference.endswith(".md"):
            continue
        target = (docs_dir / reference).resolve()
        if not target.exists():
            report.missing_mkdocs_references.append(f"nav: {reference}")

    for key in ("extra_css", "extra_javascript"):
        for reference in config.get(key, []) or []:
            if isinstance(reference, str) and reference.startswith(("http://", "https://")):
                continue
            target = (docs_dir / reference).resolve()
            if not target.exists():
                report.missing_mkdocs_references.append(f"{key}: {reference}")


def validate_docs(docs_dir: Path = DOCS_DIR, mkdocs_config: Path = PROJECT_ROOT / "mkdocs.yml") -> ValidationReport:
    """Validate documentation links and required files."""

    docs_dir = docs_dir.expanduser().resolve()
    report = ValidationReport()

    for markdown_path in docs_dir.rglob("*.md"):
        _scan_markdown_file(report, markdown_path, docs_dir)

    _validate_mkdocs_references(report, mkdocs_config, docs_dir)
    return report


def _print_report(report: ValidationReport) -> None:
    """Print a human-readable validation report."""

    print("Validation Report")
    print(f"Missing Markdown files: {len(report.missing_markdown_files)}")
    print(f"Broken image links: {len(report.broken_image_links)}")
    print(f"Broken internal links: {len(report.broken_internal_links)}")
    print(f"Invalid relative paths: {len(report.invalid_relative_paths)}")
    print(f"Missing MkDocs references: {len(report.missing_mkdocs_references)}")
    print(f"Heading issues: {len(report.heading_issues)}")
    print(f"Table issues: {len(report.table_issues)}")

    if report.total_issues() == 0:
        print("No validation issues found.")
        return

    for title, values in (
        ("Missing Markdown files", report.missing_markdown_files),
        ("Broken image links", report.broken_image_links),
        ("Broken internal links", report.broken_internal_links),
        ("Invalid relative paths", report.invalid_relative_paths),
        ("Missing MkDocs references", report.missing_mkdocs_references),
        ("Heading issues", report.heading_issues),
        ("Table issues", report.table_issues),
    ):
        if not values:
            continue
        print(f"\n{title}:")
        for value in values:
            print(f"- {value}")


def build_parser() -> argparse.ArgumentParser:
    """Build the command-line parser for validation."""

    parser = argparse.ArgumentParser(
        description="Validate Markdown links, image paths, and MkDocs references.",
    )
    parser.add_argument(
        "--docs-dir",
        type=Path,
        default=DOCS_DIR,
        help="Documentation directory to scan",
    )
    parser.add_argument(
        "--mkdocs-config",
        type=Path,
        default=PROJECT_ROOT / "mkdocs.yml",
        help="Path to mkdocs.yml",
    )
    parser.add_argument("-v", "--verbose", action="count", default=0)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """Run the documentation validation CLI."""

    parser = build_parser()
    args = parser.parse_args(argv)
    _configure_logging(args.verbose)

    report = validate_docs(args.docs_dir, args.mkdocs_config)
    _print_report(report)
    return 0 if report.total_issues() == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
