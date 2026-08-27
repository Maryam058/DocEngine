---
name: documentation-qa
description: Reviews a single DocEngine Markdown page for structural problems (broken links, broken images, missing nav references, heading issues) and writing-quality problems (manually-authored heading anchors, terminology that drifts from docs/glossary.md), then produces a short QA report combining deterministic findings with reasoned commentary. Use when a user asks to check, review, audit, or QA a documentation page before publishing.
license: Proprietary
---

# Documentation QA

## Purpose

Give an editor a fast, trustworthy quality check on one Markdown page before it's published, without requiring a human to manually re-read the whole style guide every time.

## Instructions

1. Run the deterministic checks first, always:

   ```
   python skills/documentation-qa/scripts/run_checks.py <path-to-markdown-file>
   ```

   This prints one JSON object to stdout: `{"file": ..., "checks": [{"id", "status", "detail"}, ...], "summary": {"pass", "fail"}}`. It never calls a network and never modifies the file. Treat every `status` value in its output as ground truth — do not re-derive, second-guess, or contradict a `pass`/`fail` verdict from the script. Your job is to explain and contextualize those results, not to re-run the checks yourself by eye.

2. Read the target Markdown file's content directly for the qualitative parts of the review — the deterministic script does not check clarity, tone, or step-by-step quality. Do not invent facts about the page's subject matter; if something can't be verified from the file itself or the project's own reference docs (`docs/style-guide.md`, `docs/glossary.md`), say so rather than guessing.

3. Produce a report following the structure in `templates/qa-report.md`. Fill in every section. Keep the **Deterministic Findings** section a faithful, literal restatement of the script's JSON — one line per check. Use the **Style & Terminology Review** section for your own reasoning: heading/procedure structure against `docs/style-guide.md`, terminology consistency against `docs/glossary.md`, and anything unclear or unverifiable. In **Recommendation**, give one clear verdict: Ready to publish, Needs minor fixes, or Needs significant rework — and say why in one or two sentences.

4. Keep the whole report short enough to read in under a minute. This is a pre-publish gate, not a rewrite of the document.

## When to use this skill

- Before submitting a document for Human Review in DocEngine's editorial workflow.
- After a large edit to an existing page, to catch broken links/anchors introduced by the edit.
- Whenever a user explicitly asks to "check", "review", "audit", or "QA" a documentation page.

## Files in this skill

- `scripts/run_checks.py` — deterministic checks (see step 1 above). Reuses `tools/validate_docs.py`'s link/image/heading/nav validation and adds two DocEngine-specific checks: manually-authored heading anchors (`[¶](#...)`) and terminology drift against the glossary.
- `templates/qa-report.md` — the report structure every run must follow.
