from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

import json
import os
import socket
import subprocess
import sys
import tempfile
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

# Groq configuration. Keep the API key server-side in Vercel/local
# environment variables. Never expose it to browser JavaScript.
GROQ_MODEL = os.environ.get(
    "GROQ_MODEL",
    "openai/gpt-oss-20b"
)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

# The QA skill is intended to produce a short, readable report.
MAX_REPORT_TOKENS = 700
MAX_DOCUMENT_CHARS = 20000

# Cap an unpublished draft's raw length (before AI-prompt truncation)
# so a request body cannot be used to exhaust server resources.
MAX_DOCUMENT_CONTENT_CHARS = 50000

# Keep the provider call bounded so a serverless request cannot wait
# indefinitely. Network timeouts are not retried because repeating a
# genuine hang only multiplies the wait.
REQUEST_TIMEOUT_SECONDS = 15.0
SCRIPT_TIMEOUT_SECONDS = 15.0

# Retry transient provider overload/rate-limit responses only.
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
    """Carries the HTTP status the handler should send to the browser."""

    def __init__(self, status_code, message):
        super().__init__(message)
        self.status_code = status_code


def log_diagnostic(label, detail):
    # Server-side only. Never log API keys or full document text.
    print(f"[agent-skill] {label}: {detail}"[:1200], flush=True)


def extract_groq_error_message(error_body):
    try:
        data = json.loads(error_body)
        return (
            data.get("error", {}).get("message")
            or "(no message)"
        )
    except (json.JSONDecodeError, AttributeError, TypeError):
        return "(unparseable error body)"


def format_groq_error_diagnostic(error_body, api_key):
    """Redacted, truncated diagnostic of a Groq error response body.

    Only ever reads Groq's own response text -- never our request or
    its headers -- but still strips the configured key defensively in
    case Groq ever echoed it back. Never logs GROQ_API_KEY itself.
    """

    truncated_raw = error_body[:1000]

    try:
        error_obj = json.loads(error_body).get("error", {}) or {}

        if isinstance(error_obj, dict):
            diagnostic = (
                f"error.message={error_obj.get('message')!r} "
                f"error.type={error_obj.get('type')!r} "
                f"error.code={error_obj.get('code')!r} "
                f"raw={truncated_raw!r}"
            )
        else:
            diagnostic = None
    except (json.JSONDecodeError, AttributeError, TypeError):
        diagnostic = None

    if diagnostic is None:
        diagnostic = f"raw(non-json)={truncated_raw!r}"

    if api_key:
        diagnostic = diagnostic.replace(api_key, "[REDACTED]")

    return diagnostic


# ==========================================================
# Document Path Resolution
# ==========================================================

def resolve_document_path(raw_path):
    """Resolve a frontend-supplied site path to a Markdown file in docs/.

    Examples:
        /UserGuide/manage-appointments/
        /style-guide/
        /

    Never resolves to a path outside DOCS_DIR.
    """

    if not raw_path:
        return None

    path = raw_path.split("?", 1)[0].split("#", 1)[0]

    # Gracefully handle a full URL if one is supplied.
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
            [
                sys.executable,
                str(RUN_CHECKS_SCRIPT),
                str(target_file),
            ],
            capture_output=True,
            text=True,
            timeout=SCRIPT_TIMEOUT_SECONDS,
        )

    except subprocess.TimeoutExpired:
        raise AIProviderError(
            500,
            "Documentation QA checks timed out while running."
        )

    if result.returncode != 0:
        log_diagnostic(
            "run_checks failed",
            f"returncode={result.returncode} "
            f"stderr={(result.stderr or '')[:500]}"
        )

    try:
        return json.loads(result.stdout)

    except json.JSONDecodeError:
        log_diagnostic(
            "run_checks non-JSON output",
            (result.stdout + result.stderr)[:800]
        )

        raise AIProviderError(
            500,
            "Documentation QA checks failed to run."
        )


def run_deterministic_checks_on_draft(document_content):
    """Run the same deterministic checks against an unpublished draft.

    The draft is written to a temporary Markdown file only so that
    run_checks.py has a real file path to inspect. The file lives
    outside docs/ and is always removed afterward -- the draft is
    never persisted into the published site.
    """

    temp_file = tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".md",
        prefix="docengine-qa-draft-",
        delete=False,
        encoding="utf-8",
    )

    try:
        temp_file.write(document_content)
        temp_file.close()

        return run_deterministic_checks(Path(temp_file.name))

    finally:
        try:
            os.unlink(temp_file.name)
        except OSError:
            pass


# ==========================================================
# Prompt Building
# ==========================================================

def read_text_file(path):
    try:
        return path.read_text(encoding="utf-8")
    except OSError as error:
        log_diagnostic(
            "file read failed",
            f"path={path.name} error={error}"
        )
        return ""


def build_report_request(
    deterministic,
    document_text,
    document_label,
):
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
        f"{json.dumps(deterministic, ensure_ascii=False)}\n\n"
        f"DOCUMENT: {document_label}\n\n"
        f"DOCUMENT CONTENT:\n{truncated_text}{truncation_note}"
    )

    return system_prompt, user_message


# ==========================================================
# AI Request (Groq)
# ==========================================================

def call_groq(api_key, system_prompt, user_message):
    request_body = {
        "model": GROQ_MODEL,
        "messages": [
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": user_message,
            },
        ],
        "temperature": 0.1,
        "max_tokens": MAX_REPORT_TOKENS,
    }

    request_body_bytes = json.dumps(
        request_body,
        ensure_ascii=False,
    ).encode("utf-8")

    log_diagnostic(
        "provider config",
        f"provider=groq sdk=rest(urllib) "
        f"model={GROQ_MODEL} "
        f"timeout_s={REQUEST_TIMEOUT_SECONDS} "
        f"max_tokens={MAX_REPORT_TOKENS}"
    )

    attempt = 0

    while True:
        attempt += 1

        request = Request(
            GROQ_API_URL,
            data=request_body_bytes,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": (
                    "DocEngine-AgentSkill/1.0 "
                    "(+https://doc-engine-nu.vercel.app)"
                ),
            },
            method="POST",
        )

        log_diagnostic(
            "provider request started",
            f"model={GROQ_MODEL} "
            f"attempt={attempt}/{MAX_PROVIDER_RETRIES + 1}"
        )

        started_at = time.monotonic()

        try:
            with urlopen(
                request,
                timeout=REQUEST_TIMEOUT_SECONDS,
            ) as response:
                response_body = response.read().decode("utf-8")

                log_diagnostic(
                    "provider response",
                    f"status={response.status} "
                    f"attempt={attempt} "
                    f"duration_ms="
                    f"{int((time.monotonic() - started_at) * 1000)}"
                )

            break

        except HTTPError as error:
            error_body = error.read().decode("utf-8")
            duration_ms = int(
                (time.monotonic() - started_at) * 1000
            )

            provider_message = extract_groq_error_message(
                error_body
            )

            log_diagnostic(
                f"provider error type=http status={error.code}",
                f"attempt={attempt} "
                f"duration_ms={duration_ms} "
                f"message={provider_message!r}"
            )

            log_diagnostic(
                "provider error body",
                format_groq_error_diagnostic(error_body, api_key),
            )

            if (
                error.code in RETRYABLE_HTTP_STATUSES
                and attempt <= MAX_PROVIDER_RETRIES
            ):
                backoff_seconds = (
                    RETRY_BACKOFF_BASE_SECONDS
                    * (2 ** (attempt - 1))
                )

                log_diagnostic(
                    "provider retry",
                    f"status={error.code} "
                    f"attempt={attempt} "
                    f"backoff_s={backoff_seconds}"
                )

                time.sleep(backoff_seconds)
                continue

            raise describe_groq_error(
                error.code,
                error_body,
            )

        except (URLError, socket.timeout) as error:
            reason = getattr(error, "reason", error)

            is_timeout = (
                isinstance(reason, socket.timeout)
                or "timed out" in str(reason).lower()
                or "timeout" in str(reason).lower()
            )

            log_diagnostic(
                (
                    "provider error type=timeout"
                    if is_timeout
                    else "provider error type=network"
                ),
                f"attempt={attempt} "
                f"duration_ms="
                f"{int((time.monotonic() - started_at) * 1000)} "
                f"reason={reason!r}"
            )

            if is_timeout:
                raise AIProviderError(
                    504,
                    "The AI Agent provider request timed out. "
                    "Please try again."
                )

            raise AIProviderError(
                502,
                "Could not reach the AI provider "
                "(network error)."
            )

    try:
        data = json.loads(response_body)
    except json.JSONDecodeError:
        log_diagnostic(
            "Groq non-JSON 200 response",
            response_body[:800],
        )

        raise AIProviderError(
            502,
            "The AI provider returned an invalid response."
        )

    return extract_groq_text(data)


def describe_groq_error(status_code, error_body):
    """Convert a Groq HTTP error into a safe browser-facing error."""

    message = None
    error_type = None
    error_code = None

    try:
        parsed = json.loads(error_body)
        error_obj = parsed.get("error", {}) or {}

        if isinstance(error_obj, dict):
            message = error_obj.get("message")
            error_type = error_obj.get("type")
            error_code = error_obj.get("code")

    except (json.JSONDecodeError, AttributeError, TypeError):
        pass

    # Cloudflare's edge (in front of api.groq.com) can reject a request
    # before it ever reaches Groq's application layer. That shows up as
    # a plaintext (non-JSON) "error code: 1010" body, not Groq's normal
    # {"error": {...}} JSON shape -- it is not a key/model permission
    # decision at all, so it must not be reported as one.
    if status_code == 403 and "error code: 1010" in error_body:
        return AIProviderError(
            502,
            "The request to Groq was blocked by a Cloudflare security "
            "rule (error 1010), not a Groq API key or model permission "
            "issue. Please try again; contact support if this persists."
        )

    # Invalid/missing/expired key.
    if status_code in (401, 403):
        lower_message = (message or "").lower()

        if (
            status_code == 401
            or "authentication" in lower_message
            or "api key" in lower_message
            or "invalid" in lower_message
        ):
            return AIProviderError(
                401,
                "The configured GROQ_API_KEY is invalid "
                "or missing. Check Vercel environment variables."
            )

        # Groq can return 403 when the key cannot access a model.
        return AIProviderError(
            403,
            "The configured GROQ_API_KEY does not have permission "
            f"to use model '{GROQ_MODEL}'. "
            "Check the model access and project permissions "
            "in the Groq Console."
        )

    # Model not found / unavailable.
    if status_code == 404:
        return AIProviderError(
            500,
            f"The configured Groq model ('{GROQ_MODEL}') was "
            "not found or is not available to this API key. "
            "Check GROQ_MODEL and the model's availability."
        )

    # Rate limit / quota.
    if status_code == 429:
        return AIProviderError(
            429,
            "Groq rate limit or quota exceeded. "
            "Please try again shortly."
        )

    # Invalid request.
    if status_code == 400:
        safe_message = (
            message
            if message and len(message) < 300
            else "invalid request"
        )

        return AIProviderError(
            502,
            f"The AI provider rejected the request "
            f"({safe_message})."
        )

    # Provider/server error.
    if status_code >= 500:
        return AIProviderError(
            502,
            "The AI provider (Groq) returned a server error "
            f"(HTTP {status_code}). Please try again."
        )

    # Avoid returning the complete raw provider response.
    return AIProviderError(
        502,
        f"AI provider request failed ({status_code})."
    )


def extract_groq_text(data):
    choices = data.get("choices") or []

    if not choices:
        log_diagnostic(
            "Groq empty choices",
            str(data)[:800],
        )

        raise AIProviderError(
            502,
            "AI returned an empty response."
        )

    first_choice = choices[0] or {}
    message = first_choice.get("message") or {}
    text = message.get("content")

    if isinstance(text, list):
        # Defensive support for providers that return content parts.
        text = "".join(
            part.get("text", "")
            for part in text
            if isinstance(part, dict)
        )

    text = (text or "").strip()

    finish_reason = first_choice.get("finish_reason")

    if not text:
        log_diagnostic(
            "Groq empty text",
            f"finish_reason={finish_reason}",
        )

        raise AIProviderError(
            502,
            "AI returned an empty response."
        )

    return text


def request_qa_report(
    deterministic,
    document_text,
    document_label,
):
    api_key = os.environ.get("GROQ_API_KEY")

    log_diagnostic(
        "selected provider/model",
        f"provider=groq model={GROQ_MODEL} "
        f"api_key_detected={bool(api_key)}"
    )

    if not api_key:
        raise AIProviderError(
            500,
            "The AI Agent panel is not configured on the "
            "server (missing GROQ_API_KEY)."
        )

    system_prompt, user_message = build_report_request(
        deterministic,
        document_text,
        document_label,
    )

    log_diagnostic(
        "prompt prepared",
        f"system_chars={len(system_prompt)} "
        f"user_chars={len(user_message)}"
    )

    return call_groq(
        api_key,
        system_prompt,
        user_message,
    )


# ==========================================================
# Validation
# ==========================================================

def validate_payload(payload):
    if not isinstance(payload, dict):
        return "Invalid request payload."

    document_path = (
        payload.get("document_path") or ""
    ).strip()

    if not document_path:
        return "A document_path is required."

    if len(document_path) > 1000:
        return "The document_path is too long."

    document_content = payload.get("document_content")

    if document_content is not None:
        if not isinstance(document_content, str):
            return "document_content must be a string."

        if len(document_content) > MAX_DOCUMENT_CONTENT_CHARS:
            return "The document_content is too long."

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
                origin,
            )

        self.send_header(
            "Access-Control-Allow-Methods",
            "POST, OPTIONS, GET",
        )

        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type",
        )

        self.send_header(
            "Access-Control-Max-Age",
            "86400",
        )

        self.send_header(
            "Vary",
            "Origin",
        )

    # ======================================================
    # JSON Response
    # ======================================================

    def send_json(self, status_code, data):
        response = json.dumps(
            data,
            ensure_ascii=False,
        ).encode("utf-8")

        self.send_response(status_code)

        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8",
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
                "method": "GET",
                "provider": "groq",
                "model": GROQ_MODEL,
            },
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

            if content_length <= 0:
                self.send_json(
                    400,
                    {
                        "success": False,
                        "message": "Request body is required.",
                    },
                )
                return

            # Prevent accidentally accepting an extremely large
            # request body. The endpoint only needs document_path
            # and, optionally, an unpublished draft's document_content.
            if content_length > 100_000:
                self.send_json(
                    413,
                    {
                        "success": False,
                        "message": "Request body is too large.",
                    },
                )
                return

            body = self.rfile.read(content_length)
            payload = json.loads(
                body.decode("utf-8")
            )

        except (ValueError, json.JSONDecodeError):
            self.send_json(
                400,
                {
                    "success": False,
                    "message": "Invalid request body.",
                },
            )
            return

        validation_error = validate_payload(payload)

        if validation_error:
            self.send_json(
                400,
                {
                    "success": False,
                    "message": validation_error,
                },
            )
            return

        document_path = (
            payload.get("document_path") or ""
        ).strip()

        raw_document_content = payload.get("document_content")

        document_content = (
            raw_document_content.strip()
            if isinstance(raw_document_content, str)
            else ""
        )

        log_diagnostic(
            "request received",
            "skill=documentation-qa "
            f"document_path={document_path!r} "
            f"has_document_content={bool(document_content)}",
        )

        target_file = resolve_document_path(
            document_path
        )

        published_baseline = target_file is not None

        if not published_baseline and not document_content:
            self.send_json(
                404,
                {
                    "success": False,
                    "message": (
                        f"Could not find a published page for "
                        f"'{document_path}'. Documentation QA "
                        "checks the last-published version of a "
                        "page -- save and publish it at least once, "
                        "or include the unpublished draft as "
                        "document_content."
                    ),
                },
            )
            return

        source = "published" if published_baseline else "draft"

        total_started_at = time.monotonic()

        try:
            # --------------------------------------------------
            # Deterministic QA
            # --------------------------------------------------

            if published_baseline:
                log_diagnostic(
                    "deterministic checks started",
                    target_file.name,
                )
            else:
                log_diagnostic(
                    "deterministic checks started",
                    "(unpublished draft)",
                )

            checks_started_at = time.monotonic()

            if published_baseline:
                deterministic = run_deterministic_checks(
                    target_file
                )
            else:
                deterministic = run_deterministic_checks_on_draft(
                    document_content
                )

            log_diagnostic(
                "deterministic checks completed",
                "in "
                f"{int((time.monotonic() - checks_started_at) * 1000)} ms",
            )

            # --------------------------------------------------
            # Document
            # --------------------------------------------------

            if published_baseline:
                document_text = read_text_file(
                    target_file
                )

                if not document_text:
                    raise AIProviderError(
                        500,
                        "The published documentation page is empty "
                        "or could not be read."
                    )

                document_label = deterministic.get(
                    "file",
                    document_path,
                )
            else:
                document_text = document_content
                document_label = document_path

            # --------------------------------------------------
            # AI QA Review
            # --------------------------------------------------

            ai_started_at = time.monotonic()

            report_text = request_qa_report(
                deterministic,
                document_text,
                document_label,
            )

            ai_duration_ms = int(
                (time.monotonic() - ai_started_at) * 1000
            )

            total_duration_ms = int(
                (time.monotonic() - total_started_at) * 1000
            )

            log_diagnostic(
                "AI report completed",
                f"in {ai_duration_ms} ms",
            )

            log_diagnostic(
                "total request time",
                f"{total_duration_ms} ms",
            )

            self.send_json(
                200,
                {
                    "success": True,
                    "model": GROQ_MODEL,
                    "provider": "groq",
                    "source": source,
                    "published_baseline": published_baseline,
                    "deterministic": deterministic,
                    "report": report_text,
                    "duration_ms": total_duration_ms,
                },
            )

        except AIProviderError as error:
            print(
                "Agent skill error:",
                error,
                flush=True,
            )

            log_diagnostic(
                "total request time (failed)",
                f"{int((time.monotonic() - total_started_at) * 1000)} ms",
            )

            self.send_json(
                error.status_code,
                {
                    "success": False,
                    "message": (
                        str(error)
                        or "Agent skill run failed."
                    ),
                },
            )

        except Exception as error:
            # Unknown application bug. Do not expose internal details
            # to the browser.
            print(
                "Agent skill unexpected error:",
                error,
                flush=True,
            )

            log_diagnostic(
                "unexpected exception type",
                type(error).__name__,
            )

            self.send_json(
                500,
                {
                    "success": False,
                    "message": (
                        "Agent skill run failed unexpectedly."
                    ),
                },
            )
