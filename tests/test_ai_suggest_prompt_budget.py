"""Regression tests for the Groq input-size prompt budget in
api/ai-suggest.py (build_user_message / allocate_chars /
select_relevant_excerpt / estimate_tokens).

Covers the production HTTP 413 root cause: style-guide.md and
glossary.md used to be injected into every prompt in full, with no
size cap, so the prompt grew unbounded with those files. These tests
assert the fix holds regardless of how large any single
component (selected text, surrounding context, style guide, glossary)
gets -- the assembled prompt must always stay within
MAX_INPUT_CHARS_GROQ / MAX_INPUT_TOKENS_GROQ.

Uses stdlib `unittest` only, matching this repo's stdlib-only
convention for the `api/` and `tools/` code (see
tests/test_groq_error_diagnostics.py).

Run with: python -m unittest tests.test_ai_suggest_prompt_budget -v
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


ai_suggest = _load_module("docengine_ai_suggest_budget", "ai-suggest.py")


def _assembled_input_tokens(system_prompt, user_message):
    return ai_suggest.estimate_tokens(system_prompt) + ai_suggest.estimate_tokens(
        user_message
    )


class EstimateTokensTests(unittest.TestCase):

    def test_empty_text_is_zero_tokens(self):
        self.assertEqual(ai_suggest.estimate_tokens(""), 0)
        self.assertEqual(ai_suggest.estimate_tokens(None), 0)

    def test_rounds_up_partial_token(self):
        # 1 char is less than CHARS_PER_TOKEN_ESTIMATE (4) but still
        # costs a full token in the conservative estimate.
        self.assertEqual(ai_suggest.estimate_tokens("a"), 1)
        self.assertEqual(ai_suggest.estimate_tokens("a" * 4), 1)
        self.assertEqual(ai_suggest.estimate_tokens("a" * 5), 2)


class AllocateCharsTests(unittest.TestCase):

    def test_allocates_up_to_the_smallest_limit(self):
        chars_used, remaining = ai_suggest.allocate_chars(1000, 500, 800)
        self.assertEqual(chars_used, 500)
        self.assertEqual(remaining, 500)

    def test_component_cap_wins_over_larger_request(self):
        chars_used, remaining = ai_suggest.allocate_chars(1000, 5000, 300)
        self.assertEqual(chars_used, 300)
        self.assertEqual(remaining, 700)

    def test_remaining_budget_wins_when_exhausted(self):
        chars_used, remaining = ai_suggest.allocate_chars(50, 5000, 300)
        self.assertEqual(chars_used, 50)
        self.assertEqual(remaining, 0)

    def test_never_returns_negative(self):
        chars_used, remaining = ai_suggest.allocate_chars(0, 500, 300)
        self.assertEqual(chars_used, 0)
        self.assertEqual(remaining, 0)


class SelectRelevantExcerptTests(unittest.TestCase):

    def test_short_document_returned_unchanged(self):
        text = "## Heading\nShort body."
        self.assertEqual(
            ai_suggest.select_relevant_excerpt(text, "query", 10000), text
        )

    def test_empty_document_returns_empty(self):
        self.assertEqual(
            ai_suggest.select_relevant_excerpt("", "query", 500), ""
        )

    def test_zero_budget_returns_empty(self):
        self.assertEqual(
            ai_suggest.select_relevant_excerpt("## A\nBody", "query", 0), ""
        )

    def test_never_exceeds_max_chars(self):
        big_doc = "\n\n".join(
            f"## Section {i}\n" + ("word " * 200)
            for i in range(20)
        )
        excerpt = ai_suggest.select_relevant_excerpt(big_doc, "irrelevant", 500)
        self.assertLessEqual(len(excerpt), 500)

    def test_prefers_sections_matching_the_query(self):
        big_doc = (
            "## Passive Voice\n"
            + ("Avoid passive voice constructions in instructions. " * 20)
            + "\n\n## Unrelated Topic\n"
            + ("Filler content about something else entirely. " * 20)
        )

        excerpt = ai_suggest.select_relevant_excerpt(
            big_doc, "please fix the passive voice in this sentence", 400
        )

        self.assertIn("Passive Voice", excerpt)
        self.assertNotIn("Unrelated Topic", excerpt)

    def test_falls_back_to_head_truncation_without_headings(self):
        text = "word " * 5000
        excerpt = ai_suggest.select_relevant_excerpt(text, "query", 100)
        self.assertEqual(len(excerpt), len(text[:100].rstrip()))


class BuildUserMessageBudgetTests(unittest.TestCase):
    """End-to-end tests against the real build_user_message(), using
    this project's actual style-guide.md/glossary.md content (loaded
    via STYLE_GUIDE_PATH/GLOSSARY_PATH) since those are the real-world
    files that caused the production 413."""

    @classmethod
    def setUpClass(cls):
        cls.style_guide = ai_suggest.read_reference_file(
            ai_suggest.STYLE_GUIDE_PATH
        )
        cls.glossary = ai_suggest.read_reference_file(ai_suggest.GLOSSARY_PATH)
        cls.system_prompt = ai_suggest.build_system_prompt("suggest")

    def _build(self, payload, mode="suggest"):
        return ai_suggest.build_user_message(
            mode, payload, self.style_guide, self.glossary, self.system_prompt
        )

    def test_normal_small_request_stays_within_budget(self):
        payload = {
            "documentTitle": "Quickstart",
            "documentPath": "UserGuide/quickstart.md",
            "context": "Some short surrounding paragraph of context.",
            "selectedText": "Click the button too start the process.",
        }

        message = self._build(payload)

        self.assertIn(
            "SELECTED TEXT:\nClick the button too start the process.",
            message,
        )
        self.assertLessEqual(
            _assembled_input_tokens(self.system_prompt, message),
            ai_suggest.MAX_INPUT_TOKENS_GROQ,
        )

    def test_oversized_document_context_is_bounded(self):
        payload = {
            "documentTitle": "Big Doc",
            "documentPath": "UserGuide/big.md",
            "context": "Filler context sentence. " * 5000,  # ~125k chars
            "selectedText": "Improve this short sentence please.",
        }

        message = self._build(payload)

        self.assertLessEqual(
            _assembled_input_tokens(self.system_prompt, message),
            ai_suggest.MAX_INPUT_TOKENS_GROQ,
        )

    def test_oversized_glossary_and_style_guide_are_bounded(self):
        huge_style_guide = "## Rule\n" + ("Always do this. " * 50000)
        huge_glossary = "## Term\n" + ("Definition text. " * 50000)

        message = ai_suggest.build_user_message(
            "suggest",
            {
                "documentTitle": "Doc",
                "documentPath": "UserGuide/doc.md",
                "context": "",
                "selectedText": "Improve this short sentence please.",
            },
            huge_style_guide,
            huge_glossary,
            self.system_prompt,
        )

        self.assertLessEqual(
            _assembled_input_tokens(self.system_prompt, message),
            ai_suggest.MAX_INPUT_TOKENS_GROQ,
        )

    def test_very_large_selected_text_stays_within_budget(self):
        huge_selection = "This sentence needs editing. " * 2000  # ~60k chars

        payload = {
            "documentTitle": "Doc",
            "documentPath": "UserGuide/doc.md",
            "context": "Some context.",
            "selectedText": huge_selection,
        }

        message = self._build(payload)

        self.assertLessEqual(
            _assembled_input_tokens(self.system_prompt, message),
            ai_suggest.MAX_INPUT_TOKENS_GROQ,
        )

    def test_selected_text_preserved_when_it_fits(self):
        selected_text = "This is a normal, reasonably sized selection."

        payload = {
            "documentTitle": "Doc",
            "documentPath": "UserGuide/doc.md",
            "context": "Some short context.",
            "selectedText": selected_text,
        }

        message = self._build(payload)

        self.assertIn("SELECTED TEXT:\n" + selected_text, message)

    def test_selected_text_preserved_as_much_as_possible_when_huge(self):
        # Larger than the whole budget on its own.
        huge_selection = "word " * 20000  # ~100k chars

        payload = {
            "documentTitle": "Doc",
            "documentPath": "UserGuide/doc.md",
            "context": "",
            "selectedText": huge_selection,
        }

        message = self._build(payload)

        selected_marker = "SELECTED TEXT:\n"
        start = message.index(selected_marker) + len(selected_marker)
        preserved_selected_text = message[start:]

        # Should preserve a large prefix of the original selection,
        # not an arbitrarily small fragment.
        self.assertGreater(len(preserved_selected_text), 1000)
        self.assertTrue(huge_selection.startswith(preserved_selected_text))

        self.assertLessEqual(
            _assembled_input_tokens(self.system_prompt, message),
            ai_suggest.MAX_INPUT_TOKENS_GROQ,
        )

    def test_budget_cannot_produce_empty_or_invalid_prompt(self):
        # Every component maxed out simultaneously -- the worst case.
        payload = {
            "documentTitle": "Doc",
            "documentPath": "UserGuide/doc.md",
            "context": "Context. " * 10000,
            "selectedText": "Selection. " * 10000,
        }

        message = self._build(payload)

        self.assertTrue(message.strip())
        self.assertIn("SELECTED TEXT:\n", message)
        self.assertIn("Document: Doc", message)

    def test_ask_mode_question_never_dropped(self):
        payload = {
            "documentTitle": "Doc",
            "documentPath": "UserGuide/doc.md",
            "context": "Context. " * 10000,
            "selectedText": "Selection. " * 10000,
            "question": "Why is this worded this way?",
        }

        message = self._build(payload, mode="ask")

        self.assertIn("QUESTION:\nWhy is this worded this way?", message)
        self.assertLessEqual(
            _assembled_input_tokens(self.system_prompt, message),
            ai_suggest.MAX_INPUT_TOKENS_GROQ,
        )


if __name__ == "__main__":
    unittest.main()
