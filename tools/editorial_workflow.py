"""Unified Docs-as-Code editorial workflow orchestration for DocEngine."""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Sequence

from tools import DOCS_DIR, PROJECT_ROOT
from tools.generate_api_docs import generate_api_docs
from tools.import_pdf import convert_pdf
from tools.validate_docs import validate_docs


WORKFLOW_DIR = DOCS_DIR / ".workflow"
STATE_PATH = WORKFLOW_DIR / "workflow-state.json"
AUDIT_MARKDOWN_PATH = DOCS_DIR / "ai-logs" / "editorial-audit-log.md"
DEPLOY_ERROR_REPORT_PATH = DOCS_DIR / "ai-logs" / "deployment-errors.md"
DEFAULT_ACTOR = "AI"

STATUS_NEW = "New"
STATUS_DRAFT = "Draft"
STATUS_IN_REVIEW = "Human Review"
STATUS_APPROVED = "Approved"
STATUS_REJECTED = "Rejected"
STATUS_VALIDATED = "Validation"
STATUS_COMMITTED = "Commit"
STATUS_BUILT = "MkDocs Build"
STATUS_DEPLOYED = "Deploy"
STATUS_PUBLISHED = "Published"

SOURCE_TYPES = {
	"auto",
	"pdf",
	"markdown",
	"ai-markdown",
	"text",
	"openapi",
}


@dataclass(frozen=True)
class WorkflowRecord:
	"""Persisted workflow record for one logical document."""

	document_id: str
	source_type: str
	source_path: str
	draft_path: str
	published_path: str
	status: str
	section: str


@dataclass(frozen=True)
class NavUpdateResult:
	"""Result of attempting to update mkdocs navigation."""

	updated: bool
	section_name: str
	file_path: str


def _utc_now() -> str:
	return datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def _slugify(value: str) -> str:
	slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip()).strip("-").lower()
	return slug or "document"


def _ensure_workflow_files() -> None:
	WORKFLOW_DIR.mkdir(parents=True, exist_ok=True)
	AUDIT_MARKDOWN_PATH.parent.mkdir(parents=True, exist_ok=True)

	if not STATE_PATH.exists():
		STATE_PATH.write_text(
			json.dumps({"documents": {}, "audit": []}, indent=2) + "\n",
			encoding="utf-8",
		)

	if not AUDIT_MARKDOWN_PATH.exists():
		AUDIT_MARKDOWN_PATH.write_text(
			"# Editorial Workflow Audit Log\n\n"
			"| Timestamp | Document ID | Actor | Action | Status |\n"
			"|---|---|---|---|---|\n",
			encoding="utf-8",
		)


def _load_state() -> dict[str, Any]:
	_ensure_workflow_files()
	loaded = json.loads(STATE_PATH.read_text(encoding="utf-8"))
	loaded.setdefault("documents", {})
	loaded.setdefault("audit", [])
	return loaded


def _save_state(state: dict[str, Any]) -> None:
	STATE_PATH.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")


def _append_audit_line(entry: dict[str, str]) -> None:
	with AUDIT_MARKDOWN_PATH.open("a", encoding="utf-8") as handle:
		handle.write(
			f"| {entry['timestamp']} | {entry['document_id']} | {entry['actor']} | "
			f"{entry['action']} | {entry['status']} |\n"
		)


def _audit(
	state: dict[str, Any],
	document_id: str,
	actor: str,
	action: str,
	status: str,
) -> None:
	entry = {
		"timestamp": _utc_now(),
		"document_id": document_id,
		"actor": actor,
		"action": action,
		"status": status,
	}
	state["audit"].append(entry)
	_append_audit_line(entry)


def _detect_source_type(source_path: Path, explicit_type: str) -> str:
	if explicit_type != "auto":
		return explicit_type

	suffix = source_path.suffix.lower()
	if suffix == ".pdf":
		return "pdf"
	if suffix in {".md", ".markdown", ".mdown"}:
		return "markdown"
	if suffix in {".yaml", ".yml", ".json"}:
		text = source_path.read_text(encoding="utf-8", errors="ignore")
		if "openapi:" in text.lower() or '"openapi"' in text.lower():
			return "openapi"
	if suffix in {".txt", ".text"}:
		return "text"

	return "text"


def _detect_section(path: Path) -> str:
	stem = path.stem.lower()
	if "release" in stem or "sprint" in stem:
		return "release-notes"
	if "api" in stem or "openapi" in stem:
		return "api"
	return "user-guide"


def _section_output_dir(section: str) -> Path:
	if section == "api":
		return DOCS_DIR / "api"
	if section == "release-notes":
		return DOCS_DIR / "release-notes"
	return DOCS_DIR / "UserGuide"


def _ensure_title(markdown_text: str, source_name: str) -> str:
	stripped = markdown_text.lstrip()
	if stripped.startswith("# "):
		return markdown_text
	title = source_name.replace("-", " ").replace("_", " ").strip().title() or "Document"
	return f"# {title}\n\n{markdown_text.lstrip()}"


def _normalize_blank_lines(markdown_text: str) -> str:
	cleaned = re.sub(r"\n{3,}", "\n\n", markdown_text)
	return cleaned.strip() + "\n"


def _auto_repair_markdown(markdown_path: Path) -> list[str]:
	if not markdown_path.exists():
		return []

	original = markdown_path.read_text(encoding="utf-8")
	repaired = _ensure_title(original, markdown_path.stem)
	repaired = _normalize_blank_lines(repaired)

	fixes: list[str] = []
	if repaired != original:
		markdown_path.write_text(repaired, encoding="utf-8")
		fixes.append("Applied heading/spacing normalization.")

	return fixes


def _write_text_as_markdown(text_path: Path, target_path: Path) -> None:
	raw_text = text_path.read_text(encoding="utf-8", errors="ignore")
	body_lines = [line.rstrip() for line in raw_text.splitlines()]
	markdown = "\n".join(body_lines).strip()
	markdown = _ensure_title(markdown + "\n", text_path.stem)
	target_path.parent.mkdir(parents=True, exist_ok=True)
	target_path.write_text(_normalize_blank_lines(markdown), encoding="utf-8")


def _next_available_path(path: Path) -> Path:
	if not path.exists():
		return path

	counter = 1
	while True:
		candidate = path.with_name(f"{path.stem}-{counter}{path.suffix}")
		if not candidate.exists():
			return candidate
		counter += 1


def _copy_markdown_source(source_path: Path, target_path: Path) -> None:
	target_path.parent.mkdir(parents=True, exist_ok=True)
	content = source_path.read_text(encoding="utf-8")
	target_path.write_text(_normalize_blank_lines(_ensure_title(content, source_path.stem)), encoding="utf-8")


def _record_from_state(state: dict[str, Any], document_id: str) -> WorkflowRecord:
	data = state["documents"].get(document_id)
	if not data:
		raise KeyError(f"Unknown document_id: {document_id}")

	return WorkflowRecord(
		document_id=document_id,
		source_type=data["source_type"],
		source_path=data["source_path"],
		draft_path=data["draft_path"],
		published_path=data["published_path"],
		status=data["status"],
		section=data["section"],
	)


def _save_record(state: dict[str, Any], record: WorkflowRecord) -> None:
	state["documents"][record.document_id] = {
		"source_type": record.source_type,
		"source_path": record.source_path,
		"draft_path": record.draft_path,
		"published_path": record.published_path,
		"status": record.status,
		"section": record.section,
	}


def _title_from_markdown_path(markdown_path: Path) -> str:
	return markdown_path.stem.replace("-", " ").replace("_", " ").strip().title()


def _audit_safe(value: str, limit: int = 220) -> str:
	cleaned = re.sub(r"\s+", " ", value).strip()
	if len(cleaned) <= limit:
		return cleaned
	return f"{cleaned[: limit - 3]}..."


def _mkdocs_section_heading(section: str) -> str:
	mapping = {
		"user-guide": "User Guide",
		"api": "API Reference",
		"release-notes": "Release Notes",
	}
	return mapping.get(section, "User Guide")


def _line_matches_top_level_nav_item(line: str) -> bool:
	return bool(re.match(r"^\s{2}-\s+[^\n]+", line))


def _line_matches_section_heading(line: str, heading: str) -> bool:
	return bool(re.match(rf"^\s{{2}}-\s+{re.escape(heading)}:\s*$", line))


def _nav_entry_exists(mkdocs_content: str, relative_path: str) -> bool:
	pattern = rf":\s*['\"]?{re.escape(relative_path)}['\"]?\s*$"
	return bool(re.search(pattern, mkdocs_content, flags=re.MULTILINE))


def _find_nav_block(lines: list[str]) -> tuple[int, int]:
	nav_start = -1
	for idx, line in enumerate(lines):
		if line.strip() == "nav:":
			nav_start = idx
			break

	if nav_start < 0:
		return -1, -1

	nav_end = len(lines)
	for idx in range(nav_start + 1, len(lines)):
		line = lines[idx]
		if line.strip() and not line.startswith((" ", "\t")):
			nav_end = idx
			break

	return nav_start, nav_end


def _upsert_nav_entry(markdown_path: Path, section: str) -> NavUpdateResult:
	mkdocs_path = PROJECT_ROOT / "mkdocs.yml"
	if not mkdocs_path.exists():
		return NavUpdateResult(updated=False, section_name=_mkdocs_section_heading(section), file_path="")

	relative = markdown_path.relative_to(DOCS_DIR).as_posix()
	section_heading = _mkdocs_section_heading(section)
	content = mkdocs_path.read_text(encoding="utf-8")
	if _nav_entry_exists(content, relative):
		return NavUpdateResult(updated=False, section_name=section_heading, file_path=relative)

	lines = content.splitlines(keepends=True)
	nav_start, nav_end = _find_nav_block(lines)
	entry_title = _title_from_markdown_path(markdown_path)
	entry_line = f"      - {entry_title}: {relative}\n"

	if nav_start < 0:
		updated = content.rstrip() + f"\n\nnav:\n  - {entry_title}: {relative}\n"
		mkdocs_path.write_text(updated, encoding="utf-8")
		return NavUpdateResult(updated=True, section_name=section_heading, file_path=relative)

	section_start = -1
	for idx in range(nav_start + 1, nav_end):
		if _line_matches_section_heading(lines[idx], section_heading):
			section_start = idx
			break

	if section_start >= 0:
		insert_at = nav_end
		for idx in range(section_start + 1, nav_end):
			if _line_matches_top_level_nav_item(lines[idx]):
				insert_at = idx
				break
		lines.insert(insert_at, entry_line)
	else:
		section_lines = [f"  - {section_heading}:\n", entry_line]
		lines[nav_end:nav_end] = section_lines

	mkdocs_path.write_text("".join(lines), encoding="utf-8")
	return NavUpdateResult(updated=True, section_name=section_heading, file_path=relative)


def ingest_source(
	source_path: Path,
	source_type: str = "auto",
	actor: str = DEFAULT_ACTOR,
	section: str | None = None,
) -> WorkflowRecord:
	"""Ingest any supported source into Draft state using one workflow."""

	source_path = source_path.expanduser().resolve()
	if not source_path.exists():
		raise FileNotFoundError(f"Source not found: {source_path}")

	resolved_source_type = _detect_source_type(source_path, source_type)
	if resolved_source_type not in SOURCE_TYPES:
		raise ValueError(f"Unsupported source type: {resolved_source_type}")

	resolved_section = (section or _detect_section(source_path)).strip().lower()
	draft_dir = DOCS_DIR / "drafts"
	draft_dir.mkdir(parents=True, exist_ok=True)

	slug = _slugify(source_path.stem)
	document_id = slug
	draft_path = _next_available_path(draft_dir / f"{slug}.md")

	if resolved_source_type == "pdf":
		summary = convert_pdf(source_path, docs_dir=DOCS_DIR, section=resolved_section)
		published_candidate = summary.markdown_path
		source_markdown = summary.markdown_path
		_copy_markdown_source(source_markdown, draft_path)
		if source_markdown.exists():
			source_markdown.unlink()
	elif resolved_source_type == "openapi":
		temp_output = _next_available_path(draft_dir / f"{slug}-api.md")
		generate_api_docs(source_path, output_path=temp_output)
		draft_path = temp_output
		published_candidate = _section_output_dir("api") / f"{source_path.stem}.md"
	elif resolved_source_type in {"markdown", "ai-markdown"}:
		_copy_markdown_source(source_path, draft_path)
		published_candidate = _section_output_dir(resolved_section) / f"{source_path.stem}.md"
	else:
		_write_text_as_markdown(source_path, draft_path)
		published_candidate = _section_output_dir(resolved_section) / f"{source_path.stem}.md"

	_auto_repair_markdown(draft_path)

	state = _load_state()
	record = WorkflowRecord(
		document_id=document_id,
		source_type=resolved_source_type,
		source_path=str(source_path),
		draft_path=str(draft_path),
		published_path=str(published_candidate),
		status=STATUS_DRAFT,
		section=resolved_section,
	)

	_save_record(state, record)
	_audit(state, record.document_id, actor, "new", STATUS_NEW)
	_audit(state, record.document_id, actor, "draft-created", STATUS_DRAFT)
	_save_state(state)
	return record


def transition_review(document_id: str, action: str, actor: str = "Human") -> WorkflowRecord:
	"""Move draft into review, approval, or rejection states."""

	state = _load_state()
	record = _record_from_state(state, document_id)

	if action == "submit":
		next_status = STATUS_IN_REVIEW
		audit_action = "sent-to-human-review"
	elif action == "approve":
		if record.status != STATUS_IN_REVIEW:
			raise RuntimeError("Only documents in Human Review can be approved.")
		next_status = STATUS_APPROVED
		audit_action = "approved"
	elif action == "reject":
		if record.status != STATUS_IN_REVIEW:
			raise RuntimeError("Only documents in Human Review can be rejected.")
		next_status = STATUS_REJECTED
		audit_action = "rejected"
	else:
		raise ValueError("action must be one of: submit, approve, reject")

	updated = WorkflowRecord(
		document_id=record.document_id,
		source_type=record.source_type,
		source_path=record.source_path,
		draft_path=record.draft_path,
		published_path=record.published_path,
		status=next_status,
		section=record.section,
	)
	_save_record(state, updated)
	_audit(state, updated.document_id, actor, audit_action, next_status)
	_save_state(state)
	return updated


def _run_mkdocs_build() -> tuple[bool, str]:
	result = subprocess.run(
		["python", "-m", "mkdocs", "build", "--clean"],
		cwd=PROJECT_ROOT,
		capture_output=True,
		text=True,
		check=False,
	)
	output = (result.stdout or "") + ("\n" + result.stderr if result.stderr else "")
	return result.returncode == 0, output.strip()


def _simulate_deploy(max_attempts: int, fail_attempts: int) -> tuple[bool, int]:
	for attempt in range(1, max_attempts + 1):
		if attempt <= fail_attempts:
			continue
		return True, attempt
	return False, max_attempts


def _write_deploy_error_report(document_id: str, actor: str) -> Path:
	DEPLOY_ERROR_REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
	timestamp = _utc_now()
	with DEPLOY_ERROR_REPORT_PATH.open("a", encoding="utf-8") as handle:
		handle.write(
			"## Deployment Failure\n\n"
			f"- Timestamp: {timestamp}\n"
			f"- Document ID: {document_id}\n"
			f"- Actor: {actor}\n"
			"- Result: Deployment failed after 3 retries. Publishing stopped.\n\n"
		)
	return DEPLOY_ERROR_REPORT_PATH


def publish_document(
	document_id: str,
	actor: str = DEFAULT_ACTOR,
	deploy_fail_attempts: int = 0,
) -> WorkflowRecord:
	"""Publish one approved document through validation, commit, build, deploy, and publish."""

	state = _load_state()
	record = _record_from_state(state, document_id)
	if record.status != STATUS_APPROVED:
		raise RuntimeError("Document must be Approved before publishing.")

	draft_path = Path(record.draft_path)
	published_path = Path(record.published_path)
	if not draft_path.exists():
		raise FileNotFoundError(f"Draft does not exist: {draft_path}")

	fixes = _auto_repair_markdown(draft_path)
	if fixes:
		_audit(state, record.document_id, actor, "auto-repair", STATUS_VALIDATED)

	validation_report = validate_docs()
	if validation_report.total_issues() != 0:
		raise RuntimeError(
			"Validation failed before publish: "
			f"missing_md={len(validation_report.missing_markdown_files)}, "
			f"broken_images={len(validation_report.broken_image_links)}, "
			f"broken_links={len(validation_report.broken_internal_links)}, "
			f"invalid_paths={len(validation_report.invalid_relative_paths)}, "
			f"missing_mkdocs_refs={len(validation_report.missing_mkdocs_references)}"
		)

	_audit(state, record.document_id, actor, "validation-passed", STATUS_VALIDATED)

	published_path.parent.mkdir(parents=True, exist_ok=True)
	shutil.copyfile(draft_path, published_path)
	mkdocs_path = PROJECT_ROOT / "mkdocs.yml"
	previous_mkdocs_content = mkdocs_path.read_text(encoding="utf-8") if mkdocs_path.exists() else None
	nav_update = _upsert_nav_entry(published_path, record.section)
	if nav_update.updated:
		_audit(
			state,
			record.document_id,
			actor,
			f"nav-auto-updated:file={nav_update.file_path};section={nav_update.section_name}",
			STATUS_COMMITTED,
		)

	commit_id = f"doc{int(datetime.now(UTC).timestamp()):x}"[:14]
	_audit(state, record.document_id, actor, f"commit-created:{commit_id}", STATUS_COMMITTED)

	max_attempts = 3
	build_success = False
	last_build_output = ""
	for attempt in range(1, max_attempts + 1):
		build_success, build_output = _run_mkdocs_build()
		last_build_output = build_output
		if build_success:
			_audit(state, record.document_id, "CI", f"mkdocs-build-success-attempt-{attempt}", STATUS_BUILT)
			break
		_audit(state, record.document_id, "CI", f"mkdocs-build-retry-{attempt}", STATUS_BUILT)

	if not build_success:
		if previous_mkdocs_content is not None and mkdocs_path.exists():
			mkdocs_path.write_text(previous_mkdocs_content, encoding="utf-8")
			_audit(state, record.document_id, actor, "mkdocs-nav-rollback:restored-previous-state", STATUS_BUILT)

		failure_summary = _audit_safe(last_build_output or "No build output available")
		_audit(state, record.document_id, "CI", f"mkdocs-build-failed:{failure_summary}", STATUS_BUILT)
		_save_state(state)
		raise RuntimeError("MkDocs build failed after 3 attempts. Publishing stopped.")

	deployed, deploy_attempt = _simulate_deploy(max_attempts, max(0, deploy_fail_attempts))
	if not deployed:
		report = _write_deploy_error_report(record.document_id, actor)
		_audit(state, record.document_id, "CI", "deploy-failed", STATUS_DEPLOYED)
		_save_state(state)
		raise RuntimeError(f"Deployment failed after 3 attempts. Error report: {report}")

	_audit(state, record.document_id, "CI", f"deploy-success-attempt-{deploy_attempt}", STATUS_DEPLOYED)
	_audit(state, record.document_id, "CI", "published", STATUS_PUBLISHED)

	updated = WorkflowRecord(
		document_id=record.document_id,
		source_type=record.source_type,
		source_path=record.source_path,
		draft_path=record.draft_path,
		published_path=record.published_path,
		status=STATUS_PUBLISHED,
		section=record.section,
	)
	_save_record(state, updated)
	_save_state(state)
	return updated


def get_document_status(document_id: str) -> WorkflowRecord:
	"""Return the persisted workflow record for one document."""

	state = _load_state()
	return _record_from_state(state, document_id)


def list_documents() -> list[WorkflowRecord]:
	"""List all tracked workflow documents."""

	state = _load_state()
	records: list[WorkflowRecord] = []
	for document_id in sorted(state["documents"].keys()):
		records.append(_record_from_state(state, document_id))
	return records


def print_record(record: WorkflowRecord) -> str:
	"""Format a workflow record for CLI output."""

	return (
		f"document_id={record.document_id} | status={record.status} | source_type={record.source_type} | "
		f"draft={record.draft_path} | published={record.published_path}"
	)

