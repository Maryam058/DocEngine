from http.server import BaseHTTPRequestHandler
from pathlib import Path

import json
import os


# ==========================================================
# Configuration
# ==========================================================

ALLOWED_ORIGINS = {
    "https://maryam058.github.io",
    "https://doc-engine-nu.vercel.app",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
}

DEFAULT_MODEL = os.environ.get(
    "AI_SUGGESTION_MODEL",
    "claude-opus-5"
)

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
# AI Request
# ==========================================================

def request_ai_completion(mode, payload):

    api_key = os.environ.get("ANTHROPIC_API_KEY")

    if not api_key:

        raise RuntimeError(
            "AI suggestions are not configured on the server "
            "(missing ANTHROPIC_API_KEY)."
        )

    import anthropic

    client = anthropic.Anthropic(
        api_key=api_key
    ).with_options(
        timeout=REQUEST_TIMEOUT_SECONDS
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

    response = client.messages.create(
        model=DEFAULT_MODEL,
        max_tokens=1024,
        system=system_prompt,
        messages=[
            {"role": "user", "content": user_message}
        ]
    )

    text = "".join(
        block.text
        for block in response.content
        if block.type == "text"
    ).strip()

    if not text:
        raise RuntimeError("AI returned an empty response.")

    return text


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

        except ImportError:

            self.send_json(
                500,
                {
                    "success": False,
                    "message": (
                        "AI suggestions are not available "
                        "(the anthropic package is not installed)."
                    )
                }
            )

        except Exception as error:

            print("AI suggestion error:", error)

            message = str(error)

            status_code = 502

            lowered = message.lower()

            if "not configured" in lowered:
                status_code = 500

            elif "timeout" in lowered or "timed out" in lowered:
                status_code = 504

            elif "rate" in lowered and "limit" in lowered:
                status_code = 429

            self.send_json(
                status_code,
                {
                    "success": False,
                    "message": message or "AI request failed."
                }
            )
