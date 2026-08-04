"""Shared paths and package metadata for DocEngine automation tools."""

from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = PACKAGE_DIR.parent
DOCS_DIR = PROJECT_ROOT / "docs"
USER_GUIDE_DIR = DOCS_DIR / "UserGuide"
ASSETS_DIR = DOCS_DIR / "assets"
API_DIR = DOCS_DIR / "api"
RELEASE_NOTES_DIR = DOCS_DIR / "release-notes"
