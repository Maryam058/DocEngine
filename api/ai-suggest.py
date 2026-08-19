from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

import json
import os
import socket


# ==========================================================
# Configuration
# ==========================================================

ALLOWED_ORIGINS = {
    "https://maryam058.github.io",
    "https://doc-engine-nu.vercel.app",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
}

GEMINI_MODEL = os.environ.get(
    "GEMINI_MODEL",
    "gemini-3.7-flash"
)

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"

MAX_OUTPUT_TOKENS = 1024

MAX_SELECTION_CHARS = 8000
MAX_CONTEXT_CHARS = 4000
MAX_QUESTION_CHARS = 500

REQUEST_TIMEOUT_SECONDS = 25.0

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
            "maxOutputTokens": MAX_OUTPUT_TOKENS
        }

    }

    request = Request(

        url,

        data=json.dumps(request_body).encode("utf-8"),

        headers={
            "Content-Type": "application/json"
        },

        method="POST"

    )

    try:

        with urlopen(
            request,
            timeout=REQUEST_TIMEOUT_SECONDS
        ) as response:

            response_body = response.read().decode("utf-8")

    except HTTPError as error:

        error_body = error.read().decode("utf-8")

        raise RuntimeError(
            describe_gemini_error(error.code, error_body)
        )

    except (URLError, socket.timeout) as error:

        reason = getattr(error, "reason", error)

        if isinstance(reason, socket.timeout) or "timed out" in str(reason).lower():

            raise RuntimeError(
                "The AI provider request timed out. Please try again."
            )

        raise RuntimeError(
            "Could not reach the AI provider (network error)."
        )

    try:

        data = json.loads(response_body)

    except json.JSONDecodeError:

        raise RuntimeError(
            "The AI provider returned an invalid response."
        )

    return extract_gemini_text(data)


def describe_gemini_error(status_code, error_body):

    message = None

    try:

        parsed = json.loads(error_body)

        message = (
            parsed.get("error", {}).get("message")
        )

    except (json.JSONDecodeError, AttributeError):

        message = None

    if status_code in (400, 403) and message and "API key" in message:

        return "The configured GEMINI_API_KEY is invalid or unauthorized."

    if status_code == 404:

        return (
            "The configured Gemini model "
            f"('{GEMINI_MODEL}') was not found. Check the "
            "GEMINI_MODEL environment variable."
        )

    if status_code == 429:

        return (
            "Gemini rate limit or quota exceeded. "
            "Please try again shortly."
        )

    if status_code >= 500:

        return "The AI provider is temporarily unavailable."

    return message or f"AI provider request failed ({status_code})."


def extract_gemini_text(data):

    candidates = data.get("candidates") or []

    if not candidates:

        feedback = data.get("promptFeedback", {})

        block_reason = feedback.get("blockReason")

        if block_reason:

            raise RuntimeError(
                "The AI provider blocked this request "
                f"({block_reason})."
            )

        raise RuntimeError("AI returned an empty response.")

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

        if finish_reason and finish_reason not in ("STOP", "MAX_TOKENS"):

            raise RuntimeError(
                "The AI provider did not return usable text "
                f"({finish_reason})."
            )

        raise RuntimeError("AI returned an empty response.")

    return text


def request_ai_completion(mode, payload):

    api_key = os.environ.get("GEMINI_API_KEY")

    if not api_key:

        raise RuntimeError(
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

        except Exception as error:

            print("AI suggestion error:", error)

            message = str(error)

            status_code = 502

            lowered = message.lower()

            if "not configured" in lowered:
                status_code = 500

            elif "invalid" in lowered and (
                "key" in lowered or "unauthorized" in lowered
            ):
                status_code = 401

            elif "not found" in lowered and "model" in lowered:
                status_code = 500

            elif "timeout" in lowered or "timed out" in lowered:
                status_code = 504

            elif "rate limit" in lowered or "quota" in lowered:
                status_code = 429

            elif "network error" in lowered:
                status_code = 504

            self.send_json(
                status_code,
                {
                    "success": False,
                    "message": message or "AI request failed."
                }
            )
