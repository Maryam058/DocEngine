"""Regression tests for safe Groq 403/HTTP error-body diagnostics.

Covers `format_groq_error_diagnostic` (api/agent-skill.py) and
`_format_groq_error_diagnostic` (api/ai-suggest.py): both must expose
Groq's parsed error.message/type/code when the body is JSON, fall back
to a truncated sanitized raw string when it is not, truncate to 1000
chars, and never leak the configured API key.

Uses stdlib `unittest` only (no pytest/third-party dependency), matching
this repo's stdlib-only convention for the `api/` and `tools/` code.

Run with: python -m unittest tests.test_groq_error_diagnostics -v
"""

import importlib.util
import sys
import unittest
from pathlib import Path

API_DIR = Path(__file__).resolve().parent.parent / "api"


def _load_module(module_name, file_name):
    spec = importlib.util.spec_from_file_location(
        module_name, API_DIR / file_name
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


agent_skill = _load_module("docengine_agent_skill", "agent-skill.py")
ai_suggest = _load_module("docengine_ai_suggest", "ai-suggest.py")

FAKE_API_KEY = "gsk_fake_test_key_do_not_use_00000000000000000000"

JSON_403_BODY = (
    '{"error": {"message": "Forbidden: key not authorized for this '
    'organization", "type": "permission_error", "code": '
    '"model_not_authorized"}}'
)

NON_JSON_403_BODY = "Forbidden"


class GroqErrorDiagnosticTests(unittest.TestCase):

    # --- api/agent-skill.py: format_groq_error_diagnostic -----------

    def test_agent_skill_json_error_body_exposes_fields(self):
        diagnostic = agent_skill.format_groq_error_diagnostic(
            JSON_403_BODY, FAKE_API_KEY
        )

        self.assertIn(
            "error.message='Forbidden: key not authorized", diagnostic
        )
        self.assertIn("error.type='permission_error'", diagnostic)
        self.assertIn("error.code='model_not_authorized'", diagnostic)
        self.assertNotIn(FAKE_API_KEY, diagnostic)

    def test_agent_skill_non_json_error_body_logs_sanitized_raw(self):
        diagnostic = agent_skill.format_groq_error_diagnostic(
            NON_JSON_403_BODY, FAKE_API_KEY
        )

        self.assertEqual(diagnostic, "raw(non-json)='Forbidden'")
        self.assertNotIn(FAKE_API_KEY, diagnostic)

    def test_agent_skill_truncates_long_body_to_1000_chars(self):
        long_body = "x" * 5000
        diagnostic = agent_skill.format_groq_error_diagnostic(
            long_body, FAKE_API_KEY
        )

        raw_value = diagnostic.split("raw(non-json)=", 1)[1]
        # +2 for the surrounding quotes added by repr().
        self.assertEqual(len(raw_value), 1000 + 2)

    def test_agent_skill_redacts_api_key_if_echoed_in_body(self):
        body_with_key = (
            f'{{"error": {{"message": "key {FAKE_API_KEY} bad"}}}}'
        )
        diagnostic = agent_skill.format_groq_error_diagnostic(
            body_with_key, FAKE_API_KEY
        )

        self.assertNotIn(FAKE_API_KEY, diagnostic)

    def test_agent_skill_describe_groq_error_message_unchanged(self):
        """Only the *log* diagnostics changed -- the browser-facing 403
        response must stay the existing generic permission message."""

        error = agent_skill.describe_groq_error(403, JSON_403_BODY)
        self.assertEqual(error.status_code, 403)
        self.assertIn("does not have permission", str(error))

    # --- api/ai-suggest.py: _format_groq_error_diagnostic -----------

    def test_ai_suggest_json_error_body_exposes_fields(self):
        diagnostic = ai_suggest._format_groq_error_diagnostic(
            JSON_403_BODY, FAKE_API_KEY
        )

        self.assertIn(
            "error.message='Forbidden: key not authorized", diagnostic
        )
        self.assertIn("error.type='permission_error'", diagnostic)
        self.assertIn("error.code='model_not_authorized'", diagnostic)
        self.assertNotIn(FAKE_API_KEY, diagnostic)

    def test_ai_suggest_non_json_error_body_logs_sanitized_raw(self):
        diagnostic = ai_suggest._format_groq_error_diagnostic(
            NON_JSON_403_BODY, FAKE_API_KEY
        )

        self.assertEqual(diagnostic, "raw(non-json)='Forbidden'")
        self.assertNotIn(FAKE_API_KEY, diagnostic)

    def test_ai_suggest_truncates_long_body_to_1000_chars(self):
        long_body = "x" * 5000
        diagnostic = ai_suggest._format_groq_error_diagnostic(
            long_body, FAKE_API_KEY
        )

        raw_value = diagnostic.split("raw(non-json)=", 1)[1]
        self.assertEqual(len(raw_value), 1000 + 2)

    def test_ai_suggest_describe_groq_error_message_unchanged(self):
        error = ai_suggest.describe_groq_error(403, JSON_403_BODY)
        self.assertEqual(error.status_code, 403)
        self.assertIn("does not have permission", str(error))


if __name__ == "__main__":
    unittest.main()
