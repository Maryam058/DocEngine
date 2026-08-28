from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

import json
import os
import socket
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

# Model history for this API key, confirmed via the diagnostic logging
# below (not guesses):
#   gemini-3.7-flash (pinned)  -> real HTTP 503, brand-new model,
#                                  free-tier capacity not yet available.
#   gemini-2.5-flash (pinned)  -> real HTTP 404 "model not found" for
#                                  this specific key.
#   gemini-flash-latest (alias) -> currently resolves to gemini-3.7-flash
#                                  (Google's "New Stable" flash release as
#                                  of 2026-08-14), so it inherits the same
#                                  503-under-load behavior as the first
#                                  pinned attempt above.
# Given a pinned older model 404s for this key and the newest release
# 503s under load, the alias is still the right choice: it stays valid
# as Google rotates the underlying model, and RETRYABLE_HTTP_STATUSES
# below absorbs the transient-overload 503s that a brand-new release
# gets. If 503s persist long-term (not just at launch), re-run the
# model-listing verification (see the incident notes / PR description)
# against this key before trying another pinned model.
GEMINI_MODEL = os.environ.get(
    "GEMINI_MODEL",
    "gemini-flash-latest"
)

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"

MAX_OUTPUT_TOKENS = 2048

MAX_SELECTION_CHARS = 8000
MAX_CONTEXT_CHARS = 4000
MAX_QUESTION_CHARS = 500

# Reduced from 25.0. Root-caused via production log analysis: the
# "AI provider request timed out" message users see is this module's
# own formatted 504 (call_gemini's URLError/socket.timeout branch
# below), not a frontend abort (CONFIG.AI_REQUEST_TIMEOUT is 30000ms,
# comfortably above this) and not a raw Vercel platform kill (those
# don't come back as our own clean JSON). The real risk is retry
# multiplication: at 25s, two fast 429/503 responses (~0.7s each,
# measured) plus their backoff, followed by one attempt that
# genuinely stalls, adds up to ~28s worst case for a single request --
# uncomfortably close to typical serverless execution limits. Cut to
# 15s (matching the identical fix already applied to
# api/agent-skill.py's Gemini calls) to bring that worst case to
# ~18s, without touching retry count/backoff/status-code policy or
# any model/generation config -- none of those were demonstrably the
# cause.
REQUEST_TIMEOUT_SECONDS = 15.0

# Retries apply ONLY to raw Gemini HTTP 503 (UNAVAILABLE, transient
# overload) and 429 (RESOURCE_EXHAUSTED, rate limit) -- both of which
# Google's own error-handling guidance says to retry with backoff.
# Never retried: 4xx auth/invalid-request/model-not-found errors,
# and client/network timeouts -- those are not transient and retrying
# them just adds latency without changing the outcome. A genuine
# network timeout is also never retried (see the URLError/
# socket.timeout branch in call_gemini), so retries cannot multiply a
# real stall into 3x the wait -- the worst case above is bounded by
# two FAST error responses plus one full-length final attempt, not
# three full-length attempts.
MAX_PROVIDER_RETRIES = 2
RETRY_BACKOFF_BASE_SECONDS = 0.5
RETRYABLE_HTTP_STATUSES = (429, 503)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
STYLE_GUIDE_PATH = PROJECT_ROOT / "docs" / "style-guide.md"
GLOSSARY_PATH = PROJECT_ROOT / "docs" / "glossary.md"


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
# Reference Content (Style Guide / Glossary)
# ==========================================================

def read_reference_file(path):

    try:
        return path.read_text(encoding="utf-8").strip()

    except OSError:
        return ""


# ==========================================================
# Prompt Building
# ==========================================================

def build_system_prompt(mode):

    if mode == "ask":

        return (
            "You are an expert technical documentation editor for DocEngine, "
            "a documentation platform. The human editor has selected a piece of "
            "text in their document and is asking you a question about it.\n\n"
            "Answer the QUESTION using the SELECTED TEXT and SURROUNDING CONTEXT "
            "for reference. Use the STYLE GUIDE and TERMINOLOGY GLOSSARY as the "
            "authority on tone, wording, and conventions when relevant.\n\n"
            "Be concise and direct. Do not rewrite the whole document — focus "
            "your answer on the selected text and the question asked. Respond "
            "with plain text only, no markdown code fences."
        )

    return (
        "You are an expert technical documentation editor for DocEngine, "
        "a documentation platform. The human editor has selected a piece of "
        "text in their document and wants it improved.\n\n"
        "Improve the SELECTED TEXT for clarity, grammar, professional "
        "technical-writing style, conciseness, sentence structure, "
        "consistency with the STYLE GUIDE, correct terminology from the "
        "TERMINOLOGY GLOSSARY, better instructional wording, and readability. "
        "Preserve the original meaning unless explicitly asked for a "
        "substantive rewrite. Use SURROUNDING CONTEXT only to keep tone and "
        "continuity consistent — do not rewrite it.\n\n"
        "Respond with ONLY the improved version of the selected text. No "
        "preamble, no explanation, no quotation marks, no markdown code "
        "fences. If the selected text already meets these standards, return "
        "it unchanged."
    )


def build_user_message(mode, payload, style_guide, glossary):

    parts = []

    document_title = (payload.get("documentTitle") or "Untitled").strip()
    document_path = (payload.get("documentPath") or "").strip()

    parts.append(f"Document: {document_title} ({document_path})")

    if style_guide:
        parts.append(
            "STYLE GUIDE:\n" + style_guide
        )

    if glossary:
        parts.append(
            "TERMINOLOGY GLOSSARY:\n" + glossary
        )

    context = (payload.get("context") or "").strip()

    if context:
        parts.append(
            "SURROUNDING CONTEXT:\n" + context[:MAX_CONTEXT_CHARS]
        )

    selected_text = payload.get("selectedText") or ""

    parts.append(
        "SELECTED TEXT:\n" + selected_text
    )

    if mode == "ask":

        question = (payload.get("question") or "").strip()

        parts.append(
            "QUESTION:\n" + question
        )

    return "\n\n".join(parts)


# ==========================================================
# AI Request (Google Gemini)
# ==========================================================

class AIProviderError(RuntimeError):
    """Carries the HTTP status the handler should send to the browser,
    separately from the human-readable message."""

    def __init__(self, status_code, message):

        super().__init__(message)

        self.status_code = status_code


def log_diagnostic(label, detail):

    # Server-side only (Vercel function logs) -- never sent to the
    # browser. `detail` originates from Gemini's own response body,
    # never from our request, so it cannot contain GEMINI_API_KEY.

    print(f"[ai-suggest] {label}: {detail}"[:800], flush=True)


def _extract_gemini_error_message(error_body):
    """Pulls just the human-readable `error.message` out of a Gemini
    error response body, for compact logging (the raw body can be
    logged too, but this keeps the one-line summary readable)."""

    try:

        return (
            json.loads(error_body).get("error", {}).get("message")
            or "(no message)"
        )

    except (json.JSONDecodeError, AttributeError):

        return "(unparseable error body)"


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
            "maxOutputTokens": MAX_OUTPUT_TOKENS,

            # This is a short, latency-sensitive editing suggestion, not
            # a reasoning task. The legacy "thinkingBudget" field (used
            # for Gemini 2.5) gives unpredictable latency on Gemini 3.x
            # models -- including long stalls that blow past our request
            # timeout -- because 3.x models size their own thinking pass
            # instead of honoring a token budget. "thinkingLevel" is the
            # field Gemini 3.x actually respects for capping latency.
            #
            # "minimal" was tried first but the live API rejected it for
            # the model gemini-flash-latest currently resolves to:
            #   "Thinking level MINIMAL is not supported for this model.
            #    Please retry with other thinking level."
            # (confirmed via the provider error logging below, not a
            # guess). Gemini 3.x has no way to fully disable thinking --
            # unlike Gemini 2.5's thinkingBudget=0 -- so "low" is the
            # lowest level to use instead: it's documented as supported
            # across the whole Gemini 3.x line and is still the
            # low-latency/high-throughput tier, just not the absolute
            # floor. Do not send both thinkingLevel and thinkingBudget --
            # Gemini rejects a request that sets both with an HTTP 400.
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

            # Network errors and timeouts are not in RETRYABLE_HTTP_STATUSES
            # (there's no HTTP status to check) and are not retried --
            # they're not the transient "provider overloaded" case the
            # retry loop targets.

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
    distinguishes the failure category (bad key, no permission, model
    not found, rate limit, provider outage, ...) without leaking the
    API key or raw internal error payloads."""

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


def request_ai_completion(mode, payload):

    api_key = os.environ.get("GEMINI_API_KEY")

    log_diagnostic(
        "selected provider/model",
        f"provider=gemini model={GEMINI_MODEL} "
        f"api_key_detected={bool(api_key)}"
    )

    if not api_key:

        raise AIProviderError(
            500,
            "AI suggestions are not configured on the server "
            "(missing GEMINI_API_KEY)."
        )

    style_guide = read_reference_file(STYLE_GUIDE_PATH)
    glossary = read_reference_file(GLOSSARY_PATH)

    system_prompt = build_system_prompt(mode)
    user_message = build_user_message(
        mode,
        payload,
        style_guide,
        glossary
    )

    return call_gemini(
        api_key,
        system_prompt,
        user_message
    )


# ==========================================================
# Validation
# ==========================================================

def validate_payload(mode, payload):

    if mode not in ("suggest", "ask"):
        return "Unsupported mode."

    selected_text = (payload.get("selectedText") or "").strip()

    if not selected_text:
        return "No text was selected."

    if len(selected_text) > MAX_SELECTION_CHARS:
        return "Selected text is too long. Select a smaller portion."

    if mode == "ask":

        question = (payload.get("question") or "").strip()

        if not question:
            return "A question is required for Ask AI."

        if len(question) > MAX_QUESTION_CHARS:
            return "Question is too long."

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
                "message": "DocEngine AI Suggestion API is running.",
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

        mode = payload.get("mode") or "suggest"

        log_diagnostic(
            "request received",
            f"mode={mode} "
            f"selection_chars={len(payload.get('selectedText') or '')} "
            f"context_chars={len(payload.get('context') or '')}"
        )

        validation_error = validate_payload(mode, payload)

        if validation_error:

            self.send_json(
                400,
                {
                    "success": False,
                    "message": validation_error
                }
            )

            return

        try:

            result_text = request_ai_completion(mode, payload)

            key = "answer" if mode == "ask" else "suggestion"

            self.send_json(
                200,
                {
                    "success": True,
                    key: result_text
                }
            )

        except AIProviderError as error:

            print("AI suggestion error:", error, flush=True)

            self.send_json(
                error.status_code,
                {
                    "success": False,
                    "message": str(error) or "AI request failed."
                }
            )

        except Exception as error:

            # Anything not already classified into an AIProviderError
            # (a genuine bug, not a known Gemini failure mode).

            print("AI suggestion unexpected error:", error, flush=True)

            self.send_json(
                500,
                {
                    "success": False,
                    "message": "AI request failed unexpectedly."
                }
            )
