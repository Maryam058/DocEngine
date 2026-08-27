"""Documentation QA Agent Skill runner.

Separate endpoint from api/ai-suggest.py (different feature, own
request/response contract), but uses the same Gemini provider and the
same GEMINI_API_KEY / GEMINI_MODEL env vars -- switched from Claude/
Anthropic because the Anthropic account backing ANTHROPIC_API_KEY ran
out of credits, and this project deliberately avoids running two
different paid providers for two AI features when one already works.
Runs the deterministic checks from
skills/documentation-qa/scripts/run_checks.py against a published
page, then asks Gemini to turn those findings plus the page's own
content into a short QA report, following
skills/documentation-qa/SKILL.md and templates/qa-report.md.
"""

from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

import json
import os
import socket
import subprocess
import sys
import time


# ==========================================================
# Configuration
# ==========================================================

ALLOWED_ORIGINS = {
    "https://maryam058.github.io",
    "https://doc-engine-nu.vercel.app",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
}

# Same env var api/ai-suggest.py reads -- one Gemini key backs both
# AI features in this project. Deliberately not a second, competing
# key variable: there's no reason for the QA report generator to use
# a different Google account/key than AI Suggestion does.
GEMINI_MODEL = os.environ.get(
    "GEMINI_MODEL",
    "gemini-flash-latest"
)

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"

MAX_REPORT_TOKENS = 2048
MAX_DOCUMENT_CHARS = 20000

REQUEST_TIMEOUT_SECONDS = 25.0
SCRIPT_TIMEOUT_SECONDS = 15.0

# Same retry policy as api/ai-suggest.py's Gemini calls: 429 is rate
# limiting, 503 is Gemini's transient-overload status. Auth/invalid-
# request/model-not-found errors are never retried.
MAX_PROVIDER_RETRIES = 2
RETRY_BACKOFF_BASE_SECONDS = 0.5
RETRYABLE_HTTP_STATUSES = (429, 503)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = PROJECT_ROOT / "docs"
SKILL_DIR = PROJECT_ROOT / "skills" / "documentation-qa"
SKILL_MD_PATH = SKILL_DIR / "SKILL.md"
TEMPLATE_PATH = SKILL_DIR / "templates" / "qa-report.md"
RUN_CHECKS_SCRIPT = SKILL_DIR / "scripts" / "run_checks.py"


# ==========================================================
# CORS
# ==========================================================

def is_allowed_origin(origin):

    if not origin:
        return False

    if origin in ALLOWED_ORIGINS:
        return True

    if (
        origin.startswith("https://doc-engine-")
        and origin.endswith(".vercel.app")
    ):
        return True

    return False


# ==========================================================
# Errors / Logging
# ==========================================================

class AIProviderError(RuntimeError):
    """Carries the HTTP status the handler should send to the browser,
    separately from the human-readable message."""

    def __init__(self, status_code, message):

        super().__init__(message)

        self.status_code = status_code


def log_diagnostic(label, detail):

    # Server-side only (Vercel function logs) -- never sent to the
    # browser. Never pass the API key or full document text here.

    print(f"[agent-skill] {label}: {detail}"[:800], flush=True)


def _extract_gemini_error_message(error_body):

    try:

        return (
            json.loads(error_body).get("error", {}).get("message")
            or "(no message)"
        )

    except (json.JSONDecodeError, AttributeError):

        return "(unparseable error body)"


# ==========================================================
# Document Path Resolution
# ==========================================================

def resolve_document_path(raw_path):
    """Resolve a frontend-supplied site path (e.g.
    "/UserGuide/manage-appointments/", from the current page's URL)
    to a real Markdown source file inside docs/. Returns the resolved
    Path, or None if no matching published file exists. Never
    resolves to a path outside DOCS_DIR."""

    if not raw_path:
        return None

    path = raw_path.split("?", 1)[0].split("#", 1)[0]

    if "://" in path:
        _, _, remainder = path.partition("://")
        _, _, path = remainder.partition("/")

    path = path.strip("/")

    docs_dir_resolved = DOCS_DIR.resolve()

    candidates = (
        [docs_dir_resolved / "index.md"]
        if not path
        else [
            docs_dir_resolved / f"{path}.md",
            docs_dir_resolved / path / "index.md",
        ]
    )

    for candidate in candidates:

        resolved = candidate.resolve()

        try:
            resolved.relative_to(docs_dir_resolved)
        except ValueError:
            continue

        if resolved.is_file():
            return resolved

    return None


# ==========================================================
# Deterministic Checks
# ==========================================================

def run_deterministic_checks(target_file):

    try:

        result = subprocess.run(
            [sys.executable, str(RUN_CHECKS_SCRIPT), str(target_file)],
            capture_output=True,
            text=True,
            timeout=SCRIPT_TIMEOUT_SECONDS,
        )

    except subprocess.TimeoutExpired:

        raise AIProviderError(
            500,
            "Documentation QA checks timed out while running."
        )

    try:

        return json.loads(result.stdout)

    except json.JSONDecodeError:

        log_diagnostic(
            "run_checks non-JSON output",
            (result.stdout + result.stderr)[:500]
        )

        raise AIProviderError(
            500,
            "Documentation QA checks failed to run."
        )


# ==========================================================
# Prompt Building
# ==========================================================

def read_text_file(path):

    try:
        return path.read_text(encoding="utf-8")

    except OSError:
        return ""


def build_report_request(deterministic, document_text, document_label):

    skill_instructions = read_text_file(SKILL_MD_PATH)
    template = read_text_file(TEMPLATE_PATH)

    system_prompt = (
        skill_instructions
        or "You are a documentation QA assistant for DocEngine."
    )

    truncated_text = document_text[:MAX_DOCUMENT_CHARS]
    truncation_note = (
        "\n\n[... document truncated for length ...]"
        if len(document_text) > MAX_DOCUMENT_CHARS
        else ""
    )

    user_message = (
        f"REPORT TEMPLATE:\n{template}\n\n"
        "DETERMINISTIC FINDINGS (ground truth -- restate faithfully, "
        "never contradict a pass/fail verdict from this JSON):\n"
        f"{json.dumps(deterministic)}\n\n"
        f"DOCUMENT: {document_label}\n\n"
        f"DOCUMENT CONTENT:\n{truncated_text}{truncation_note}"
    )

    return system_prompt, user_message


# ==========================================================
# AI Request (Google Gemini)
# ==========================================================

def call_gemini(api_key, system_prompt, user_message):

    url = (
        f"{GEMINI_API_BASE}/models/{GEMINI_MODEL}:generateContent"
        f"?key={api_key}"
    )

    request_body = {

        "systemInstruction": {
            "parts": [
                {"text": system_prompt}
            ]
        },

        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": user_message}
                ]
            }
        ],

        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": MAX_REPORT_TOKENS,

            # Same reasoning as api/ai-suggest.py: this is a
            # template-filling task, not open-ended reasoning, so
            # keep thinking minimal for a fast, reliable response.
            # "thinkingLevel" (not the legacy "thinkingBudget") is
            # the field gemini-flash-latest's current Gemini 3.x
            # target actually respects; "low" is the lowest level
            # confirmed to work for this model (see
            # api/ai-suggest.py's call_gemini for why "minimal" was
            # rejected).
            "thinkingConfig": {
                "thinkingLevel": "low"
            }
        }

    }

    request_body_bytes = json.dumps(request_body).encode("utf-8")

    log_diagnostic(
        "provider config",
        f"provider=gemini sdk=rest(urllib) endpoint={GEMINI_API_BASE} "
        f"model={GEMINI_MODEL} timeout_s={REQUEST_TIMEOUT_SECONDS}"
    )

    attempt = 0

    while True:

        attempt += 1

        request = Request(

            url,

            data=request_body_bytes,

            headers={
                "Content-Type": "application/json"
            },

            method="POST"

        )

        log_diagnostic(
            "provider request started",
            f"model={GEMINI_MODEL} attempt={attempt}/{MAX_PROVIDER_RETRIES + 1}"
        )

        started_at = time.monotonic()

        try:

            with urlopen(
                request,
                timeout=REQUEST_TIMEOUT_SECONDS
            ) as response:

                response_body = response.read().decode("utf-8")

                log_diagnostic(
                    "provider response",
                    f"status={response.status} attempt={attempt} "
                    f"duration_ms={int((time.monotonic() - started_at) * 1000)}"
                )

            break

        except HTTPError as error:

            error_body = error.read().decode("utf-8")
            duration_ms = int((time.monotonic() - started_at) * 1000)

            provider_message = _extract_gemini_error_message(error_body)

            log_diagnostic(
                f"provider error type=http status={error.code}",
                f"attempt={attempt} duration_ms={duration_ms} "
                f"message={provider_message!r}"
            )

            if (
                error.code in RETRYABLE_HTTP_STATUSES
                and attempt <= MAX_PROVIDER_RETRIES
            ):

                backoff_seconds = (
                    RETRY_BACKOFF_BASE_SECONDS * (2 ** (attempt - 1))
                )

                log_diagnostic(
                    "provider retry",
                    f"status={error.code} attempt={attempt} "
                    f"backoff_s={backoff_seconds}"
                )

                time.sleep(backoff_seconds)

                continue

            raise describe_gemini_error(error.code, error_body)

        except (URLError, socket.timeout) as error:

            reason = getattr(error, "reason", error)

            is_timeout = (
                isinstance(reason, socket.timeout)
                or "timed out" in str(reason).lower()
            )

            log_diagnostic(
                f"provider error type={'timeout' if is_timeout else 'network'}",
                f"attempt={attempt} "
                f"duration_ms={int((time.monotonic() - started_at) * 1000)} "
                f"reason={reason!r}"
            )

            if is_timeout:

                raise AIProviderError(
                    504,
                    "The AI provider request timed out. Please try again."
                )

            raise AIProviderError(
                502,
                "Could not reach the AI provider (network error)."
            )

    try:

        data = json.loads(response_body)

    except json.JSONDecodeError:

        log_diagnostic("Gemini non-JSON 200 response", response_body)

        raise AIProviderError(
            502,
            "The AI provider returned an invalid response."
        )

    return extract_gemini_text(data)


def describe_gemini_error(status_code, error_body):
    """Turns a Gemini HTTPError into an AIProviderError whose message
    distinguishes the failure category without leaking the API key or
    raw internal error payloads. Mirrors api/ai-suggest.py's
    describe_gemini_error -- same provider, same error taxonomy."""

    message = None
    reason = None

    try:

        parsed = json.loads(error_body)
        error_obj = parsed.get("error", {}) or {}

        message = error_obj.get("message")
        reason = error_obj.get("status")

        for detail in error_obj.get("details", []) or []:

            if detail.get("reason"):
                reason = reason or detail["reason"]

    except (json.JSONDecodeError, AttributeError):

        pass

    # --- Invalid / missing key -----------------------------------

    if reason == "API_KEY_INVALID" or (
        status_code in (400, 401) and message and "api key" in message.lower()
    ):

        return AIProviderError(
            401,
            "The configured GEMINI_API_KEY is invalid. "
            "Check the key value in Vercel's environment variables."
        )

    # --- Permission / access problem -------------------------------

    if status_code == 403 or reason in (
        "PERMISSION_DENIED",
        "CONSUMER_SUSPENDED",
        "SERVICE_DISABLED",
    ):

        return AIProviderError(
            403,
            "The configured GEMINI_API_KEY does not have permission "
            f"to use the model '{GEMINI_MODEL}' (or the Generative "
            "Language API is not enabled for this key's project)."
        )

    # --- Model not found / not available ---------------------------

    if status_code == 404 or reason == "NOT_FOUND":

        return AIProviderError(
            500,
            f"The configured Gemini model ('{GEMINI_MODEL}') was not "
            "found or is not available to this API key. Set the "
            "GEMINI_MODEL environment variable to a model this key "
            "can access."
        )

    # --- Rate limit / quota -----------------------------------------

    if status_code == 429 or reason == "RESOURCE_EXHAUSTED":

        return AIProviderError(
            429,
            "Gemini rate limit or quota exceeded. Please try again "
            "shortly."
        )

    # --- Bad request (prompt/schema issue) --------------------------

    if status_code == 400:

        return AIProviderError(
            502,
            "The AI provider rejected the request "
            f"({message or 'invalid request'})."
        )

    # --- Provider/server error ---------------------------------------

    if status_code >= 500:

        return AIProviderError(
            502,
            "The AI provider (Gemini) returned a server error "
            f"(HTTP {status_code}). Please try again."
        )

    return AIProviderError(
        502,
        f"AI provider request failed ({status_code}): "
        f"{message or 'unknown error'}"
    )


def extract_gemini_text(data):

    candidates = data.get("candidates") or []

    if not candidates:

        feedback = data.get("promptFeedback", {})

        block_reason = feedback.get("blockReason")

        log_diagnostic("Gemini empty candidates", data)

        if block_reason:

            raise AIProviderError(
                502,
                "The AI provider blocked this request "
                f"({block_reason})."
            )

        raise AIProviderError(502, "AI returned an empty response.")

    first_candidate = candidates[0]

    finish_reason = first_candidate.get("finishReason")

    parts = (
        first_candidate.get("content", {}).get("parts", [])
    )

    text = "".join(
        part.get("text", "")
        for part in parts
    ).strip()

    if not text:

        log_diagnostic(
            "Gemini empty text",
            f"finishReason={finish_reason} candidate={first_candidate}"
        )

        if finish_reason and finish_reason not in ("STOP", "MAX_TOKENS"):

            raise AIProviderError(
                502,
                "The AI provider did not return usable text "
                f"({finish_reason})."
            )

        raise AIProviderError(502, "AI returned an empty response.")

    return text


def request_qa_report(deterministic, document_text, document_label):

    api_key = os.environ.get("GEMINI_API_KEY")

    log_diagnostic(
        "selected provider/model",
        f"provider=gemini model={GEMINI_MODEL} "
        f"api_key_detected={bool(api_key)}"
    )

    if not api_key:

        raise AIProviderError(
            500,
            "The AI Agent panel is not configured on the server "
            "(missing GEMINI_API_KEY)."
        )

    system_prompt, user_message = build_report_request(
        deterministic,
        document_text,
        document_label
    )

    return call_gemini(api_key, system_prompt, user_message)


# ==========================================================
# Validation
# ==========================================================

def validate_payload(payload):

    document_path = (payload.get("document_path") or "").strip()

    if not document_path:
        return "A document_path is required."

    return None


# ==========================================================
# Vercel Function
# ==========================================================

class handler(BaseHTTPRequestHandler):

    # ======================================================
    # CORS Headers
    # ======================================================

    def send_cors_headers(self):

        origin = self.headers.get("Origin", "")

        if is_allowed_origin(origin):

            self.send_header(
                "Access-Control-Allow-Origin",
                origin
            )

        self.send_header(
            "Access-Control-Allow-Methods",
            "POST, OPTIONS, GET"
        )

        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type"
        )

        self.send_header(
            "Access-Control-Max-Age",
            "86400"
        )

        self.send_header(
            "Vary",
            "Origin"
        )

    # ======================================================
    # JSON Response
    # ======================================================

    def send_json(self, status_code, data):

        response = json.dumps(data).encode("utf-8")

        self.send_response(status_code)

        self.send_header(
            "Content-Type",
            "application/json"
        )

        self.send_cors_headers()

        self.end_headers()

        self.wfile.write(response)

    # ======================================================
    # GET
    # ======================================================

    def do_GET(self):

        self.send_json(
            200,
            {
                "success": True,
                "message": "DocEngine Agent Skill API is running.",
                "method": "GET"
            }
        )

    # ======================================================
    # OPTIONS
    # ======================================================

    def do_OPTIONS(self):

        origin = self.headers.get("Origin", "")

        if origin and not is_allowed_origin(origin):

            self.send_response(403)

            self.send_header("Vary", "Origin")

            self.end_headers()

            return

        self.send_response(204)

        self.send_cors_headers()

        self.end_headers()

    # ======================================================
    # POST
    # ======================================================

    def do_POST(self):

        try:

            content_length = int(
                self.headers.get("Content-Length", "0")
            )

            body = self.rfile.read(content_length)

            payload = json.loads(body.decode("utf-8"))

        except (ValueError, json.JSONDecodeError):

            self.send_json(
                400,
                {
                    "success": False,
                    "message": "Invalid request body."
                }
            )

            return

        document_path = (payload.get("document_path") or "").strip()

        log_diagnostic(
            "request received",
            f"skill=documentation-qa document_path={document_path!r}"
        )

        validation_error = validate_payload(payload)

        if validation_error:

            self.send_json(
                400,
                {
                    "success": False,
                    "message": validation_error
                }
            )

            return

        target_file = resolve_document_path(document_path)

        if target_file is None:

            self.send_json(
                404,
                {
                    "success": False,
                    "message": (
                        f"Could not find a published page for "
                        f"'{document_path}'. Documentation QA checks "
                        "the last-published version of a page -- save "
                        "and publish it at least once first."
                    )
                }
            )

            return

        try:

            deterministic = run_deterministic_checks(target_file)

            document_text = read_text_file(target_file)

            started_at = time.monotonic()

            report_text = request_qa_report(
                deterministic,
                document_text,
                deterministic.get("file", document_path)
            )

            duration_ms = int((time.monotonic() - started_at) * 1000)

            self.send_json(
                200,
                {
                    "success": True,
                    "model": GEMINI_MODEL,
                    "deterministic": deterministic,
                    "report": report_text,
                    "duration_ms": duration_ms,
                }
            )

        except AIProviderError as error:

            print("Agent skill error:", error, flush=True)

            self.send_json(
                error.status_code,
                {
                    "success": False,
                    "message": str(error) or "Agent skill run failed."
                }
            )

        except Exception as error:

            # Anything not already classified into an AIProviderError
            # (a genuine bug, not a known Gemini failure mode).

            print("Agent skill unexpected error:", error, flush=True)

            self.send_json(
                500,
                {
                    "success": False,
                    "message": "Agent skill run failed unexpectedly."
                }
            )
