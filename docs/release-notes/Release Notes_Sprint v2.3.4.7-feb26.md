# Release Notes: February 2026 Sprint v2.3.4.7

## Introduction

This release introduces a series of enhancements focused on improving medication visibility, prescribing accuracy, and workflow efficiency across indici. Several of these improvements support clearer management of long-term medications and repeat prescriptions, helping practices prepare for upcoming prescription duration changes. Updates include improved long-term medication display, streamlined medication editing, updated prescription printing aligned with current NZePS standards, strengthened confidentiality controls, and clearer handling of stopped or cancelled medications.

Enhancements have also been made to AI usage reporting to improve transparency and cost tracking.

## Long-Term Medication Display Update

The Long-Term Medication section in the Consult top bar has been updated to improve readability and reduce visual clutter.

### What's Changed[¶](#whats-changed)

![Long-Term Medications panel showing Quantity and Duration values with hidden date view](../../assets/Release%20Notes_Sprint%20v2.3.4.7-feb26/image-01.png)

These changes improve clarity when reviewing long-term medications, particularly where prescriptions may cover longer intended treatment periods.

![Long-Term Medications panel with the date visibility toggle highlighted](../../assets/Release%20Notes_Sprint%20v2.3.4.7-feb26/image-02.png)

## Print Prescription Enhancement[¶](#print-prescription-enhancement)

Prescription printing in indici has been updated to use a new standard format, changing from the previous PDF layout to an XHTML format, in line with Health NZ (HNZ) compliance requirements.

### What This Means for Your Practice[¶](#what-this-means-for-your-practice)

### Why This Change Was Made[¶](#why-this-change-was-made)

![Prescription print preview in the updated standardised format](../../assets/Release%20Notes_Sprint%20v2.3.4.7-feb26/image-03.png)

## Confidential Medication Setting[¶](#confidential-medication-setting)

New options have been added to allow medications to be marked as confidential, providing greater control over how sensitive medication information is shared and accessed.

### Confidentiality Levels[¶](#confidentiality-levels)

#### Restricted[¶](#restricted)

Medication information is shared with the Medicine Data Repository (MDR) but is not generally visible. Access is limited to authorised users and approved MDR protocols.

#### Very Restricted[¶](#very-restricted)

Medication information is completely hidden and cannot be accessed or viewed in the MDR under any circumstances.

When the Confidential checkbox is selected, the confidentiality level can be chosen from a dropdown (default: Restricted).

![Medication form with Confidential enabled and confidentiality level set to Restricted](../../assets/Release%20Notes_Sprint%20v2.3.4.7-feb26/image-04.png)

## Medication Grid - Quick Edit Enhancement[¶](#medication-grid-quick-edit-enhancement)

The Medication Grid (Today's Medication Activity list) has been enhanced to support quicker updates to active medications.

### What's New[¶](#whats-new)

Quantity and Duration updates remain subject to existing prescribing rules, medicine eligibility, and prescriber clinical judgement.

![Today's Medication Activity quick edit dialog for updating Duration and Quantity](../../assets/Release%20Notes_Sprint%20v2.3.4.7-feb26/image-05.png)

## Displaying Prescribed and Dispensed Medicine Names[¶](#displaying-prescribed-and-dispensed-medicine-names)

The ePS Medication History view has been enhanced with a new toggle to improve visibility of dispensing information.

### What's Changed[¶](#whats-changed_1)

![ePS Medication History showing prescribed and dispensed medicine name toggle controls](../../assets/Release%20Notes_Sprint%20v2.3.4.7-feb26/image-06.png)

## Medication Management - Delete and Stop Functionality[¶](#medication-management-delete-and-stop-functionality)

The behaviour of the Delete and Stop actions has been clarified to ensure safer medication management.

### Updated Behaviour[¶](#updated-behaviour)

#### Medications with Remaining Repeats[¶](#medications-with-remaining-repeats)

When stopped or deleted, the medication becomes inactive and cannot be dispensed in the future.

#### Currently Active Medications[¶](#currently-active-medications)

When deleted or stopped, the medication is marked as cancelled.

This is particularly important for prescriptions with extended repeat periods, ensuring discontinued medicines cannot be dispensed unintentionally.

![Medication activity list with Stop action highlighted for long-term medication management](../../assets/Release%20Notes_Sprint%20v2.3.4.7-feb26/image-07.png)

![Medication activity list with Delete action highlighted for active medications](../../assets/Release%20Notes_Sprint%20v2.3.4.7-feb26/image-08.png)

## AI Credit Usage Report Enhancements[¶](#ai-credit-usage-report-enhancements)

The AI Credit Usage Report has been enhanced to provide greater visibility and improved filtering capabilities.

### AI Usage[¶](#ai-usage)

A Type search filter has been added, allowing users to filter the AI Usage Report by AI Consultation - SOAP Notes or Letters & Documents.

By default, the Type filter is set to All, displaying both SOAP Notes and Letters & Documents AI usage records.

Additionally, a Type column has been added to the report grid, clearly indicating whether each AI usage record is associated with SOAP Notes or Letters & Documents.

![AI Credit Usage Report with Type filter and Type column highlighted](../../assets/Release%20Notes_Sprint%20v2.3.4.7-feb26/image-09.png)

### AI Query Builder[¶](#ai-query-builder)

A new AI Query Builder tab has been introduced to provide detailed insights into AI query activity.

This report includes the following information:

This enhancement improves transparency and helps administrators better track AI usage and associated costs.

![AI Query Builder tab showing query metadata columns and usage cost](../../assets/Release%20Notes_Sprint%20v2.3.4.7-feb26/image-10.png)
