# Terminology Glossary

This glossary defines product, healthcare, and documentation pipeline terms used across DocEngine User Guides, Release Notes, and API documentation. Terms are listed in alphabetical order.

**## A**

****ACC (Accident Compensation Corporation) / ACC45****

New Zealand's national accident compensation scheme. When an indici AI Copilot consult involves an accident, the system automatically processes the transcript as an ACC Consult and can use the AI-generated notes to help populate an ACC45 accident claim form, which the provider reviews before submitting.

****Actor****

The party responsible for a step in DocEngine's editorial workflow, recorded in the audit log. Actors are typically `AI` (automated ingestion), `Human` (manual review actions), or `CI` (automated build and deploy steps).

****Admonition****

A styled callout block, such as `!!! note`, used throughout DocEngine documentation to highlight supporting information or exceptions without interrupting the main instructions.

****AI Activities****

The audit section of a patient's indici record where a provider can review past AI Copilot processing sessions, including the original raw transcript (Input) alongside the AI-processed notes (Output).

****AI Balance Report****

Also shown on-screen as the AI Credit Usage Report. An indici report showing how much AI Credit has been consumed, filterable by user, location, date range, and processing type, with the option to inspect the content processed for any entry.

****AI Credit****

The unit of consumption practices use to pay for indici AI Copilot processing. Credit is purchased and allocated at the Practice level, then distributed to individual Providers, with configurable minimum-balance thresholds and automatic top-up rules.

****AI Credit Allocation****

The indici configuration area (`Configurations > AI Configuration > AI Credit Allocation`) where practices enable AI Copilot, request and allocate AI Credit, manage credit thresholds, and set up custom Notes Templates.

****AI Query Builder****

A reporting tab that gives administrators detailed insight into AI query activity and associated usage costs.

****AI Transcribe****

The panel within a patient's Consult File where a provider selects an AI model and Notes Template, records a consult, and reviews the resulting AI-processed notes.

**## C**

****CCCM (COVID Clinical Care Module)****

A HealthLink-hosted form for recording COVID-related clinical care, opened from indici's HealthLink referral portal via the Healthlink icon on the consult toolbar.

****Confidentiality Level****

A medication-level setting — Restricted or Very Restricted — that controls how a medication is shared with the Medicine Data Repository (MDR). Restricted limits visibility to authorised users and approved MDR protocols; Very Restricted hides the medication from the MDR entirely.

****Consult****

A recorded patient encounter in indici. Screens such as the Consult File, Consult Screen, and consult toolbar give providers access to notes, AI Transcribe, medications, and other patient-record functions during a visit.

**## D**

****Docs-as-Code****

DocEngine's approach of treating documentation like source code: content is authored in Markdown, versioned in Git, and moved through an automated ingestion, review, and publishing pipeline rather than edited directly on a hosted site.

****Document Editor****

DocEngine's in-browser authoring interface, built on the Quill rich-text editor, used to draft and edit documentation content before it is saved, approved, and published.

****Draft****

The workflow status assigned to a document immediately after ingestion, before it is submitted for Human Review. Draft files are stored under `docs/drafts/`.

**## E**

****Editorial Workflow****

DocEngine's document lifecycle, tracked by `tools/editorial_workflow.py` and persisted in `docs/.workflow/workflow-state.json`. Documents move through New → Draft → Human Review → Approved/Rejected → Validation → Commit → MkDocs Build → Deploy → Published, with every transition recorded in the audit log.

****ePS / NZePS****

Shorthand used in indici release notes for New Zealand's electronic prescription service standards. indici's ePS Medication History view shows prescribed and dispensed medicine names, and prescription printing has been aligned to current NZePS formatting requirements.

**## G**

****GitHub Actions****

The CI service that automatically builds the DocEngine site (`python -m mkdocs build`) whenever changes are pushed to the `main` branch.

****GitHub Pages****

The hosting platform DocEngine's published site targets, as configured by `site_url` in `mkdocs.yml`.

**## H**

****Health Kiosk****

An indici integration that lets patients scan a QR Code, using the MyIndici app, to capture vitals such as blood pressure and heart rate directly into their patient record.

****HealthLink****

An external referral and forms portal that indici links out to, used for example to create COVID Clinical Care Module (CCCM) forms from the consult toolbar.

****Health NZ (HNZ)****

New Zealand's national health authority. indici's Medical Warnings feature retrieves warning records from Health NZ, and prescription printing has been updated to meet Health NZ compliance requirements.

****Heidi****

One of the third-party AI processors available in indici AI Copilot. Unlike ChatGPT or Claude Sonnet, Heidi runs through an external widget alongside indici rather than integrating directly into the Notes panel.

****Human Review****

The workflow stage where a person reviews a Draft document before it can be approved or rejected. DocEngine's Human Review Workspace lists all drafts awaiting review.

**## I**

****indici****

The clinical and practice management platform that this User Guide, Release Notes, and AI Copilot documentation describe. indici covers patient registration, appointments, consults, prescribing, and configuration for medical practices.

****indici AI Copilot****

An AI-powered suite of tools within indici that automates parts of clinical documentation, starting with AI-driven transcription and structured note generation from patient consults.

****indici Transcriber App****

A companion mobile app that lets clinicians record a consult on their phone for higher audio quality, then automatically syncs the transcript back to the patient's file in indici for AI processing.

****Ingest****

The first stage of DocEngine's editorial workflow (`run_pipeline.py ingest`), where a source file — PDF, Markdown, plain text, or OpenAPI spec — is converted into a Draft Markdown document.

**## J**

****Jira CSV Export****

A comma-separated values export from Jira, accepted by DocEngine's release notes generator (`run_pipeline.py release-notes`), which groups the exported issues into sections such as New Features, Improvements, Bug Fixes, Security, and Known Issues.

**## M**

****Material for MkDocs****

The theme DocEngine's site is built on, providing navigation, search, and styling on top of MkDocs.

****Medical Warnings****

An indici feature that pulls a patient's medical warning records from Health NZ into the Allergies/Medical Warnings section of the consult screen, with filtering by date and status.

****Medicine Data Repository (MDR)****

The external repository medication data can be shared with, subject to a medication's Confidentiality Level.

****MkDocs****

The static site generator that builds the DocEngine documentation site from Markdown source files in `docs/`.

****MyIndici****

indici's patient-facing app and portal, used for example to scan Health Kiosk QR Codes and view saved vitals.

**## N**

****Nav (Navigation)****

The `nav:` tree in `mkdocs.yml` that defines the site's page structure. Publishing a new document through the Editorial Workflow updates this tree automatically so the page appears in the site menu.

****NHI (National Health Index)****

New Zealand's unique patient identifier number, used as a filter field in indici's AI Balance Report.

****NMWS****

The abbreviation shown on indici's "Get NMWS Warnings" action, which queries Health NZ's warnings data source to refresh a patient's Medical Warnings.

****Notes Template****

The format, for example SOAP, that AI Copilot organizes a consult's structured notes into. Practices can make system-provided templates, custom templates, or both available to users.

****NZF (New Zealand Formulary)****

New Zealand's official medicines reference, integrated with indici AI Copilot's prescribing features for drug interaction checks.

**## O**

****OpenAPI Specification****

A standard format for describing REST APIs, used in `api/openapi.yaml` to define DocEngine's Patient Management API and consumed by DocEngine's API doc generator to produce Markdown documentation.

**## P**

****Patient Management System****

The overall system covered by the DocEngine User Guide, supporting patient registration, appointment booking, and appointment management for administrative and clinical staff.

****Practice****

A medical practice or clinic using indici. Many settings, such as AI Credit balance and auto-request thresholds, are configured at the practice level and then allocated down to individual providers.

****Provider****

A clinician or staff member using indici, with their own AI Credit balance, AI model access, and consult records, allocated to them at the Practice level.

****Publish / Published****

The final stage of DocEngine's Editorial Workflow, where a validated, approved document is copied into its target `docs/` section, added to the MkDocs Nav, built, and deployed.

**## Q**

****QR Code****

Used in two indici workflows: patients scan a Health Kiosk QR Code with the MyIndici app to save vitals, and providers generate a QR Code from a patient's file for the indici Transcriber App to scan and start recording.

**## S**

****Section****

One of the three fixed documentation categories DocEngine's pipeline publishes into: `user-guide`, `api`, or `release-notes`.

****SNOMED CT****

The standardized clinical terminology indici uses for diagnosis selection, accessed from AI Copilot's suggested diagnoses through the SNOMED Diagnosis selection window.

****SOAP Notes****

A clinical note format — Subjective, Objective, Assessment, Plan — available as a Notes Template in indici AI Copilot and Heidi.

****Source Type****

The classification DocEngine's ingestion pipeline assigns to an incoming file: `auto`, `pdf`, `markdown`, `ai-markdown`, `text`, or `openapi`.

**## V**

****Validation****

The Editorial Workflow stage that checks a document's Markdown links, images, headings, tables, and MkDocs Nav references before it can be published.

****Vercel****

A serverless hosting platform DocEngine's Publish API (`api/publish.py`) runs on, used to push Document Editor content to GitHub.

****Vitals****

Patient health measurements, such as blood pressure and heart rate, captured through the Health Kiosk QR Code workflow and viewable in indici's Measurements section.
