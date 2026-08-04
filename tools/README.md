# DocEngine Tools

This folder contains the documentation automation scripts for DocEngine.

## Scripts

- `import_pdf.py` converts a PDF to Markdown with Microsoft MarkItDown, extracts embedded images, and writes the output into `docs/UserGuide/`.
- `extract_images.py` extracts embedded images from a PDF into `docs/assets/<document-name>/`.
- `generate_release_notes.py` turns a Jira export into professional release notes in `docs/release-notes/latest-release-notes.md`.
- `generate_api_docs.py` turns an OpenAPI YAML or JSON spec into Markdown API documentation in `docs/api/api-reference.md`.
- `validate_docs.py` scans Markdown files, image links, internal links, and `mkdocs.yml` references for problems.

## Requirements

Use the project virtual environment and install the documentation dependencies before running the tools:

```bash
pip install -r requirements.txt
```

If you plan to run the PDF conversion tools outside the current environment, ensure `markitdown` and `pymupdf` are installed as well.

## Examples

### Convert a PDF to Markdown

```bash
python tools/import_pdf.py docs/UserGuide/Covid-CCM.pdf
```

This command creates or updates:

- `docs/UserGuide/Covid-CCM.md`
- `docs/assets/Covid-CCM/`

### Extract images only

```bash
python tools/extract_images.py docs/UserGuide/Covid-CCM.pdf
```

### Generate release notes

```bash
python tools/generate_release_notes.py docs/release-notes/tickets.csv
```

### Generate API documentation

```bash
python tools/generate_api_docs.py api/openapi.yaml
```

### Validate the documentation tree

```bash
python tools/validate_docs.py
```

You can pass `-v` or `-vv` to any script for more detailed logging.
