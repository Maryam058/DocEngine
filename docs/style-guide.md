# Technical Documentation Style Guide

## 1. Overview and Purpose

This style guide specifies how documentation is written, structured, and reviewed on the DocEngine platform. It applies to all content published in the `docs/` site—including the user guide, API reference, and release notes—regardless of whether the source is a PDF import, Markdown file, OpenAPI specification, or AI‑drafted page.The purpose of this guide is to:

- Give writers (human and AI) a consistent set of rules to follow.

- Give reviewers a clear checklist for what "ready to publish" means.

- Reduce inconsistency between documents produced by different tools and different contributors.

- Make documentation easier to read, scan, translate, and maintain over time.

If a rule in this guide conflicts with a specific product requirement, raise it during human review rather than silently deviating from either.

## 2. Clear and Concise Writing

Write so that a reader can understand a sentence on the first pass.

- Prefer short sentences over long, compound ones.

- Use active voice. Say who or what performs the action.

- Cut filler words that don't add meaning ("simply," "just," "in order to," "please note that").

- One idea per sentence. Split sentences that carry two instructions.

- Prefer the present tense for describing how the product behaves.

**Good:**

> Click **Save** to store your changes.

**Bad:**

> In order to make sure that your changes are properly stored, you should go ahead and simply click on the **Save** button.

**Good:**

> The API returns a 404 error if the document does not exist.

**Bad:**

> A 404 error will be returned by the API in the event that the document cannot be found to exist.

##

## 3. Consistent Terminology

Use the same term for the same concept every time. Do not vary word choice for the sake of variety — documentation is not creative writing, and synonyms create doubt about whether two terms mean the same thing.

- Pick one term per concept and use it everywhere (for example, always **document**, never alternating between "document," "file," and "record" for the same object).

- Match the terminology used in the DocEngine UI and codebase (for example, use the pipeline's own vocabulary: `section`, `source type`, `actor`, `workflow state`).

- Do not introduce a new term for something that already has an established name elsewhere in the docs.

- If a term is ambiguous or overloaded in the product, flag it for the glossary (see [Section 15](#15-terminology-and-glossary-usage)) instead of inventing a workaround phrase.

**Good:** "Submit the document for review, then approve the document."

**Bad:** "Submit the file for review, then approve the record."

## 4. Writing for the Reader

Write for the person using the product, not for the person who built it.

- Assume the reader wants to complete a task, not learn the internal architecture.

- Avoid internal jargon, code names, or implementation details unless the reader genuinely needs them (for example, API consumers do need endpoint and schema details).

- Explain the "why" only when it changes what the reader should do. Skip background that doesn't affect their next action.

- Address the reader directly using "you." Avoid third-person phrasing like "the user should."

**Good:** "You can only publish a document after it has been approved."

**Bad:** "Users are not able to publish documents in cases where approval has not yet occurred."

Consider the reader's starting point. A first-time reader of the user guide needs more context than a developer integrating with the API. Write each section for its actual audience rather than a generic reader.

## 5. Heading and Section Structure

Headings give the reader a map of the page and support scanning, search, and navigation.

- Use exactly one H1 (`#`) per page — the page title.

- Use H2 (`##`) for major sections and H3 (`###`) for subsections. Avoid going deeper than H4.

- Do not skip heading levels (don't jump from H2 to H4).

- Write headings as short noun phrases or direct instructions, not full sentences with punctuation.

- Keep heading text plain — do not add anchor symbols, generated links, or markup of any kind. A heading is just its text.

**Good:** `## Publishing a Document`

**Bad:** `## Publishing a Document[¶](#publishing-a-document)`

**Bad:** `## How Do I Publish A Document That I Have Already Approved?`

Every page added to the `docs/` tree must also be added to the `nav:` section of `mkdocs.yml`, or readers will not be able to find it through site navigation.

## 6. Procedures and Step-by-Step Instructions

Use numbered lists for any sequence the reader must follow in order. Use bullet lists only when order doesn't matter.

Rules for procedures:

1. Start each step with an imperative verb (Click, Open, Run, Select).

2. Write one action per step. If a step contains "and then," consider splitting it.

3. State the expected result when it isn't obvious, especially if the UI changes.

4. Keep prerequisites separate from the steps — list them before step 1, not embedded inside a step.

**Example:**

> **Prerequisites**

>

- You have a Jira CSV export for the release.

> **To generate release notes:**

>

1. Open a terminal in the project root.

2. Run `python run_pipeline.py release-notes <jira_csv>`.

3. Review the generated Markdown file under `docs/release-notes/`.

4. Submit the document for editorial review.

Avoid vague steps like "Configure the settings as needed." State exactly what to configure and what value to use.

## 7. User Interface Terminology and Labels

When documentation refers to something on screen, the wording must match the product exactly.

- Bold UI labels the reader must interact with: **Save**, **Approve**, **Publish**.

- Match capitalization exactly as it appears in the UI. Don't silently "fix" the product's casing in prose.

- Use the exact control type: button, menu, tab, checkbox, field — don't say "click the option" when it's a checkbox.

- Describe UI location using consistent directional language: "in the top navigation bar," "in the left sidebar," "in the **Actions** menu."

- When a control has an icon but no visible text label, name the control and describe the icon briefly, for example: "Select the **Delete** icon (trash can)."

**Good:** "In the **Review** panel, click **Approve**."

**Bad:** "In the review section, click on the approve link/button."

If the actual UI text is unclear or inconsistent, flag it during human review rather than guessing.

## 8. Bullet Lists and Numbered Lists

- Use bullet lists for unordered items: options, features, requirements.

- Use numbered lists only for sequential steps or ranked items.

- Keep list items grammatically parallel (all start with a verb, or all are noun phrases — don't mix).

- Keep list items short. If an item needs multiple sentences, consider whether it should be its own subsection instead.

- Use sentence case and consistent end punctuation — either every item ends with a period, or none do.

**Good (parallel):**

- Import a PDF.

- Generate release notes.

- Validate the documentation set.

**Bad (not parallel):**

- Importing a PDF

- You can generate release notes

- Validation of documentation

##

## 9. Notes, Tips, and Warnings

Use blockquotes or admonition-style callouts to draw attention to information that isn't part of the main procedural flow. Keep callouts short — one to three sentences.

Use the right type for the content:

- **Note** — supplementary information the reader should know but doesn't need to act on.

- **Tip** — an optional suggestion that makes the task easier or faster.

- **Warning** — something that can cause data loss, a broken build, or an irreversible action if ignored.

**Example:**

> **Note:** Editorial workflow state is stored in `docs/.workflow/workflow-state.json` and should not be edited by hand.

> **Tip:** Run `python run_pipeline.py validate` before publishing to catch broken links early.

> **Warning:** Publishing a document triggers validation, build, and deploy in sequence. This action cannot be undone from within the pipeline.

Do not overuse callouts. If every paragraph is a note or a warning, none of them stand out.

## 10. Screenshots and Images

- Only include a screenshot when it clarifies something text alone cannot (a complex layout, a visual state, an icon).

- Crop screenshots to the relevant area. Avoid full-window captures with irrelevant chrome.

- Keep screenshots current. An outdated screenshot is worse than no screenshot, because it actively misleads the reader.

- Always include descriptive alt text for accessibility — never leave alt text empty or generic ("image1.png").

- Store images in the appropriate assets directory and reference them with relative paths.

- Avoid embedding text-only information as an image. If the content is text (an error message, a code sample), write it as text so it's searchable and accessible.

**Good:**

```
![The Review panel showing a document in "Human Review" state with Approve and Reject buttons](../assets/review-panel.png)

```

**Bad:**

```
![screenshot](../assets/img1.png)

```

## 11. Links and Link Text

- Write link text that describes the destination, not the mechanics of clicking.

- Never use "click here" or "this link" as link text.

- Use relative links for internal documentation pages so they remain valid across environments.

- Do not hardcode local or preview URLs (for example, a `localhost` or a deployment preview URL) into published documentation — link to the page path instead.

- Check that every link resolves to a real page before submitting for review; `python run_pipeline.py validate` checks this automatically.

**Good:** "See [Editorial Workflow](editorial-workflow.md) for the full review process."

**Bad:** "Click here to learn more about the workflow."

**Bad:** "See the workflow docs at `http://127.0.0.1:8000/editorial-workflow/`."

## 12. Code, Commands, and Technical Examples

- Use inline code formatting for file names, commands, flags, parameters, and code identifiers: `run_pipeline.py`, `--section`, `document_id`.

- Use fenced code blocks with a language identifier for multi-line commands or code samples.

- Show a complete, runnable example rather than a fragment when documenting a CLI command.

- Do not mix expected output into the same block as the command unless clearly separated or labeled.

- Keep example values realistic but obviously non-production (avoid real credentials, real customer data, or real internal hostnames).

**Good:**

```
python run_pipeline.py ingest changelog.md --source-type markdown --section release-notes --actor "AI"

```

**Bad:**

> Run the ingest command with the markdown source type and set the section and actor appropriately.

For API documentation specifically, show both the request and an example response, each in its own labeled code block.

## 13. Release Notes Writing

Release notes are read quickly and often skimmed, so structure and consistency matter more than narrative style.

- Group entries by category: **New Features**, **Improvements**, **Bug Fixes**, **Known Issues** (omit empty categories).

- Write each entry as a single, user-facing sentence describing the change and its impact — not the internal ticket description.

- Lead with what changed, not with the ticket ID. Reference the ticket ID at the end if needed for traceability.

- Avoid internal-only language ("refactored the ingestion service") unless it has a visible effect on the reader.

- Use consistent tense: past tense for what shipped ("Fixed," "Added," "Improved").

**Good:**

> **Bug Fixes**

>

- Fixed an issue where publishing a document with unresolved image links would fail silently. (DOC-482)

**Bad:**

- DOC-482: refactor validate_docs.py image resolution logic

Release notes generated from a Jira export via `generate_release_notes.py` are a starting draft only — they still require human editing for tone, grouping, and reader relevance before publication.

## 14. API Documentation

API documentation must be precise, complete, and consistent with the OpenAPI spec in `api/openapi.yaml`.

For each endpoint, document:

- HTTP method and path.

- Purpose, in one sentence.

- Request parameters (path, query, body), with type and whether required.

- A complete example request.

- A complete example response, including realistic field values.

- Possible error responses and what causes them.

**Example:**

```
POST /api/documents/{document_id}/publish

```

Publishes an approved document through validation, build, and deploy.

**Path parameters**

NameTypeRequiredDescription`document_id`stringYesThe unique identifier of the document to publish.

**Example response**

```
{
  "document_id": "doc_2f91a",
  "status": "Published",
  "published_at": "2026-08-24T10:15:00Z"
}

```

Keep generated API pages in sync with the spec. If `generate_api_docs.py` output and the spec diverge, treat the spec as the source of truth and flag the discrepancy.

## 15. Terminology and Glossary Usage

Maintain a single glossary for terms that are specific to DocEngine or that could otherwise be ambiguous (for example: **document**, **section**, **actor**, **workflow state**, **source type**).

- Define a term in the glossary once; don't redefine it inline on every page that uses it.

- Link to the glossary entry on first use within a page if the term isn't self-explanatory from context.

- Do not use two different terms for the same glossary concept anywhere in the docs.

- When a new pipeline concept is introduced (a new source type, a new workflow state), add it to the glossary as part of the same review, not as a follow-up.

## 16. Accessibility

Documentation must be usable by readers using screen readers, keyboard navigation, or other assistive technology.

- Write descriptive alt text for every image (see [Section 10](#10-screenshots-and-images)).

- Use real heading levels for structure — never bold text pretending to be a heading.

- Don't rely on color alone to convey meaning ("the red button" — also name it: "the red **Delete** button").

- Write link text that makes sense out of context (a screen reader may list all links on a page separately).

- Use proper table markup for tabular data rather than formatting it with line breaks or spacing.

- Keep sentence and paragraph length readable; avoid dense walls of text.

## 17. Documentation Accuracy and Review

Accuracy is not optional. Documentation that describes behavior the product doesn't actually have is worse than no documentation.

Before content is considered accurate:

- Every procedure has been verified against the actual product behavior, not assumed from the source material.

- Every command, flag, and code example has been checked for correctness.

- Every UI label, menu name, and button name matches the current product exactly.

- Every internal link resolves, and every external reference is current.

- Terminology matches the glossary and the rest of the site.

Documents generated by any pipeline tool (`import_pdf.py`, `generate_api_docs.py`, `generate_release_notes.py`) are starting drafts. Source conversion can introduce formatting errors, misdetected sections, or misplaced content that must be caught during review.

## 18. AI Drafting and Human Approval Workflow

AI may draft documentation content, but AI must never publish content automatically. Every document — regardless of how it was created — moves through the same editorial workflow before it reaches readers:

```
AI Draft → Human Review → Human Editing → Approval → Publish

```

**AI Draft**

AI (or a pipeline tool) produces an initial version of the content. This draft may come from a PDF import, a Markdown or OpenAPI ingestion, a generated release notes file, or a directly AI-authored page. The draft is saved into the workflow with an audit actor of `"AI"`.

**Human Review**

A human reviewer reads the draft in full and evaluates it against this style guide. The reviewer is responsible for checking:

- **Accuracy** — does the content correctly describe actual product behavior?

- **Product behavior** — has each procedure been tested against the real product, not just the source material?

- **Terminology** — does the draft use approved, consistent terms and match the glossary?

- **Formatting** — do headings, lists, tables, and code blocks follow this guide?

- **Links** — do all internal and external links resolve correctly?

- **Screenshots** — are images current, relevant, cropped appropriately, and described with alt text?

- **Accessibility** — does the page meet the accessibility expectations in [Section 16](#16-accessibility)?

- **Overall quality** — is the page clear, complete, and appropriate for its intended audience?

**Human Editing**

The reviewer edits the draft directly to correct any issues found during review. This may include rewriting sections, fixing terminology, correcting inaccurate steps, or removing content that doesn't belong.

**Approval**

Once the reviewer is satisfied, they approve the document through the editorial workflow (`python run_pipeline.py review <document_id> --action approve --actor "<reviewer name>"`). Approval records a human actor in the audit trail — AI-only approval is not permitted.

**Publish**

Only after approval can a document be published (`python run_pipeline.py publish <document_id>`), which chains validation, build, and deploy. Publishing an AI draft that has not completed human review and approval is not an acceptable use of the pipeline.

> **Important:** This page itself is currently in the AI Draft stage. It must go through Human Review, Human Editing, and Approval before it is published.

## 19. Final Documentation Quality Checklist

Before submitting any page for approval, confirm:

- [ ] The page has exactly one H1, with a clear and correctly leveled heading hierarchy below it.

- [ ] Headings contain plain text only — no anchor symbols, generated links, or markup.

- [ ] Sentences are short, active, and free of filler words.

- [ ] Terminology is consistent with the glossary and the rest of the site.

- [ ] Procedures use numbered steps, one action per step, with prerequisites listed separately.

- [ ] UI labels match the product exactly and are bolded where the reader must interact with them.

- [ ] Lists are parallel in structure and appropriately bulleted or numbered.

- [ ] Notes, tips, and warnings are used sparingly and labeled correctly.

- [ ] All screenshots are current, cropped, and include descriptive alt text.

- [ ] All links use descriptive text, resolve correctly, and avoid hardcoded local or preview URLs.

- [ ] Code examples are complete, correctly formatted, and use realistic non-sensitive values.

- [ ] The page has been added to `mkdocs.yml` navigation, if it's a new page.

- [ ] `python run_pipeline.py validate` has been run with no unresolved issues.

- [ ] The document has completed Human Review, Human Editing, and Approval in the editorial workflow.

- [ ] The document is not published until every item above is confirmed.
