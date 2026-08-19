# indici AI Copilot

## Overview

We are delighted to introduce indici AI Copilot, an AI-powered suite of tools designed to enhance clinical workflows and bring substantial efficiency gains to medical practices. As the Copilot will be integrated across a swathe of core features within the indici platform, we are gradually rolling it out to allow users time to adapt. This phased approach ensures:

Your feedback is crucial! We have always taken a collaborative approach in the design and development of indici to ensure that user experience is prioritised, and the roll out of the Copilot is no exception. So get in touch and let us know how you are getting on, so we can continue to improve our offerings with intelligent, efficient, and user-friendly tools.

## Phase 1: AI-Powered Transcription[¶](#phase-1-ai-powered-transcription)

### AI Transcription Services[¶](#ai-transcription-services)

As an indici clinical user, you will be able to take full advantage of the Copilot's AI-driven transcription services from the outset. By converting your patient interactions into structured clinical notes within seconds, the Copilot dramatically reduces the amount of time you need to spend documenting your consults.

Clinical note conversion is performed by multiple established AI processors, all of which are continuously enhancing their capabilities. Therefore, we have taken a flexible approach, allowing practices to choose the service that best suits their needs.

At present, we offer practices a choice of the following AI processors:

### indici Transcriber App[¶](#indici-transcriber-app)

To further enhance transcription accuracy, we have also rolled out the indici Transcriber app, which allows clinicians to use their mobile phones as recording devices during consultations. This promotes better audio quality, improving the accuracy of AI-generated transcripts. Over time, we will introduce more features to the app, focusing on continuously improving efficiency and user experience.

### AI Usage, Credits, & Subscription Management[¶](#ai-usage-credits-subscription-management)

AI services require significant computational resources, measured in credits or tokens, which are consumed based on usage. Most AI platforms use a pay-per-use model, requiring users to either purchase tokens or subscribe to a plan with a defined number of tokens.

However, we have worked to streamline our users' AI experience by including a comprehensive credit and subscription management system within indici. This allows practices to:

Some AI providers may use an annual subscription model instead of tokens. indici supports seamless handling of such subscriptions, with automated notifications and subscription renewals built in.

### How much does it Cost?[¶](#how-much-does-it-cost)

To support the integrated usage of external LLMs for generating consult documentation, we have built an AI Credit Manager into indici, where practices can top up their AI Credit and allocate it to their providers as required. Whenever a provider processes a consult using AI, the relevant charge will be deducted from their AI Credit balance. Details on how to manage AI Credit are provided further down in this document.

The cost of processing a consult will vary depending on the length of the consult recording, the template, and the LLM. However, as an approximate guide and based on previous usage, a consult typically costs between $0.20 and $0.40 (NZD).

## Beyond Phase 1[¶](#beyond-phase-1)

### Upcoming AI-Powered Features in indici[¶](#upcoming-ai-powered-features-in-indici)

In addition to transcription and note conversion, we will soon be introducing a wide range of practice-boosting AI features, including:

### AI-Based Prescribing and Medication Reconciliation[¶](#ai-based-prescribing-and-medication-reconciliation)

## Auditing AI-Based Transcriptions[¶](#auditing-ai-based-transcriptions)

Since AI-powered transcription is a new and evolving technology, we have developed robust auditing features to ensure accuracy and accountability:

## Copilot User Guide[¶](#copilot-user-guide)

The following sections describe how to configure and use AI Transcription within indici.

### Configuration[¶](#configuration)

#### Enabling indici AI Copilot[¶](#enabling-indici-ai-copilot)

To enable indici AI Copilot for your practice:

#### Requesting AI Credit[¶](#requesting-ai-credit)

As mentioned in the introduction, AI services consume tokens or credits in order to operate.

To request credit for your practice:

#### Allocating Credit to Users[¶](#allocating-credit-to-users)

When your practice has sufficient AI Copilot credit, the next step is to allocate it to relevant staff members who will then be able to utilise the AI Copilot.

To do this:

#### Managing Minimum Credit Thresholds[¶](#managing-minimum-credit-thresholds)

You can set minimum credit amounts for indici AI Copilot at both a practice and provider level. What this means is that if a practice's AI credit falls below the defined minimum amount, then a task can be automatically sent to the practice manager, prompting them to request additional credit.

Likewise, a minimum amount can be set for providers within the practice. If a provider's credit amount falls below the defined minimum, they will be automatically allocated additional credit from the practice's fund.

To set up these configurations:

Managing Minimum Amounts for the Practice[¶](#managing-minimum-amounts-for-the-practice)

To set a minimum amount for the practice:

![Auto-Request Threshold for AI Credits and Auto-Request Amount fields highlighted](../../assets/AI%20Copilot/image-14.png)

In the example above, if the practice's AI credit falls below 20 credits, a task will be automatically generated for the practice manager, prompting them to request a credit amount of 100 from the indici team. The practice manager will do this by contacting the indici team via email.

Managing Minimum Amounts for Providers[¶](#managing-minimum-amounts-for-providers)

To set a minimum amount for providers within the practice:

![Auto-Top-Up Threshold for Provider Credits and Auto-Top-Up Amount for Provider Credits fields highlighted](../../assets/AI%20Copilot/image-15.png)

In the example above, if a provider's AI credit falls below 5 credits, they will automatically receive an additional 50 credits, which will be allocated to them from the practice's AI credit fund.

#### Setting up Custom Templates[¶](#setting-up-custom-templates)

You can set up your custom templates, which will be used to instruct the selected AI processor (e.g. ChatGPT) on how to organise your structured notes post-processing.

To create a custom template:

Once templates are made available, users will be able to select them from the **Template** field in the AI Transcribe section within the patient's Consult File.

![AI Transcribe panel Template dropdown showing system and custom templates available for selection](../../assets/AI%20Copilot/image-21.png)

### Managing Access[¶](#managing-access)

#### Enabling Users to Access the Copilot[¶](#enabling-users-to-access-the-copilot)

To ensure a user has access to indici AI Copilot:

![AI User Access Rights search with Manage Access checkbox highlighted](../../assets/AI%20Copilot/image-22.png)

#### Access Permissions[¶](#access-permissions)

A number of access permissions have been added to the indici Access Permissions Matrix. To open this matrix, go to **Configurations > User Management > Access Rights**. Here you will see the following new permissions.

AI Configuration[¶](#ai-configuration)

Under **Configurations**, expand **AI Configuration**. This allows you to control which user roles have access to:

Simply mark the checkboxes under the user roles you want to have access and click **Save**.

![Access Permissions Matrix with the AI Configuration section, AI Credit Allocation, and AI User Configuration rows highlighted](../../assets/AI%20Copilot/image-23.png)

AI Activities[¶](#ai-activities)

Expand **Patient Note Functions** to see **AI Activities**. This controls who can access the AI Activities section within the Patient Note Functions on the Consult Screen.

Simply mark the checkboxes under the user roles you want to have access to and click **Save**.

![Access Permissions Matrix with the AI Activities row highlighted under Patient Note Functions](../../assets/AI%20Copilot/image-24.png)

AI Balance Usage Report[¶](#ai-balance-usage-report)

Expand the **Report** section to see the **AI Balance Usage Report**. This controls who can access the AI Balance Usage Report in order to view AI credit usage details.

Simply mark the checkboxes under the user roles you want to have access to and click **Save**.

![Access Permissions Matrix with the AI Balance Usage Report row highlighted under Report](../../assets/AI%20Copilot/image-25.png)

### Using indici AI Copilot[¶](#using-indici-ai-copilot)

If you have been given access to indici AI Copilot by your practice and allocated sufficient AI credit, you can use indici AI Copilot to assist in documenting your patient consults. Depending on how your practice has set up the Copilot, you may have the choice of using one or multiple AI processors.

#### Using Azure OpenAI, or Claude Sonnet[¶](#using-azure-openai-or-claude-sonnet)

When using Azure OpenAI or Claude Sonnet, please follow the steps below.

Documenting your Consult[¶](#documenting-your-consult)

To document your consult:

Approving AI-Processed Content[¶](#approving-ai-processed-content)

AI-processed content must be approved as follows:

Documenting an ACC Consult[¶](#documenting-an-acc-consult)

If your interaction with the patient includes information related to an accident, the AI Copilot will automatically process the transcript in the context of an ACC Consult.

Once you click AI-Process, the notes returned by the Copilot will include an accident details section. You can use these notes to automatically populate an ACC45 form by clicking the plus icon next to them.

![AI Processed ACC section with accident details and the plus icon highlighted](../../assets/AI%20Copilot/image-38.png)

A pop up will appear reminding you to review the form to ensure its accuracy before submitting. Click **OK** to continue.

![Warning popup stating the Accident Details section of the ACC45 form is auto-populated using AI processing](../../assets/AI%20Copilot/image-39.png)

This will open the ACC45 form, where certain fields will be automatically filled in based on your interaction with the patient. Review the form, edit or add to it as required, and then submit as you normally would.

![ACC45 Accident Detail form with fields pre-populated from the AI-processed consult](../../assets/AI%20Copilot/image-40.png)

AI Activities[¶](#ai-activities_1)

Once you have actioned/approved all of the AI-processed content you wish to include within the patient's record, you can simply leave any unnecessary remaining information as it is. Any information that has not been actioned won't be saved within the record.

You can always view your AI activities, including the original raw transcription content from the recording, by clicking **AI Activities** in the Patient Note Functions list.

![AI Activities item in the Patient Note Functions list](../../assets/AI%20Copilot/image-41.png)

In the section that opens, click the eye icon next to an activity to view it in more detail.

![AI activities grid with the eye icon highlighted in the Action column](../../assets/AI%20Copilot/image-42.png)

#### Using Heidi[¶](#using-heidi)

Most of the AI processors integrate seamlessly into indici, but some, like Heidi, require an external widget to function alongside the system. Therefore, if you are using Heidi, the workflow is slightly different. Simply follow the steps below:

If you want to start a new session within Heidi at any point, click the three dots icon and select **New Session**.

![Heidi widget menu showing Switch to dark mode, New session, and Heidi Help options](../../assets/AI%20Copilot/image-53.png)

### indici AI Transcriber App[¶](#indici-ai-transcriber-app)

#### Overview[¶](#overview_1)

Alongside our indici AI Copilot, we have designed and developed the indici Transcriber app to further enhance the speed and accuracy of documenting a consultation. The indici Transcriber app allows providers to use their phone to record the interaction with their patient and then seamlessly syncs the transcribed data back to indici.

Often, your phone will have higher levels of audio quality than the microphone built into your computer, meaning it is much better suited to generating accurate consult transcripts. This, in turn, supports more efficient outputs when you use AI to process the consult, essentially optimising the speed and efficiency of your entire consult documentation workflow.

Building on previous versions of the Transcriber app, we have pared down the process to achieve a truly streamlined user experience. All you have to do is:

Once the consult is complete, the app automatically syncs the transcribed data back to the patient's file in indici, where it can be processed through your selected AI model to produce full, structured consultation notes.

#### How to use the indici Transcriber App[¶](#how-to-use-the-indici-transcriber-app)

Downloading the App[¶](#downloading-the-app)

To download the indici Transcriber app:

Generating a QR Code[¶](#generating-a-qr-code)

The next step is to generate a QR Code for the patient you are seeing. To do so:

Scanning the QR Code[¶](#scanning-the-qr-code)

Recording the Consult[¶](#recording-the-consult)

As soon as you have scanned the QR code, the app will start recording the consultation automatically. You will see the timer has been activated, and a message in red font will advise you that the recording is in progress.

![indici AI Transcriber app showing patient details and the consultation recording in progress](../../assets/AI%20Copilot/image-57.png)

You should place the phone somewhere close by and unobstructed to get the highest possible audio quality and reduce the potential for errors in the transcript.

Then simply carry out your consultation with your patient. If you wish to pause the recording at any point, click **Pause**. The app will not record any audio while paused.

![Consultation Recording screen with the Pause button highlighted](../../assets/AI%20Copilot/image-58.png)

Once you are finished, click **End Consultation**.

![Consultation Recording screen with the End Consultation button highlighted](../../assets/AI%20Copilot/image-59.png)

Syncing the Transcript back to indici[¶](#syncing-the-transcript-back-to-indici)

As soon as you click **End Consultation**, you will see a message advising you that the audio is now processing.

![Consultation Recording screen showing audio processing progress](../../assets/AI%20Copilot/image-60.png)

Once the processing has been completed, the app will automatically send the generated transcript to the patient's file in indici. You will see a message advising you that it has been sent.

![Transcript sent successfully confirmation popup](../../assets/AI%20Copilot/image-61.png)

To view the transcript, open the patient's indici file and navigate to the AI Transcribe section (in the right-hand panel).

![AI Transcribe panel showing the synced transcript ready for AI processing](../../assets/AI%20Copilot/image-62.png)

You can then process this data using a selected AI processor model as described in the previous section ([Using indici AI Copilot](#using-indici-ai-copilot)).

## AI Balance Report[¶](#ai-balance-report)

We have added a new report in indici called AI Balance Report, where you can view how much AI credit has been consumed and by whom.

To open this report:
