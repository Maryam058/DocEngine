"""Extract embedded images from PDFs into MkDocs asset folders."""

from __future__ import annotations

import argparse
import logging
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tools import ASSETS_DIR, PROJECT_ROOT

try:
    import fitz  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover - handled at runtime
    fitz = None


@dataclass(frozen=True)
class ExtractedImage:
    """Information about one extracted image."""

    page_number: int
    image_number: int
    path: Path


def _require_fitz() -> None:
    """Raise a helpful error when PyMuPDF is unavailable."""

    if fitz is None:
        raise RuntimeError(
            "PyMuPDF is required for image extraction. Install the 'pymupdf' package."
        )


def _configure_logging(verbosity: int) -> None:
    """Configure the module logger."""

    level = logging.WARNING
    if verbosity == 1:
        level = logging.INFO
    elif verbosity >= 2:
        level = logging.DEBUG

    logging.basicConfig(level=level, format="%(levelname)s: %(message)s")


def _save_pixmap(document: "fitz.Document", xref: int, output_path: Path) -> None:
    """Save a single image xref as a PNG file."""

    pixmap = fitz.Pixmap(document, xref)
    try:
        if pixmap.n >= 5:
            pixmap = fitz.Pixmap(fitz.csRGB, pixmap)
        pixmap.save(output_path.as_posix())
    finally:
        pixmap = None


def extract_images(pdf_path: Path, output_dir: Path | None = None) -> list[ExtractedImage]:
    """Extract all embedded images from a PDF into an asset directory."""

    _require_fitz()

    pdf_path = pdf_path.expanduser().resolve()
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    target_dir = output_dir.expanduser().resolve() if output_dir else ASSETS_DIR / pdf_path.stem
    target_dir.mkdir(parents=True, exist_ok=True)

    extracted_images: list[ExtractedImage] = []
    image_number = 1

    with fitz.open(pdf_path) as document:
        for page_index in range(document.page_count):
            page = document.load_page(page_index)
            for image_info in page.get_images(full=True):
                xref = image_info[0]
                output_path = target_dir / f"page_{page_index + 1}_img_{image_number}.png"
                _save_pixmap(document, xref, output_path)
                extracted_images.append(
                    ExtractedImage(
                        page_number=page_index + 1,
                        image_number=image_number,
                        path=output_path,
                    )
                )
                logging.debug("Extracted %s", output_path)
                image_number += 1

    return extracted_images


def build_parser() -> argparse.ArgumentParser:
    """Build the command-line parser for the image extractor."""

    parser = argparse.ArgumentParser(
        description="Extract embedded images from a PDF into docs/assets/<name>/.",
    )
    parser.add_argument("pdf_path", type=Path, help="Path to the PDF file")
    parser.add_argument(
        "--output-dir",
        type=Path,
        help="Optional output directory for extracted images",
    )
    parser.add_argument("-v", "--verbose", action="count", default=0)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """Run the image extraction CLI."""

    parser = build_parser()
    args = parser.parse_args(argv)
    _configure_logging(args.verbose)

    images = extract_images(args.pdf_path, args.output_dir)
    logging.info("Extracted %d image(s) from %s", len(images), args.pdf_path)
    for image in images:
        logging.debug("%s", image.path)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
