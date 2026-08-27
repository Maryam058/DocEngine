"""Deterministic checks for the documentation-qa Agent Skill.

Runnable directly:

    python run_checks.py <path-to-markdown-file>

Prints one JSON object to stdout and always exits 0 -- findings are
data for the caller (the skill / the agent-skill API) to interpret,
not a process failure. Makes no network calls and never modifies the
target file.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parents[2]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from tools.validate_docs import validate_docs  # noqa: E402


MANUAL_ANCHOR_PATTERN = re.compile(r"\[¶\]\(#[^)]*\)")

# Terms with zero legitimate use anywhere in this project's verified
# product terminology (docs/glossary.md defines "Patient" and
# "Provider" as the only correct terms for these two concepts) --
# flagging them is safe with no known false positives. Other
# discouraged swaps noted in project history ("visit" / "booking" as
# stand-ins for "appointment") are deliberately NOT included here:
# both have legitimate, verified uses in this project's real UI copy
# ("Reason for Visit", "Book Appointment"), so a reliable deterministic
# check isn't possible without false positives -- that judgment is
# left to the skill's qualitative review step instead.
BANNED_TERMS = {
    "client": "patient",
    "practitioner": "provider",
    "practitioners": "providers",
}


def _relative_label(path: Path) -> str:
    try:
        return str(path.relative_to(PROJECT_ROOT))
    except ValueError:
        return str(path)


def _check_structural_issues(target_file: Path) -> list[dict]:
    """Reuse tools.validate_docs for link/image/heading/table/nav checks,
    filtered down to the entries that belong to the target file."""

    report = validate_docs()
    target_prefix = f"{target_file.resolve()}:"

    def _own_entries(entries: list[str]) -> list[str]:
        return [entry for entry in entries if entry.startswith(target_prefix)]

    groups = (
        ("broken-internal-links", report.broken_internal_links + report.missing_markdown_files),
        ("broken-image-links", report.broken_image_links),
        ("invalid-relative-paths", report.invalid_relative_paths),
        ("heading-structure", report.heading_issues),
        ("table-structure", report.table_issues),
    )

    checks = []
    for check_id, entries in groups:
        own = _own_entries(entries)
        checks.append({
            "id": check_id,
            "status": "fail" if own else "pass",
            "detail": (
                "; ".join(item.split(":", 1)[1].strip() for item in own)
                if own
                else "no issues found"
            ),
        })

    nav_hits = [
        entry for entry in report.missing_mkdocs_references
        if _relative_label(target_file).replace("\\", "/") in entry.replace("\\", "/")
    ]
    checks.append({
        "id": "nav-reference",
        "status": "fail" if nav_hits else "pass",
        "detail": "; ".join(nav_hits) if nav_hits else "no nav reference issues found",
    })

    return checks


def _check_manual_anchors(markdown_text: str) -> dict:
    matches = MANUAL_ANCHOR_PATTERN.findall(markdown_text)
    return {
        "id": "no-manual-anchors",
        "status": "fail" if matches else "pass",
        "detail": (
            f"found {len(matches)} manually-authored heading anchor(s) "
            "(e.g. \"[¶](#...)\") -- MkDocs Material generates these "
            "automatically; remove them from the source"
            if matches
            else "no manually-authored heading anchors found"
        ),
    }


def _check_terminology(markdown_text: str) -> dict:
    hits = []
    for term, correct in BANNED_TERMS.items():
        for match in re.finditer(rf"\b{re.escape(term)}\b", markdown_text, re.IGNORECASE):
            line_number = markdown_text.count("\n", 0, match.start()) + 1
            hits.append(f"line {line_number}: \"{match.group(0)}\" (use \"{correct}\")")

    return {
        "id": "terminology-consistency",
        "status": "fail" if hits else "pass",
        "detail": (
            "; ".join(hits)
            if hits
            else "no banned terms found (checked: " + ", ".join(sorted(set(BANNED_TERMS))) + ")"
        ),
    }


def run_checks(target_path: str) -> dict:
    target_file = Path(target_path).resolve()

    if not target_file.is_file():
        return {
            "file": target_path,
            "checks": [{
                "id": "file-exists",
                "status": "fail",
                "detail": f"file not found: {target_path}",
            }],
            "summary": {"pass": 0, "fail": 1},
        }

    markdown_text = target_file.read_text(encoding="utf-8")

    checks = _check_structural_issues(target_file)
    checks.append(_check_manual_anchors(markdown_text))
    checks.append(_check_terminology(markdown_text))

    passed = sum(1 for c in checks if c["status"] == "pass")
    failed = sum(1 for c in checks if c["status"] == "fail")

    return {
        "file": _relative_label(target_file).replace("\\", "/"),
        "checks": checks,
        "summary": {"pass": passed, "fail": failed},
    }


def main() -> int:
    if len(sys.argv) != 2:
        print(
            json.dumps({
                "file": None,
                "checks": [{
                    "id": "usage",
                    "status": "fail",
                    "detail": "usage: python run_checks.py <path-to-markdown-file>",
                }],
                "summary": {"pass": 0, "fail": 1},
            }),
            flush=True,
        )
        return 0

    result = run_checks(sys.argv[1])
    print(json.dumps(result), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
