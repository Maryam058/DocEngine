"""Convert PDFs to Markdown and attach extracted image references."""

from __future__ import annotations

import argparse
import logging
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tools import DOCS_DIR, PROJECT_ROOT, USER_GUIDE_DIR, ASSETS_DIR
from tools.extract_images import ExtractedImage, extract_images

try:
    from markitdown import MarkItDown  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover - handled at runtime
    MarkItDown = None


@dataclass(frozen=True)
class ConversionSummary:
    """Summary details for a PDF-to-Markdown conversion."""

    pdf_path: Path
    markdown_path: Path
    assets_dir: Path
    image_count: int
    referenced_image_count: int


def _require_markitdown() -> None:
    """Raise a helpful error when MarkItDown is unavailable."""

    if MarkItDown is None:
        raise RuntimeError(
            "Microsoft MarkItDown is required for PDF conversion. Install the 'markitdown' package."
        )


def _configure_logging(verbosity: int) -> None:
    """Configure the module logger."""

    level = logging.WARNING
    if verbosity == 1:
        level = logging.INFO
    elif verbosity >= 2:
        level = logging.DEBUG

    logging.basicConfig(level=level, format="%(levelname)s: %(message)s")


def _convert_pdf(pdf_path: Path) -> str:
    """Convert a PDF file to Markdown text with MarkItDown."""

    _require_markitdown()
    converter = MarkItDown()
    result = converter.convert(str(pdf_path))
    markdown_text = getattr(result, "markdown", None) or getattr(result, "text_content", "")
    return markdown_text.strip() + "\n"


def _build_image_appendix(document_name: str, images: Sequence[ExtractedImage]) -> str:
    """Build a Markdown appendix for extracted images."""

    if not images:
        return ""

    lines = ["", "## Extracted Images", ""]
    for image in images:
        relative_path = f"../assets/{document_name}/{image.path.name}"
        lines.append(
            f"![Extracted image from page {image.page_number}, image {image.image_number}]({relative_path})"
        )
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def _verify_image_references(markdown_path: Path, images: Sequence[ExtractedImage]) -> list[Path]:
    """Verify that every referenced image exists on disk."""

    missing_images = [image.path for image in images if not image.path.exists()]
    if missing_images:
        missing_list = "\n".join(f"- {path}" for path in missing_images)
        raise FileNotFoundError(
            f"The following referenced images are missing for {markdown_path}:\n{missing_list}"
        )
    return [image.path for image in images]


def convert_pdf(pdf_path: Path, docs_dir: Path = DOCS_DIR) -> ConversionSummary:
    """Convert a PDF into Markdown and append extracted image references."""

    pdf_path = pdf_path.expanduser().resolve()
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    document_name = pdf_path.stem
    user_guide_dir = docs_dir / "UserGuide"
    assets_dir = docs_dir / "assets" / document_name
    markdown_path = user_guide_dir / f"{document_name}.md"

    user_guide_dir.mkdir(parents=True, exist_ok=True)
    assets_dir.mkdir(parents=True, exist_ok=True)

    logging.info("Converting %s", pdf_path)
    markdown_text = _convert_pdf(pdf_path)

    extracted_images = extract_images(pdf_path, assets_dir)
    appendix = _build_image_appendix(document_name, extracted_images)
    if appendix:
        markdown_text = markdown_text.rstrip() + appendix

    markdown_path.write_text(markdown_text, encoding="utf-8")
    _verify_image_references(markdown_path, extracted_images)

    return ConversionSummary(
        pdf_path=pdf_path,
        markdown_path=markdown_path,
        assets_dir=assets_dir,
        image_count=len(extracted_images),
        referenced_image_count=len(extracted_images),
    )


def build_parser() -> argparse.ArgumentParser:
    """Build the command-line parser for the PDF importer."""

    parser = argparse.ArgumentParser(
        description="Convert a PDF to Markdown, save it in docs/UserGuide/, and extract images.",
    )
    parser.add_argument("pdf_path", type=Path, help="Path to the PDF file")
    parser.add_argument(
        "--docs-dir",
        type=Path,
        default=DOCS_DIR,
        help="Documentation root directory (default: docs)",
    )
    parser.add_argument("-v", "--verbose", action="count", default=0)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """Run the PDF import CLI."""

    parser = build_parser()
    args = parser.parse_args(argv)
    _configure_logging(args.verbose)

    summary = convert_pdf(args.pdf_path, args.docs_dir)
    logging.info("Markdown written to %s", summary.markdown_path)
    logging.info("Assets written to %s", summary.assets_dir)
    logging.info(
        "Conversion summary: %d image(s) extracted, %d reference(s) verified.",
        summary.image_count,
        summary.referenced_image_count,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
