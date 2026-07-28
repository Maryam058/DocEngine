# Technical Documentation Style Guide

This guide defines the voice, structure, and formatting standards for DocEngine documentation. Consistent writing helps readers scan content quickly, trust the information, and complete tasks with confidence.

## Voice and Tone

Write in a clear, direct, and professional tone.

- Use plain language whenever possible.
- Be concise and useful.
- Address the reader as "you" when giving instructions.
- Favor active voice over passive voice.
- Keep the tone helpful, calm, and confident.

Example:

- Prefer: "Create a new project by running the command below."
- Avoid: "A new project can be created by running the command below."

## Grammar Rules

Follow these grammar standards:

- Use standard American English.
- Use present tense for procedures and descriptions.
- Use second person for instructions: "Click", "Open", "Enter".
- Use the Oxford comma where appropriate.
- Keep sentences short and focused.
- Avoid slang, jargon, and unnecessary filler.

## Capitalization

Use capitalization consistently:

- Capitalize proper nouns and official product names.
- Capitalize headings and titles in sentence case.
- Use lowercase for generic terms unless they begin a sentence.
- Capitalize UI labels only when they appear as exact interface text.

## Headings

Use headings to create a clear hierarchy.

- Use a single H1 per page.
- Use H2 for major sections and H3 for supporting subsections.
- Keep headings descriptive and scannable.
- Avoid vague headings such as "Details" or "Info".

Example:

```md
# Installation

## Prerequisites

### Python Version
```

## Lists

Use lists to break down steps, options, or related points.

- Use numbered lists for sequential steps.
- Use bullet lists for related items or choices.
- Keep list items parallel in structure.
- Avoid nesting lists more than two levels deep.

Example:

1. Open the project folder.
2. Install the dependencies.
3. Start the local server.

## Notes

Use notes to call out helpful context or supporting information.

!!! note
    Notes provide extra context that may improve understanding but is not required for the main task.

## Warnings

Use warnings to highlight risks, breaking changes, or destructive actions.

!!! warning
    Warnings should be used sparingly and only when the reader may lose data or break a workflow.

## Code Blocks

Code examples should be easy to copy and understand.

- Use fenced code blocks with the correct language tag.
- Keep examples minimal and relevant.
- Avoid placeholder values unless they are clearly labeled.
- Include expected output when it improves clarity.

Example:

```bash
python -m mkdocs serve
```

## API Writing Standards

When documenting APIs:

- Describe the endpoint, method, purpose, and parameters clearly.
- Include request and response examples.
- Specify required headers, authentication, and error responses.
- Use consistent naming for parameters and payload fields.
- Mention status codes in a concise, actionable way.

Example:

- Use: "Send a GET request to retrieve the resource."
- Avoid: "Use the API to get data."

## Screenshot Guidelines

Screenshots should support the instructions, not replace them.

- Use screenshots only when visual context is necessary.
- Crop tightly to the relevant area.
- Ensure the image is high resolution and readable.
- Add descriptive alt text.
- Label important UI elements when needed.

## Accessibility Guidelines

Documentation should be accessible to all readers.

- Use descriptive headings and meaningful link text.
- Provide sufficient contrast in diagrams and screenshots.
- Use alt text for images and diagrams.
- Keep tables simple and readable.
- Avoid relying on color alone to convey meaning.
- Write inclusive, neutral language.
